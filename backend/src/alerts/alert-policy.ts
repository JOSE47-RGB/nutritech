import type { recommendations } from '../nutrition/recommendations';
import type { MeasurementReview } from '../nutrition/measurement-review';
export const ALERT_POLICY_VERSION = 'NUTRITECH-SEGUIMIENTO-2';
export function alertCandidates(
  orientation: ReturnType<typeof recommendations>,
  review: MeasurementReview | null = null,
) {
  const central = new Set([
    'P_E:SIN_BAJO_PESO',
    'T_E:SIN_TALLA_BAJA',
    'P_T:INTERVALO_CENTRAL',
    'IMC_E:INTERVALO_CENTRAL',
  ]);
  const result = new Map<
    string,
    { codigo: string; tipo: string; titulo: string; mensaje: string }
  >();
  for (const item of orientation.indicadores) {
    if (item.estado === 'ORIENTATIVA' && item.regla && central.has(item.regla))
      continue;
    const edema =
      item.motivo === 'EDEMA' || item.motivo === 'EDEMA_DESCONOCIDO';
    const code = edema
      ? item.motivo
      : `${item.indicador}:${item.regla ?? item.motivo}`;
    result.set(code, {
      codigo: code,
      tipo:
        item.estado === 'ORIENTATIVA'
          ? 'HALLAZGO'
          : item.motivo === 'EDEMA'
            ? 'REVISION_CLINICA'
            : 'DATOS',
      titulo: edema
        ? item.motivo === 'EDEMA'
          ? 'Edema registrado: valoración médica'
          : 'Confirmar evaluación del edema'
        : `${item.indicador}: ${item.clasificacion ?? 'Revisar datos'}`,
      mensaje: item.recomendacion,
    });
  }
  for (const issue of review?.avisos ?? []) {
    result.set(issue.codigo, {
      codigo: issue.codigo,
      tipo: 'DATOS',
      titulo: issue.titulo,
      mensaje: `${issue.detalle} Si se confirma, conserva el valor real y solicita valoración del personal de salud.`,
    });
  }
  return [...result.values()];
}
