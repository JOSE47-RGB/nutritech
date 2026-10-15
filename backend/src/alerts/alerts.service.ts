import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AlertChange, AlertQuery } from './alerts.dto';
import type { alertas_estado } from '@prisma/client';
@Injectable()
export class AlertsService {
  constructor(
    private readonly db: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}
  async list(query: AlertQuery, actor: bigint) {
    const where = query.estado ? { estado: query.estado } : {};
    const [total, rows] = await this.db.$transaction([
      this.db.alertas.count({ where }),
      this.db.alertas.findMany({
        where,
        orderBy: [{ generada_en: 'desc' }, { id: 'desc' }],
        skip: (query.pagina - 1) * 20,
        take: 20,
        select: {
          codigo_publico: true,
          titulo: true,
          mensaje: true,
          estado: true,
          tipo_aviso: true,
          revision: true,
          generada_en: true,
          orientacion: {
            select: {
              codigo_publico: true,
              evaluacion: {
                select: {
                  codigo_publico: true,
                  estado: true,
                  ninos: {
                    select: {
                      codigo_expediente: true,
                      primer_nombre: true,
                      primer_apellido: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    return {
      total,
      pagina: query.pagina,
      paginas: Math.max(1, Math.ceil(total / 20)),
      puede_atender: (await this.permissions.forUser(actor)).includes(
        'alertas.atender',
      ),
      datos: rows,
    };
  }
  async detail(code: string) {
    const row = await this.db.alertas.findUnique({
      where: { codigo_publico: code },
      include: {
        orientacion: true,
        historial_alerta: {
          orderBy: [{ cambiado_en: 'asc' }, { id: 'asc' }],
          include: { usuarios: { select: { codigo_acceso: true } } },
        },
      },
    });
    if (!row) throw new NotFoundException('No se encontró la alerta.');
    let content: Record<string, unknown> | null = null;
    if (row.orientacion) {
      if (
        createHash('sha256').update(row.orientacion.contenido).digest('hex') !==
        row.orientacion.contenido_sha256
      )
        throw new ConflictException(
          'La orientación de origen no supera la verificación de integridad.',
        );
      content = JSON.parse(row.orientacion.contenido) as Record<
        string,
        unknown
      >;
    }
    return {
      codigo_publico: row.codigo_publico,
      estado: row.estado,
      revision: row.revision,
      politica: row.version_politica,
      regla: row.regla_aviso,
      orientacion: content,
      historial: row.historial_alerta.map((h) => ({
        anterior: h.estado_anterior,
        nuevo: h.estado_nuevo,
        comentario: h.comentario,
        fecha: h.cambiado_en,
        autor: h.usuarios?.codigo_acceso ?? 'Sistema',
      })),
    };
  }
  async change(code: string, dto: AlertChange, actor: bigint) {
    await this.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { id: bigint }[]
      >`SELECT id FROM alertas WHERE codigo_publico=${code} FOR UPDATE`;
      if (!locked.length)
        throw new NotFoundException('No se encontró la alerta.');
      const row = await tx.alertas.findUniqueOrThrow({
        where: { id: locked[0].id },
        include: {
          orientacion: {
            include: { evaluacion: { select: { estado: true } } },
          },
        },
      });
      if (row.revision !== dto.revision)
        throw new ConflictException(
          'La alerta cambió. Actualiza la bandeja antes de continuar.',
        );
      const transitions: Record<alertas_estado, alertas_estado[]> = {
        PENDIENTE: ['EN_REVISION', 'DESCARTADA'],
        EN_REVISION: ['ATENDIDA', 'DESCARTADA'],
        ATENDIDA: ['EN_REVISION'],
        DESCARTADA: ['EN_REVISION'],
      };
      if (!transitions[row.estado].includes(dto.estado))
        throw new ConflictException('Cambio de estado no permitido.');
      if (
        row.orientacion?.evaluacion.estado === 'ANULADA' &&
        dto.estado !== 'DESCARTADA'
      )
        throw new ConflictException(
          'La evaluación está anulada; solo se permite descartar con justificación.',
        );
      const terminal = dto.estado === 'ATENDIDA' || dto.estado === 'DESCARTADA';
      await tx.alertas.update({
        where: { id: row.id },
        data: {
          estado: dto.estado,
          revision: { increment: 1 },
          asignada_a: actor,
          revisada_por: terminal ? actor : null,
          revisada_en: terminal ? new Date() : null,
          observacion_revision: dto.comentario,
        },
      });
      await tx.historial_alerta.create({
        data: {
          alerta_id: row.id,
          estado_anterior: row.estado,
          estado_nuevo: dto.estado,
          cambiado_por: actor,
          comentario: dto.comentario,
        },
      });
      await tx.registros_auditoria.create({
        data: {
          usuario_id: actor,
          accion: 'ACTUALIZAR',
          entidad: 'alertas',
          entidad_id: code,
          datos_nuevos: JSON.stringify({
            anterior: row.estado,
            nuevo: dto.estado,
            revision: row.revision + 1,
          }),
        },
      });
    });
    return {
      codigo_publico: code,
      estado: dto.estado,
      revision: dto.revision + 1,
    };
  }
}
