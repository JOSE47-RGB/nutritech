import { createRequire } from 'node:module';
import {
  NutritionCalculator,
  lmsScore,
  roundEven,
  type Measurement,
  type Reference,
} from './calculator';
import { compareOracle, loadOracle } from './oracle';
import { reviewDraftScore } from './classification-draft';
const { loadBundle } = createRequire(__filename)(
  '../../scripts/anthro-import.cjs',
) as { loadBundle: () => { rows: Reference[] } };
const calculator = new NutritionCalculator(loadBundle().rows);
const base: Measurement = {
  sexo: 'F',
  edad_dias: 731,
  peso_kg: 12,
  talla_cm: 85.25,
  tipo_medicion: 'TALLA_DE_PIE',
  edema: 'NO',
};
describe('Motor técnico OMS', () => {
  it('coincide con todos los casos ejecutados en R oficial', () => {
    const oracle = loadOracle();
    expect(oracle.cases.length).toBe(500);
    expect(compareOracle(calculator, oracle.cases)).toEqual([]);
  });
  it('calcula la mediana, L=0 y extensiones fuera de tres desviaciones', () => {
    expect(lmsScore(10, { l: 1, m: 10, s: 0.1 }, true)).toBe(0);
    expect(lmsScore(Math.E * 10, { l: 0, m: 10, s: 1 }, false)).toBeCloseTo(1);
    expect(lmsScore(14, { l: 1, m: 10, s: 0.1 }, true)).toBeCloseTo(4);
    expect(lmsScore(6, { l: 1, m: 10, s: 0.1 }, true)).toBeCloseTo(-4);
    expect(roundEven(1.125)).toBe(1.12);
    expect(roundEven(1.135)).toBe(1.14);
    expect(roundEven(-1.125)).toBe(-1.12);
  });
  it.each(['P_E', 'T_E', 'P_T', 'IMC_E'] as const)(
    'conserva precisión en %s hasta después de serializar a JSON',
    (indicator) => {
      const value =
        indicator === 'T_E'
          ? base.talla_cm
          : indicator === 'IMC_E'
            ? base.peso_kg / (base.talla_cm / 100) ** 2
            : base.peso_kg;
      const m = value / (1 - 3.004 * 0.1);
      const rows: Reference[] =
        indicator === 'P_T'
          ? [85.2, 85.3].map((talla_cm) => ({
              indicator,
              sexo_biologico: 'F',
              talla_cm,
              tipo_medicion: 'TALLA_DE_PIE',
              valor_l: 1,
              valor_m: m,
              valor_s: 0.1,
            }))
          : [
              {
                indicator,
                sexo_biologico: 'F',
                edad_dias: base.edad_dias,
                valor_l: 1,
                valor_m: m,
                valor_s: 0.1,
              },
            ];
      const output = new NutritionCalculator(rows).calculate(base);
      const decoded = JSON.parse(JSON.stringify(output)) as typeof output;
      const score = decoded.indicadores[indicator];
      expect(score.z).toBeCloseTo(-3.004, 10);
      expect(score.z).toBe(output.indicadores[indicator].z);
      expect(score.z).toBeLessThan(-3);
      expect(score.z!.toFixed(2)).toBe('-3.00');
      const rule = reviewDraftScore(indicator, score).regla;
      expect(rule?.codigo).toContain('SEVER');
      expect(
        reviewDraftScore(indicator, { ...score, z: -3 }).regla?.codigo,
      ).not.toBe(rule?.codigo);
    },
  );
  it('conserva las banderas compatibles con anthro cerca del límite de calidad', () => {
    const engine = new NutritionCalculator([
      {
        indicator: 'P_E',
        sexo_biologico: 'F',
        edad_dias: base.edad_dias,
        valor_l: 1,
        valor_m: 10,
        valor_s: 0.1,
      },
    ]);
    const inside = engine.calculate({ ...base, peso_kg: 15.004 }).indicadores
      .P_E;
    const outside = engine.calculate({ ...base, peso_kg: 15.006 }).indicadores
      .P_E;
    expect(inside.z).toBeCloseTo(5.004, 10);
    expect(inside.fuera_rango_calidad).toBe(false);
    expect(outside.z).toBeCloseTo(5.006, 10);
    expect(outside.fuera_rango_calidad).toBe(true);
  });
  it('no supone ausencia de edema cuando el estado es desconocido', () => {
    const result = calculator.calculate({ ...base, edema: 'DESCONOCIDO' });
    expect(result.indicadores.T_E.z).not.toBeNull();
    for (const key of ['P_E', 'P_T', 'IMC_E'] as const)
      expect(result.indicadores[key]).toEqual({
        z: null,
        fuera_rango_calidad: null,
        motivo: 'EDEMA_DESCONOCIDO',
      });
  });
  it('informa falta de referencia sin fabricar un valor', () => {
    const incomplete = new NutritionCalculator([]);
    expect(incomplete.calculate(base).indicadores.T_E.motivo).toBe(
      'REFERENCIA_AUSENTE',
    );
    expect(
      calculator.calculate({ ...base, talla_cm: 120.01 }).indicadores.P_T
        .motivo,
    ).toBe('TALLA_FUERA_DE_COBERTURA');
  });
  it('acepta el extremo exacto de talla y no extrapola ni omite vecinos', () => {
    expect(
      calculator.calculate({ ...base, talla_cm: 120 }).indicadores.P_T.z,
    ).not.toBeNull();
    const rows = loadBundle().rows.filter(
      (r) =>
        !(
          r.indicator === 'P_T' &&
          r.sexo_biologico === 'F' &&
          r.tipo_medicion === 'TALLA_DE_PIE' &&
          Number(r.talla_cm) === 85.3
        ),
    );
    expect(
      new NutritionCalculator(rows).calculate(base).indicadores.P_T.motivo,
    ).toBe('REFERENCIA_AUSENTE');
  });
  it('rechaza entradas incompletas y referencias duplicadas', () => {
    expect(() => calculator.calculate({ ...base, edad_dias: 0.5 })).toThrow();
    expect(() => calculator.calculate({ ...base, peso_kg: NaN })).toThrow();
    expect(() =>
      calculator.calculate({
        ...base,
        edema: undefined,
      } as unknown as Measurement),
    ).toThrow();
    expect(
      () =>
        new NutritionCalculator([loadBundle().rows[0], loadBundle().rows[0]]),
    ).toThrow('duplicada');
    expect(
      calculator.calculate({ ...base, peso_kg: 0 }).indicadores.P_E.motivo,
    ).toBe('MEDIDA_INVALIDA');
  });
  it('conserva las medidas originales y utiliza IMC con talla ajustada', () => {
    const input = { ...base, tipo_medicion: 'LONGITUD_ACOSTADO' as const };
    const before = { ...input };
    const result = calculator.calculate(input);
    expect(input).toEqual(before);
    expect(result.ajuste_cm).toBe(-0.7);
    expect(result.imc_ajustado).toBeCloseTo(12 / ((85.25 - 0.7) / 100) ** 2);
  });
});
