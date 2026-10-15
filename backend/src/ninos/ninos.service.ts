import type { EditNinoDto } from './edit-nino.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { PrismaService } from '../prisma/prisma.service';
import { CertificateService } from './certificate.service';
import type { CreateNinoDto } from './create-nino.dto';
import type { ListNinosDto } from './list-ninos.dto';

const publicFields = {
  codigo_publico: true,
  codigo_expediente: true,
  primer_nombre: true,
  segundo_nombre: true,
  primer_apellido: true,
  segundo_apellido: true,
  fecha_nacimiento: true,
  sexo_biologico: true,
  estado: true,
  certificado_ultimos4: true,
  comunidades: { select: { nombre: true } },
} satisfies Prisma.ninosSelect;
type PublicNino = Prisma.ninosGetPayload<{ select: typeof publicFields }>;

export function validateBirthDate(value: string): Date {
  const date = new Date(value + 'T00:00:00.000Z');
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: process.env.APP_TIMEZONE || 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value < '1000-01-01' ||
    value > today
  ) {
    throw new BadRequestException(
      'La fecha de nacimiento debe ser una fecha válida y no puede ser futura.',
    );
  }
  return date;
}

function present(row: PublicNino) {
  const { fecha_nacimiento, comunidades, ...data } = row;
  return {
    ...data,
    fecha_nacimiento: fecha_nacimiento.toISOString().slice(0, 10),
    comunidad: comunidades?.nombre ?? null,
  };
}

@Injectable()
export class NinosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certificate: CertificateService,
  ) {}

  async list(query: ListNinosDto) {
    const terms = query.busqueda?.split(/\s+/).filter(Boolean) ?? [];
    const where: Prisma.ninosWhereInput = {
      ...(query.estado === 'TODOS' ? {} : { estado: query.estado }),
      AND: terms.map((term) => ({
        OR: [
          { primer_nombre: { contains: term } },
          { segundo_nombre: { contains: term } },
          { primer_apellido: { contains: term } },
          { segundo_apellido: { contains: term } },
          { codigo_expediente: { contains: term } },
        ],
      })),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.ninos.count({ where }),
      this.prisma.ninos.findMany({
        where,
        select: publicFields,
        orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
        skip: (query.pagina - 1) * query.limite,
        take: query.limite,
      }),
    ]);
    return {
      datos: rows.map(present),
      total,
      pagina: query.pagina,
      limite: query.limite,
      paginas: Math.max(1, Math.ceil(total / query.limite)),
    };
  }

  async detail(code: string) {
    const row = await this.prisma.ninos.findUnique({
      where: { codigo_publico: code },
      select: {
        ...publicFields,
        version_registro: true,
        direccion_referencia: true,
        creado_en: true,
        nino_responsable: {
          orderBy: [
            { es_principal: 'desc' },
            { creado_en: 'asc' },
            { responsable_id: 'asc' },
          ],
          select: {
            parentesco: true,
            es_principal: true,
            autorizado_contacto: true,
            responsables: {
              select: {
                codigo_publico: true,
                nombres: true,
                apellidos: true,
                telefono: true,
                correo: true,
                direccion: true,
                activo: true,
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('No se encontró el expediente.');
    const { direccion_referencia, creado_en, nino_responsable, ...basic } = row;
    return {
      ...present(basic),
      direccion_referencia,
      creado_en: creado_en.toISOString(),
      responsables: nino_responsable.map(({ responsables, ...link }) => ({
        ...responsables,
        ...link,
      })),
    };
  }

  async communities() {
    const rows = await this.prisma.comunidades.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, municipio: true, departamento: true },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({ ...row, id: row.id.toString() }));
  }

  async create(dto: CreateNinoDto, userId: bigint) {
    const birthDate = validateBirthDate(dto.fecha_nacimiento);
    const certificate = this.certificate.protect(dto.certificado);
    const communityId = dto.comunidad_id ? BigInt(dto.comunidad_id) : null;
    if (communityId && communityId > 9223372036854775807n)
      throw new BadRequestException('Comunidad no válida.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (
          communityId &&
          !(await tx.comunidades.findFirst({
            where: { id: communityId, activo: true },
            select: { id: true },
          }))
        ) {
          throw new BadRequestException(
            'La comunidad no existe o está inactiva.',
          );
        }
        const publicCode = ulid();
        const now = new Date();
        const row = await tx.ninos.create({
          data: {
            codigo_publico: publicCode,
            codigo_expediente: `NT-${publicCode}`,
            ...certificate,
            primer_nombre: dto.primer_nombre,
            segundo_nombre: dto.segundo_nombre,
            primer_apellido: dto.primer_apellido,
            segundo_apellido: dto.segundo_apellido,
            fecha_nacimiento: birthDate,
            sexo_biologico: dto.sexo_biologico,
            comunidad_id: communityId,
            direccion_referencia: dto.direccion_referencia,
            registrado_por: userId,
            creado_en: now,
            actualizado_en: now,
          },
          select: { ...publicFields, id: true },
        });
        await tx.registros_auditoria.create({
          data: {
            usuario_id: userId,
            accion: 'INSERTAR',
            entidad: 'ninos',
            entidad_id: row.id.toString(),
            ocurrido_en: now,
            datos_nuevos: JSON.stringify({ codigo_publico: publicCode }),
          },
        });
        const { id: _id, ...safeRow } = row;
        void _id;
        return present(safeRow);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un registro con ese certificado. No se creó otro expediente.',
        );
      }
      throw error;
    }
  }
  async edit(code: string, dto: EditNinoDto, actor: bigint) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ninos WHERE codigo_publico = ${code} FOR UPDATE`;
      const row = await tx.ninos.findUnique({
        where: { codigo_publico: code },
        select: {
          id: true,
          primer_nombre: true,
          segundo_nombre: true,
          primer_apellido: true,
          segundo_apellido: true,
          direccion_referencia: true,
          estado: true,
          version_registro: true,
          archivado_en: true,
        },
      });
      if (!row) throw new NotFoundException('No se encontró el expediente.');
      if (row.version_registro !== dto.version_registro)
        throw new ConflictException(
          'El expediente cambió. Cancela la edición, actualízalo y revisa los datos antes de guardar.',
        );
      const fields = {
        primer_nombre: dto.primer_nombre,
        segundo_nombre: dto.segundo_nombre || null,
        primer_apellido: dto.primer_apellido,
        segundo_apellido: dto.segundo_apellido || null,
        direccion_referencia: dto.direccion_referencia || null,
        estado: dto.estado,
      };
      await tx.ninos.update({
        where: { id: row.id },
        data: {
          ...fields,
          version_registro: { increment: 1 },
          archivado_en:
            dto.estado === 'ARCHIVADO'
              ? (row.archivado_en ?? new Date())
              : null,
        },
      });
      const { id: internalId, ...before } = row;
      void internalId;
      await tx.registros_auditoria.create({
        data: {
          usuario_id: actor,
          accion: 'ACTUALIZAR',
          entidad: 'ninos',
          entidad_id: code,
          datos_anteriores: JSON.stringify(before),
          datos_nuevos: JSON.stringify({
            ...fields,
            version_registro: row.version_registro + 1,
            motivo: dto.motivo,
          }),
        },
      });
      return {
        mensaje: 'Expediente actualizado. Se conserva el historial anterior.',
      };
    });
  }
}
