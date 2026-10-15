import type { Indicator, Measurement, NutritionCalculator } from './calculator';
import {
  DRAFT_RULES,
  matchesRule,
  validateDraft,
} from './classification-draft';

const growthSource = {
  titulo: 'OMS: interpretación de indicadores de crecimiento',
  url: 'https://www.ncbi.nlm.nih.gov/books/NBK148966/',
};
const clinicalSource = {
  titulo: 'OMS 2023: evaluación clínica, A1–A2 y B2',
  url: 'https://www.ncbi.nlm.nih.gov/books/NBK601655/',
};
const localSource = {
  titulo: 'MSPAS 2018: vigilancia, páginas 8–9',
  url: 'https://epidemiologia.mspas.gob.gt/phocadownload/userupload/protocolo-de-vigilancia/vigente/9.pdf',
};
const advice: Record<string, string> = {
  BAJO_PESO_SEVERO:
    'Solicitar valoración médica del bajo peso y revisar los otros indicadores y la evolución.',
  BAJO_PESO:
    'Revisar con el médico la evolución del peso y los demás indicadores.',
  SIN_BAJO_PESO:
    'Interpretar junto con talla, proporcionalidad y evolución; este indicador no descarta otros problemas.',
  CONSULTAR_PROPORCION:
    'Revisar P_T e IMC_E; el peso para la edad no determina sobrepeso u obesidad.',
  TALLA_BAJA_SEVERA:
    'Solicitar valoración médica del crecimiento longitudinal y revisar la evolución.',
  TALLA_BAJA:
    'Revisar el crecimiento longitudinal y su evolución con el médico.',
  SIN_TALLA_BAJA:
    'Interpretar junto con los demás indicadores; la talla no resume el estado nutricional.',
  TALLA_MUY_ALTA:
    'Confirmar medición y revisar el contexto de crecimiento con el médico.',
  EMACIACION_SEVERA:
    'Solicitar valoración médica pronta del hallazgo; la conducta requiere evaluación clínica adicional.',
  EMACIACION:
    'Solicitar valoración médica y revisión de la evolución y alimentación.',
  INTERVALO_CENTRAL:
    'Revisar evolución y contexto clínico; el intervalo central no equivale a una evaluación integral normal.',
  POSIBLE_RIESGO_SOBREPESO:
    'Revisar la tendencia del crecimiento con el médico.',
  SOBREPESO:
    'Solicitar valoración médica de la proporcionalidad y evolución del crecimiento.',
  OBESIDAD:
    'Solicitar valoración médica del hallazgo y del contexto de crecimiento.',
};
const reasons: Record<string, string> = {
  EDEMA:
    'Edema presente: requiere valoración médica. La ausencia de puntaje no significa ausencia de riesgo.',
  EDEMA_DESCONOCIDO:
    'Confirmar y registrar la evaluación del edema; no se supone ausente.',
  EDAD_FUERA_DE_COBERTURA:
    'La edad está fuera de la cobertura del motor; revisar la referencia aplicable.',
  TALLA_FUERA_DE_COBERTURA:
    'Revisar talla y método; no extrapolar la referencia de P_T.',
  REFERENCIA_AUSENTE:
    'Verificar las referencias antes de interpretar este indicador.',
  MEDIDA_INVALIDA:
    'Verificar y corregir la medición original antes de interpretar.',
};
export function recommendations(
  result: ReturnType<NutritionCalculator['calculate']>,
  edema: Measurement['edema'],
) {
  validateDraft();
  const indicadores = (['P_E', 'T_E', 'P_T', 'IMC_E'] as Indicator[]).map(
    (indicador) => {
      const score = result.indicadores[indicador];
      const base = {
        indicador,
        z: score.z,
        fuentes: [growthSource],
        regla: null,
        clasificacion: null,
      };
      // Edema impide una interpretación automática tranquilizadora, incluso de T_E disponible.
      if (edema !== 'NO')
        return {
          ...base,
          estado: 'REQUIERE_REVISION',
          motivo: edema === 'SI' ? 'EDEMA' : 'EDEMA_DESCONOCIDO',
          recomendacion:
            reasons[edema === 'SI' ? 'EDEMA' : 'EDEMA_DESCONOCIDO'],
          fuentes: [clinicalSource],
        };
      if (
        score.z === null ||
        !Number.isFinite(score.z) ||
        score.motivo !== null
      )
        return {
          ...base,
          estado: 'NO_DISPONIBLE',
          motivo: score.motivo ?? 'PUNTAJE_NO_DISPONIBLE',
          recomendacion:
            reasons[score.motivo ?? ''] ??
            'No hay un puntaje utilizable; revisar los datos.',
        };
      if (
        score.fuera_rango_calidad !== false ||
        result.medicion_pie_menor_9_meses
      )
        return {
          ...base,
          estado: 'REQUIERE_REVISION',
          motivo: result.medicion_pie_menor_9_meses ? 'METODO' : 'CALIDAD',
          recomendacion:
            'Revisar la medición y el método antes de asignar una clasificación.',
        };
      const matches = DRAFT_RULES.filter(
        (rule) => rule.indicador === indicador && matchesRule(rule, score.z!),
      );
      if (matches.length !== 1 || !advice[matches[0].codigo])
        throw new Error('Regla orientativa no definida');
      const rule = matches[0];
      return {
        ...base,
        estado: 'ORIENTATIVA',
        motivo: `El puntaje sin redondear coincide con ${indicador}:${rule.codigo}.`,
        regla: `${indicador}:${rule.codigo}`,
        clasificacion: rule.etiqueta,
        recomendacion: advice[rule.codigo],
      };
    },
  );
  return {
    version: 'NUTRITECH-ORIENTACION-1',
    version_reglas: 'OMS-CRECIMIENTO-BORRADOR-1',
    decision_final: 'MEDICO',
    persistida: false,
    indicadores,
    avisos: [
      {
        texto:
          'Sugerencias de apoyo redactadas para NutriTech; no son un diagnóstico ni una prescripción. El médico debe integrar la edad, especialmente en menores de seis meses, y la evaluación clínica.',
        fuente: clinicalSource,
      },
      {
        texto:
          'Perímetro braquial, apetito, signos de peligro y grado de edema no están capturados aquí. No se puede determinar con estos resultados si corresponde atención ambulatoria u hospitalaria.',
        fuente: clinicalSource,
      },
      {
        texto:
          'La orientación clínica no equivale a notificación epidemiológica ni determina su elegibilidad. El protocolo local de vigilancia tiene un alcance diferente.',
        fuente: localSource,
      },
    ],
  };
}
