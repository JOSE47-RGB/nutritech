import { createRequire } from 'node:module';
import {
  NutritionCalculator,
  type Measurement,
  type Reference,
} from './calculator';
import {
  classificationProposal,
  reviewDraftScore,
} from './classification-draft';
const { loadBundle } = createRequire(__filename)(
  '../../scripts/anthro-import.cjs',
) as { loadBundle: () => { rows: Reference[] } };
const engine = new NutritionCalculator(loadBundle().rows);
const base: Measurement = {
  sexo: 'F',
  edad_dias: 731,
  peso_kg: 12,
  talla_cm: 85,
  tipo_medicion: 'TALLA_DE_PIE',
  edema: 'NO',
};
describe('Casos especiales del protocolo en revisión', () => {
  it.each(['SI', 'DESCONOCIDO'] as const)(
    'no interpreta como normal el edema %s',
    (edema) => {
      const result = engine.calculate({ ...base, edema });
      for (const key of ['P_E', 'P_T', 'IMC_E'] as const) {
        expect(result.indicadores[key].motivo).toBe(
          edema === 'SI' ? 'EDEMA' : 'EDEMA_DESCONOCIDO',
        );
        expect(reviewDraftScore(key, result.indicadores[key]).regla).toBeNull();
      }
      expect(result.indicadores.T_E.z).not.toBeNull();
    },
  );
  it('respeta la cobertura exacta de edad del motor sin extrapolar', () => {
    expect(
      engine.calculate({ ...base, edad_dias: 1826 }).indicadores.T_E.z,
    ).not.toBeNull();
    const result = engine.calculate({ ...base, edad_dias: 1827 });
    for (const score of Object.values(result.indicadores)) {
      expect(score.z).toBeNull();
      expect(score.motivo).toBe('EDAD_FUERA_DE_COBERTURA');
    }
  });
  it('mantiene independientes los indicadores si P_T no tiene cobertura', () => {
    const result = engine.calculate({ ...base, talla_cm: 120.01 });
    expect(result.indicadores.P_T.motivo).toBe('TALLA_FUERA_DE_COBERTURA');
    expect(result.indicadores.P_E.z).not.toBeNull();
  });
  it('propaga la marca del método al revisar el borrador', () => {
    const result = engine.calculate({
      ...base,
      edad_dias: 100,
      talla_cm: 60,
      peso_kg: 6,
    });
    expect(result.medicion_pie_menor_9_meses).toBe(true);
    for (const key of ['P_E', 'T_E', 'P_T', 'IMC_E'] as const) {
      expect(
        reviewDraftScore(
          key,
          result.indicadores[key],
          result.medicion_pie_menor_9_meses,
        ),
      ).toEqual({ estado: 'REVISAR_DATOS', regla: null });
    }
  });
  it.each([true, null])('no asigna reglas con calidad %s', (quality) => {
    expect(
      reviewDraftScore('P_T', {
        z: 0,
        motivo: null,
        fuera_rango_calidad: quality,
      }).regla,
    ).toBeNull();
  });
  it('conserva como pendientes el protocolo clínico y la persistencia', () => {
    expect(classificationProposal().protocolo).toMatchObject({
      protocolo_local: 'OMS + MSPAS Guatemala (alcances separados)',
      responsable_clinico: null,
      revision_clinica: 'PENDIENTE',
      permite_persistir: false,
    });
    expect(classificationProposal().protocolo.casos).toHaveLength(9);
    const summary = classificationProposal().protocolo.consolidacion;
    expect(summary.decision_final).toBe('MEDICO');
    expect(summary.fuentes.map((source) => source.id)).toEqual([
      'OMS-2006',
      'OMS-2023',
      'MSPAS-2018',
    ]);
    expect(
      summary.decisiones.some(
        (decision) => decision.estado === 'ALCANCES_DISTINTOS',
      ),
    ).toBe(true);
  });
});
