import { CONSOLIDATED_PROTOCOL } from './consolidated-protocol';
import type { Indicator, Score } from './calculator';

export interface DraftRule {
  codigo: string;
  indicador: Indicator;
  etiqueta: string;
  z_min: number | null;
  z_max: number | null;
  incluye_min: boolean;
  incluye_max: boolean;
}
const rule = (
  indicador: Indicator,
  codigo: string,
  etiqueta: string,
  z_min: number | null,
  z_max: number | null,
  incluye_min: boolean,
  incluye_max: boolean,
): DraftRule => ({
  indicador,
  codigo,
  etiqueta,
  z_min,
  z_max,
  incluye_min,
  incluye_max,
});
const lowWeightRules = (indicator: 'P_T' | 'IMC_E'): DraftRule[] => [
  rule(
    indicator,
    'EMACIACION_SEVERA',
    'Emaciación severa',
    null,
    -3,
    false,
    false,
  ),
  rule(indicator, 'EMACIACION', 'Emaciación', -3, -2, true, false),
  rule(
    indicator,
    'INTERVALO_CENTRAL',
    'Dentro del intervalo central de este indicador',
    -2,
    1,
    true,
    true,
  ),
  rule(
    indicator,
    'POSIBLE_RIESGO_SOBREPESO',
    'Posible riesgo de sobrepeso',
    1,
    2,
    false,
    true,
  ),
  rule(indicator, 'SOBREPESO', 'Sobrepeso', 2, 3, false, true),
  rule(indicator, 'OBESIDAD', 'Obesidad', 3, null, false, false),
];
export const DRAFT_RULES: readonly DraftRule[] = [
  rule(
    'P_E',
    'BAJO_PESO_SEVERO',
    'Bajo peso severo para la edad',
    null,
    -3,
    false,
    false,
  ),
  rule('P_E', 'BAJO_PESO', 'Bajo peso para la edad', -3, -2, true, false),
  rule('P_E', 'SIN_BAJO_PESO', 'Sin bajo peso según P_E', -2, 1, true, true),
  rule(
    'P_E',
    'CONSULTAR_PROPORCION',
    'Interpretar con P_T o IMC_E',
    1,
    null,
    false,
    false,
  ),
  rule(
    'T_E',
    'TALLA_BAJA_SEVERA',
    'Talla baja severa para la edad',
    null,
    -3,
    false,
    false,
  ),
  rule('T_E', 'TALLA_BAJA', 'Talla baja para la edad', -3, -2, true, false),
  rule('T_E', 'SIN_TALLA_BAJA', 'Sin talla baja según T_E', -2, 3, true, true),
  rule(
    'T_E',
    'TALLA_MUY_ALTA',
    'Talla muy alta: interpretar el contexto',
    3,
    null,
    false,
    false,
  ),
  ...lowWeightRules('P_T'),
  ...lowWeightRules('IMC_E'),
];
// Describe el comportamiento técnico existente; no es un protocolo asistencial.
export const SPECIAL_CASES = [
  {
    codigo: 'EDEMA',
    caso: 'Edema presente',
    comportamiento:
      'P_E, P_T e IMC_E no disponibles. T_E puede calcularse por separado; no resume el estado nutricional.',
    pendiente:
      'Definir evaluación clínica y derivación según el protocolo aplicable.',
  },
  {
    codigo: 'EDEMA_DESCONOCIDO',
    caso: 'Edema desconocido',
    comportamiento:
      'No se supone ausencia de edema. Los indicadores dependientes del peso quedan no disponibles.',
    pendiente: 'Confirmar y registrar la evaluación del edema.',
  },
  {
    codigo: 'EDAD_FUERA_DE_COBERTURA',
    caso: 'Edad fuera de cobertura',
    comportamiento:
      'No se calculan indicadores fuera de la cobertura del motor. No se extrapolan referencias.',
    pendiente: 'Definir otro patrón para edades no cubiertas.',
  },
  {
    codigo: 'TALLA_FUERA_DE_COBERTURA',
    caso: 'Talla fuera de cobertura para P_T',
    comportamiento:
      'P_T queda no disponible; los demás indicadores se evalúan independientemente.',
    pendiente:
      'Revisar medición y método sin reemplazar P_T por otro indicador automáticamente.',
  },
  {
    codigo: 'REFERENCIA_AUSENTE',
    caso: 'Referencia ausente o alterada',
    comportamiento:
      'El motor devuelve un motivo si falta una fila; la API bloquea el cálculo si el conjunto no supera la verificación.',
    pendiente: 'Restaurar y verificar las referencias antes de reintentar.',
  },
  {
    codigo: 'MEDIDA_INVALIDA',
    caso: 'Medida inválida',
    comportamiento:
      'Las entradas no finitas se rechazan y las medidas no positivas no generan un puntaje utilizable.',
    pendiente: 'Corregir el dato desde su medición original.',
  },
  {
    codigo: 'CALIDAD',
    caso: 'Bandera de calidad',
    comportamiento:
      'El puntaje puede mostrarse para revisión; el borrador no asigna una regla con calidad marcada o desconocida.',
    pendiente: 'Definir quién confirma o corrige la medición.',
  },
  {
    codigo: 'METODO',
    caso: 'Método de medición marcado',
    comportamiento:
      'La medición de pie por debajo del umbral de 9 meses del motor requiere revisión. El borrador no asigna regla cuando recibe esa marca.',
    pendiente:
      'Revisar el método registrado; conservar la medida original y cualquier ajuste.',
  },
  {
    codigo: 'INTERPRETACION',
    caso: 'Indicadores con resultados distintos',
    comportamiento:
      'Se mantienen separados. P_E no determina obesidad y T_E no resume el estado nutricional completo.',
    pendiente:
      'Definir interpretación conjunta, menores de 6 meses y otros criterios clínicos antes de generar prioridades.',
  },
] as const;

export function classificationProposal() {
  return {
    version: 'OMS-CRECIMIENTO-BORRADOR-1',
    poblacion: 'Menores de 5 años; sujetos a la cobertura del motor OMS-2006',
    estado: 'BORRADOR',
    activa: false,
    revision_clinica: 'PENDIENTE',
    revision_tecnica: validateDraft(),
    nivel_revision: null,
    genera_alerta: false,
    fuentes: [
      {
        titulo: 'OMS: indicadores de crecimiento y límites exactos',
        url: 'https://www.ncbi.nlm.nih.gov/books/NBK148966/',
      },
      {
        titulo: 'OMS: tabla 4 y notas por indicador',
        url: 'https://www.ncbi.nlm.nih.gov/books/NBK148966/table/session5.t1/?report=objectonly',
      },
      {
        titulo: 'OMS EMRO: tabla de 0–5 años, página impresa 24',
        url: 'https://www.emro.who.int/images/stories/nutrition/Child-growth-monitoring-a-technical-guide-for-healtcare-professionals.pdf#page=26',
      },
    ],
    pendientes: [
      'Revisión de las etiquetas y del protocolo aplicable por el responsable clínico del proyecto.',
      'Definir prioridades de atención y condiciones de alertas; ninguna se infiere de los colores.',
      'Usar el puntaje sin redondear del motor al implementar la persistencia de clasificaciones.',
      'Definir evaluación del edema bilateral, casos fuera de cobertura y datos con banderas de calidad.',
    ],
    protocolo: {
      version: 'REVISION-TECNICA-1',
      protocolo_local: 'OMS + MSPAS Guatemala (alcances separados)',
      consolidacion: CONSOLIDATED_PROTOCOL,
      responsable_clinico: null,
      revision_clinica: 'PENDIENTE',
      permite_persistir: false,
      casos: SPECIAL_CASES,
    },
    reglas: DRAFT_RULES,
  };
}
export function matchesRule(rule: DraftRule, z: number) {
  return (
    Number.isFinite(z) &&
    (rule.z_min === null ||
      (rule.incluye_min ? z >= rule.z_min : z > rule.z_min)) &&
    (rule.z_max === null ||
      (rule.incluye_max ? z <= rule.z_max : z < rule.z_max))
  );
}
export function validateDraft(rules: readonly DraftRule[] = DRAFT_RULES) {
  for (const indicator of ['P_E', 'T_E', 'P_T', 'IMC_E'] as const) {
    const group = rules
      .filter((r) => r.indicador === indicator)
      .sort((a, b) => (a.z_min ?? -Infinity) - (b.z_min ?? -Infinity));
    if (
      !group.length ||
      group[0].z_min !== null ||
      group[group.length - 1].z_max !== null
    )
      throw Error(`Cobertura incompleta: ${indicator}`);
    const codes = new Set<string>();
    group.forEach((r, i) => {
      if (codes.has(r.codigo)) throw Error('Código duplicado');
      codes.add(r.codigo);
      if (
        (r.z_min !== null && !Number.isFinite(r.z_min)) ||
        (r.z_max !== null && !Number.isFinite(r.z_max)) ||
        (r.z_min !== null && r.z_max !== null && r.z_min >= r.z_max)
      )
        throw Error('Intervalo inválido');
      if (i) {
        const prior = group[i - 1];
        if (
          prior.z_max === null ||
          r.z_min === null ||
          prior.z_max !== r.z_min ||
          prior.incluye_max === r.incluye_min
        )
          throw Error(`Hueco o solapamiento: ${indicator}`);
      }
    });
  }
  if (rules.some((r) => !['P_E', 'T_E', 'P_T', 'IMC_E'].includes(r.indicador)))
    throw Error('Indicador desconocido');
  return { reglas: rules.length, indicadores: 4, huecos: 0, solapamientos: 0 };
}
// Exclusivamente para pruebas de la propuesta. No se conecta a resultados clínicos.
export function reviewDraftScore(
  indicator: Indicator,
  score: Score,
  methodNeedsReview = false,
) {
  if (score.z === null || score.motivo !== null || !Number.isFinite(score.z))
    return { estado: 'NO_DISPONIBLE', regla: null };
  if (score.fuera_rango_calidad !== false || methodNeedsReview)
    return { estado: 'REVISAR_DATOS', regla: null };
  const matches = DRAFT_RULES.filter(
    (r) => r.indicador === indicator && matchesRule(r, score.z!),
  );
  if (matches.length !== 1) throw Error('No hay una regla única');
  return { estado: 'BORRADOR', regla: matches[0] };
}
