import type { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import type { recommendations } from '../nutrition/recommendations';
import type { MeasurementReview } from '../nutrition/measurement-review';
import { alertCandidates, ALERT_POLICY_VERSION } from './alert-policy';
export async function generateAlerts(
  tx: Prisma.TransactionClient,
  publicCode: string,
  orientation: ReturnType<typeof recommendations>,
  actor: bigint,
  review: MeasurementReview | null = null,
) {
  const rows = await tx.$queryRaw<
    { id: bigint }[]
  >`SELECT id FROM orientaciones_guardadas WHERE codigo_publico=${publicCode}`;
  if (!rows.length)
    throw Error('Orientación no encontrada para generar avisos');
  for (const candidate of alertCandidates(orientation, review)) {
    const existing = await tx.$queryRaw<
      { id: bigint }[]
    >`SELECT id FROM alertas WHERE orientacion_id=${rows[0].id} AND regla_aviso=${candidate.codigo} AND version_politica=${ALERT_POLICY_VERSION}`;
    if (existing.length) continue;
    const alert = await tx.alertas.create({
      data: {
        codigo_publico: ulid(),
        orientacion_id: rows[0].id,
        nivel: 'OBSERVAR',
        tipo_aviso: candidate.tipo,
        regla_aviso: candidate.codigo,
        version_politica: ALERT_POLICY_VERSION,
        titulo: candidate.titulo,
        mensaje: candidate.mensaje,
      },
    });
    await tx.historial_alerta.create({
      data: {
        alerta_id: alert.id,
        estado_nuevo: 'PENDIENTE',
        comentario: `Generación automática ${ALERT_POLICY_VERSION}`,
      },
    });
    await tx.registros_auditoria.create({
      data: {
        usuario_id: actor,
        accion: 'INSERTAR',
        entidad: 'alertas',
        entidad_id: alert.codigo_publico,
        datos_nuevos: JSON.stringify({
          orientacion: publicCode,
          politica: ALERT_POLICY_VERSION,
        }),
      },
    });
  }
}
