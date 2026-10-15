import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEvaluationDto, ListEvaluationsDto } from './evaluation.dto';

function localDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: process.env.APP_TIMEZONE || 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function evaluationAge(birth: Date, evaluated: Date, now = new Date()) {
  if (!Number.isFinite(evaluated.getTime()) || evaluated > now)
    throw new BadRequestException(
      'La evaluación debe tener una fecha válida y no futura.',
    );
  const birthday = birth.toISOString().slice(0, 10);
  const day = localDate(evaluated);
  const fifthBirthday = `${Number(birthday.slice(0, 4)) + 5}${birthday.slice(4)}`;
  if (day < birthday)
    throw new BadRequestException(
      'La evaluación no puede ser anterior al nacimiento.',
    );
  if (day >= fifthBirthday)
    throw new BadRequestException(
      'El registro de evaluaciones está limitado a menores de cinco años.',
    );
  return Math.round(
    (Date.parse(day + 'T00:00:00Z') - Date.parse(birthday + 'T00:00:00Z')) /
      86400000,
  );
}
const fields = {
  codigo_publico: true,
  evaluado_en: true,
  edad_dias: true,
  peso_kg: true,
  talla_cm: true,
  tipo_medicion: true,
  edema: true,
  lugar_evaluacion: true,
  estado: true,
  observaciones: true,
  motivo_anulacion: true,
  anulada_en: true,
  ninos: {
    select: {
      codigo_publico: true,
      codigo_expediente: true,
      primer_nombre: true,
      segundo_nombre: true,
      primer_apellido: true,
      segundo_apellido: true,
    },
  },
  centros_salud: { select: { nombre: true } },
} satisfies Prisma.evaluaciones_nutricionalesSelect;
type Row = Prisma.evaluaciones_nutricionalesGetPayload<{
  select: typeof fields;
}>;
function present(row: Row) {
  return {
    ...row,
    peso_kg: row.peso_kg.toFixed(2),
    talla_cm: row.talla_cm.toFixed(2),
    evaluado_en: row.evaluado_en.toISOString(),
  };
}
@Injectable()
export class EvaluacionesService {
  constructor(private readonly prisma: PrismaService) {}
  async search(text: string, history = false) {
    return this.prisma.ninos
      .findMany({
        where: {
          ...(history
            ? { evaluaciones_nutricionales: { some: {} } }
            : { estado: 'ACTIVO' as const }),
          AND: text.split(/\s+/).map((term) => ({
            OR: [
              { primer_nombre: { contains: term } },
              { segundo_nombre: { contains: term } },
              { primer_apellido: { contains: term } },
              { segundo_apellido: { contains: term } },
              { codigo_expediente: { contains: term } },
            ],
          })),
        },
        take: 20,
        orderBy: [{ primer_apellido: 'asc' }, { id: 'asc' }],
        select: {
          codigo_publico: true,
          codigo_expediente: true,
          primer_nombre: true,
          segundo_nombre: true,
          primer_apellido: true,
          segundo_apellido: true,
          fecha_nacimiento: true,
          sexo_biologico: true,
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          ...row,
          fecha_nacimiento: row.fecha_nacimiento.toISOString().slice(0, 10),
        })),
      );
  }
  async centers(userId: bigint) {
    const user = await this.prisma.usuarios.findUniqueOrThrow({
      where: { id: userId },
      select: { centro_salud_id: true },
    });
    const rows = await this.prisma.centros_salud.findMany({
      where: {
        activo: true,
        ...(user.centro_salud_id ? { id: user.centro_salud_id } : {}),
      },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    return rows.map((row) => ({ ...row, id: row.id.toString() }));
  }
  async list(query: ListEvaluationsDto) {
    const where: Prisma.evaluaciones_nutricionalesWhereInput = query.nino_codigo
      ? { ninos: { codigo_publico: query.nino_codigo } }
      : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.evaluaciones_nutricionales.count({ where }),
      this.prisma.evaluaciones_nutricionales.findMany({
        where,
        select: fields,
        orderBy: [{ evaluado_en: 'desc' }, { id: 'desc' }],
        take: 20,
        skip: (query.pagina - 1) * 20,
      }),
    ]);
    return {
      datos: rows.map(present),
      total,
      pagina: query.pagina,
      paginas: Math.max(1, Math.ceil(total / 20)),
    };
  }
  async create(dto: CreateEvaluationDto, userId: bigint) {
    // El SQL calcula IMC en DECIMAL(5,2): una combinación válida individualmente
    // puede exceder la capacidad de la columna generada.
    const imc =
      Math.round((dto.peso_kg / (dto.talla_cm / 100) ** 2) * 100) / 100;
    if (imc > 999.99)
      throw new BadRequestException(
        'Revisa el peso y la talla: su combinación excede la capacidad de almacenamiento del IMC.',
      );
    const centerId = BigInt(dto.centro_salud_id);
    if (centerId > 9223372036854775807n)
      throw new BadRequestException('Centro no válido.');
    const date = new Date(dto.evaluado_en);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ninos WHERE codigo_publico = ${dto.nino_codigo} FOR UPDATE`;
      const child = await tx.ninos.findUnique({
        where: { codigo_publico: dto.nino_codigo },
        select: { id: true, estado: true, fecha_nacimiento: true },
      });
      if (!child) throw new NotFoundException('No se encontró al niño.');
      if (child.estado !== 'ACTIVO')
        throw new ConflictException('Solo se pueden evaluar niños activos.');
      const age = evaluationAge(child.fecha_nacimiento, date);
      const user = await tx.usuarios.findUniqueOrThrow({
        where: { id: userId },
        select: { centro_salud_id: true },
      });
      if (user.centro_salud_id && user.centro_salud_id !== centerId)
        throw new ForbiddenException(
          'Debes usar el centro de salud asignado a tu cuenta.',
        );
      if (
        !(await tx.centros_salud.findFirst({
          where: { id: centerId, activo: true },
          select: { id: true },
        }))
      )
        throw new BadRequestException('El centro no existe o está inactivo.');
      // Un reintento idéntico del mismo autor reutiliza la medición, bajo el bloqueo del niño.
      const repeated = await tx.evaluaciones_nutricionales.findFirst({
        where: {
          nino_id: child.id,
          registrado_por: userId,
          centro_salud_id: centerId,
          evaluado_en: date,
          peso_kg: dto.peso_kg,
          talla_cm: dto.talla_cm,
          tipo_medicion: dto.tipo_medicion,
          edema: dto.edema,
          lugar_evaluacion: dto.lugar_evaluacion,
          observaciones: dto.observaciones ?? null,
          estado: 'REGISTRADA',
        },
        select: fields,
      });
      if (repeated) return present(repeated);
      const now = new Date();
      const row = await tx.evaluaciones_nutricionales.create({
        data: {
          codigo_publico: ulid(),
          nino_id: child.id,
          centro_salud_id: centerId,
          registrado_por: userId,
          evaluado_en: date,
          edad_dias: age,
          peso_kg: dto.peso_kg,
          talla_cm: dto.talla_cm,
          tipo_medicion: dto.tipo_medicion,
          edema: dto.edema,
          lugar_evaluacion: dto.lugar_evaluacion,
          observaciones: dto.observaciones,
          estado: 'REGISTRADA',
          origen_registro: 'MANUAL_WEB',
          creado_en: now,
          actualizado_en: now,
        },
        select: { ...fields, id: true },
      });
      await tx.registros_auditoria.create({
        data: {
          usuario_id: userId,
          accion: 'INSERTAR',
          entidad: 'evaluaciones_nutricionales',
          entidad_id: row.id.toString(),
          ocurrido_en: now,
          datos_nuevos: JSON.stringify({ codigo_publico: row.codigo_publico }),
        },
      });
      const { id, ...safe } = row;
      void id;
      return present(safe);
    });
  }
  async annul(code: string, reason: string, actor: bigint) {
    const motivo = reason.trim();
    if (motivo.length < 5)
      throw new BadRequestException(
        'Escribe un motivo de al menos cinco caracteres.',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM evaluaciones_nutricionales WHERE codigo_publico = ${code} FOR UPDATE`;
      const row = await tx.evaluaciones_nutricionales.findUnique({
        where: { codigo_publico: code },
      });
      if (!row) throw new NotFoundException('Evaluación no encontrada.');
      if (row.estado !== 'REGISTRADA')
        throw new ConflictException(
          'La evaluación ya no está registrada. Actualiza el historial.',
        );
      const now = new Date();
      await tx.evaluaciones_nutricionales.update({
        where: { id: row.id },
        data: {
          estado: 'ANULADA',
          anulada_por: actor,
          anulada_en: now,
          motivo_anulacion: motivo,
        },
      });
      await tx.registros_auditoria.create({
        data: {
          usuario_id: actor,
          accion: 'ACTUALIZAR',
          entidad: 'evaluaciones_nutricionales',
          entidad_id: code,
          datos_anteriores: JSON.stringify({ estado: row.estado }),
          datos_nuevos: JSON.stringify({ estado: 'ANULADA', motivo }),
        },
      });
      return {
        mensaje:
          'Evaluación anulada. Se conserva su historial y los reportes anteriores.',
      };
    });
  }
}
