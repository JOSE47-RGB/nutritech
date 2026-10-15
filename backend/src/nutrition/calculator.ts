// SPDX-License-Identifier: GPL-3.0-only
// Adaptación de los procedimientos de anthro 1.1.0 (World Health Organization y colaboradores).
/** Motor técnico de comparación con anthro 1.1.0; no clasifica ni persiste resultados.
 * Referencia metodológica y código de contraste: database/references/anthro-1.1.0/calculation-source.
 */
export type Indicator = 'P_E' | 'T_E' | 'IMC_E' | 'P_T';
export type Sex = 'M' | 'F';
export type Method = 'LONGITUD_ACOSTADO' | 'TALLA_DE_PIE';
export interface Reference {
  indicator: Indicator;
  sexo_biologico: Sex;
  valor_l: string | number;
  valor_m: string | number;
  valor_s: string | number;
  edad_dias?: number;
  talla_cm?: string | number;
  tipo_medicion?: Method;
}
export interface Measurement {
  sexo: Sex;
  edad_dias: number;
  peso_kg: number;
  talla_cm: number;
  tipo_medicion: Method;
  edema: 'SI' | 'NO' | 'DESCONOCIDO';
}
interface LMS {
  l: number;
  m: number;
  s: number;
}
export type Reason =
  | 'EDAD_FUERA_DE_COBERTURA'
  | 'MEDIDA_INVALIDA'
  | 'EDEMA'
  | 'EDEMA_DESCONOCIDO'
  | 'TALLA_FUERA_DE_COBERTURA'
  | 'REFERENCIA_AUSENTE';
export interface Score {
  /** Puntaje sin redondeo de salida; usar este valor para comparar límites. */
  z: number | null;
  fuera_rango_calidad: boolean | null;
  motivo: Reason | null;
}
const unavailable = (motivo: Reason): Score => ({
  z: null,
  fuera_rango_calidad: null,
  motivo,
});
const indicators: Indicator[] = ['P_E', 'T_E', 'IMC_E', 'P_T'];
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
// Compatibilidad con la salida y las banderas de anthro (empates al par).
// No aplicar al puntaje que se devuelve para comparar límites.
export function roundEven(value: number, digits = 2) {
  const scale = 10 ** digits;
  const scaled = Math.abs(value) * scale;
  const lower = Math.floor(scaled);
  const fraction = scaled - lower;
  const tolerance = Number.EPSILON * Math.max(1, scaled) * 4;
  const result =
    Math.abs(fraction - 0.5) <= tolerance
      ? lower + (lower % 2)
      : Math.round(scaled);
  return (Math.sign(value) * result) / scale || 0;
}
export function lmsScore(value: number, { l, m, s }: LMS, extended: boolean) {
  assert(
    Number.isFinite(value) &&
      value > 0 &&
      Number.isFinite(l) &&
      m > 0 &&
      s > 0 &&
      Number.isFinite(m) &&
      Number.isFinite(s),
    'LMS o medida inválidos',
  );
  let z =
    l === 0
      ? Math.log(value / m) / s
      : Math.expm1(l * Math.log(value / m)) / (l * s);
  if (extended && Math.abs(z) > 3) {
    const at = (sd: number) =>
      l === 0 ? m * Math.exp(s * sd) : m * (1 + l * s * sd) ** (1 / l);
    const anchor = z > 3 ? 3 : -3;
    const step = z > 3 ? at(3) - at(2) : at(-2) - at(-3);
    z = anchor + (value - at(anchor)) / step;
  }
  assert(Number.isFinite(z), 'El cálculo no produjo un resultado finito');
  return z;
}
export class NutritionCalculator {
  private readonly rows = new Map<string, LMS>();
  constructor(references: Reference[]) {
    for (const row of references) {
      assert(
        indicators.includes(row.indicator) &&
          ['M', 'F'].includes(row.sexo_biologico),
        'Referencia no reconocida',
      );
      const lms = {
        l: Number(row.valor_l),
        m: Number(row.valor_m),
        s: Number(row.valor_s),
      };
      assert(
        Object.values(lms).every(Number.isFinite) && lms.m > 0 && lms.s > 0,
        'Coeficientes inválidos',
      );
      let key: string;
      if (row.indicator === 'P_T') {
        const ticks = Number(row.talla_cm) * 10;
        assert(
          Number.isInteger(ticks) &&
            ticks >= 300 &&
            ticks <= 1500 &&
            ['LONGITUD_ACOSTADO', 'TALLA_DE_PIE'].includes(
              row.tipo_medicion ?? '',
            ),
          'Eje de talla inválido',
        );
        key = `${row.indicator}:${row.sexo_biologico}:${row.tipo_medicion}:${ticks}`;
      } else {
        assert(
          Number.isInteger(row.edad_dias) && row.edad_dias! >= 0,
          'Eje de edad inválido',
        );
        key = `${row.indicator}:${row.sexo_biologico}:${row.edad_dias}`;
      }
      assert(!this.rows.has(key), `Referencia duplicada: ${key}`);
      this.rows.set(key, lms);
    }
  }
  calculate(input: Measurement) {
    assert(['M', 'F'].includes(input.sexo), 'Sexo requerido');
    assert(
      Number.isInteger(input.edad_dias) && input.edad_dias >= 0,
      'Edad requerida en días enteros no negativos',
    );
    assert(
      ['LONGITUD_ACOSTADO', 'TALLA_DE_PIE'].includes(input.tipo_medicion),
      'Método de medición requerido',
    );
    assert(
      ['SI', 'NO', 'DESCONOCIDO'].includes(input.edema),
      'Estado de edema requerido',
    );
    assert(
      Number.isFinite(input.peso_kg) && Number.isFinite(input.talla_cm),
      'Medidas numéricas finitas requeridas',
    );
    const days = input.edad_dias;
    const implausibleMethod =
      days / 30.4375 < 9 && input.tipo_medicion === 'TALLA_DE_PIE';
    const cleanedMethod = implausibleMethod ? null : input.tipo_medicion;
    const adjustment =
      days < 731 && cleanedMethod === 'TALLA_DE_PIE'
        ? 0.7
        : days >= 731 && cleanedMethod === 'LONGITUD_ACOSTADO'
          ? -0.7
          : 0;
    const adjustedHeight = input.talla_cm + adjustment;
    const bmi =
      input.peso_kg > 0 && adjustedHeight > 0
        ? input.peso_kg / (adjustedHeight / 100) ** 2
        : null;
    const results = {} as Record<Indicator, Score>;
    for (const indicator of indicators) {
      if (days / 30.4375 >= 60) {
        results[indicator] = unavailable('EDAD_FUERA_DE_COBERTURA');
        continue;
      }
      if (indicator !== 'T_E' && input.edema !== 'NO') {
        results[indicator] = unavailable(
          input.edema === 'SI' ? 'EDEMA' : 'EDEMA_DESCONOCIDO',
        );
        continue;
      }
      const value =
        indicator === 'T_E'
          ? adjustedHeight
          : indicator === 'IMC_E'
            ? bmi
            : input.peso_kg;
      if (
        value === null ||
        value <= 0 ||
        (indicator === 'P_T' && adjustedHeight <= 0)
      ) {
        results[indicator] = unavailable('MEDIDA_INVALIDA');
        continue;
      }
      let lms: LMS | undefined;
      if (indicator === 'P_T') {
        const method: Method =
          days < 731 ? 'LONGITUD_ACOSTADO' : 'TALLA_DE_PIE';
        const min = days < 731 ? 45 : 65;
        const max = days < 731 ? 110 : 120;
        if (adjustedHeight < min || adjustedHeight > max) {
          results[indicator] = unavailable('TALLA_FUERA_DE_COBERTURA');
          continue;
        }
        const position = Math.round(adjustedHeight * 10 * 1e8) / 1e8;
        const low = Math.floor(position);
        const fraction = position - low;
        const lower = this.rows.get(`P_T:${input.sexo}:${method}:${low}`);
        const upper =
          fraction === 0
            ? lower
            : this.rows.get(`P_T:${input.sexo}:${method}:${low + 1}`);
        if (lower && upper)
          lms = {
            l: lower.l + fraction * (upper.l - lower.l),
            m: lower.m + fraction * (upper.m - lower.m),
            s: lower.s + fraction * (upper.s - lower.s),
          };
      } else lms = this.rows.get(`${indicator}:${input.sexo}:${days}`);
      if (!lms) {
        results[indicator] = unavailable('REFERENCIA_AUSENTE');
        continue;
      }
      const z = lmsScore(value, lms, indicator !== 'T_E');
      // anthro calcula sus banderas sobre el puntaje redondeado.
      // Se mantiene ese contrato de calidad sin recortar el valor de z.
      const qualityZ = roundEven(z);
      const [min, max] =
        indicator === 'P_E' ? [-6, 5] : indicator === 'T_E' ? [-6, 6] : [-5, 5];
      results[indicator] = {
        z,
        fuera_rango_calidad: qualityZ < min || qualityZ > max,
        motivo: null,
      };
    }
    return {
      version_motor: 'nutritech-anthro-1.1.0-v2',
      talla_original_cm: input.talla_cm,
      talla_ajustada_cm: adjustedHeight,
      ajuste_cm: adjustment,
      metodo_depurado: cleanedMethod,
      medicion_pie_menor_9_meses: implausibleMethod,
      imc_ajustado: bmi,
      indicadores: results,
    };
  }
}
