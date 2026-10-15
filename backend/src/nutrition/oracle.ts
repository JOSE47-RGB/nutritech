// Utilidades de verificación, sin rutas HTTP ni escritura clínica.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NutritionCalculator, roundEven, type Measurement } from './calculator';
interface Expected {
  clenhei: number;
  cbmi: number;
  cmeasure: 'l' | 'h' | null;
  c9mo_flag: number;
  zlen: number | null;
  zwei: number | null;
  zwfl: number | null;
  zbmi: number | null;
  flen: number | null;
  fwei: number | null;
  fwfl: number | null;
  fbmi: number | null;
}
export interface OracleCase {
  input: Measurement;
  expected: Expected;
}
export function loadOracle() {
  return JSON.parse(
    readFileSync(
      resolve(
        __dirname,
        '../../../database/references/anthro-1.1.0/oracle-cases.json',
      ),
      'utf8',
    ),
  ) as { commit: string; runtime: string; cases: OracleCase[] };
}
export function compareOracle(
  calculator: NutritionCalculator,
  cases: OracleCase[],
) {
  const failures: {
    case: number;
    field: string;
    actual: unknown;
    expected: unknown;
  }[] = [];
  cases.forEach(({ input, expected }, index) => {
    const result = calculator.calculate(input);
    // El oráculo oficial expone dos decimales; el motor conserva más precisión.
    const rounded = (z: number | null) => (z === null ? null : roundEven(z));
    const actual = {
      clenhei: result.talla_ajustada_cm,
      cbmi: result.imc_ajustado,
      cmeasure:
        result.metodo_depurado === null
          ? null
          : result.metodo_depurado === 'TALLA_DE_PIE'
            ? 'h'
            : 'l',
      c9mo_flag: Number(result.medicion_pie_menor_9_meses),
      zlen: rounded(result.indicadores.T_E.z),
      zwei: rounded(result.indicadores.P_E.z),
      zwfl: rounded(result.indicadores.P_T.z),
      zbmi: rounded(result.indicadores.IMC_E.z),
      flen:
        result.indicadores.T_E.fuera_rango_calidad === null
          ? null
          : Number(result.indicadores.T_E.fuera_rango_calidad),
      fwei:
        result.indicadores.P_E.fuera_rango_calidad === null
          ? null
          : Number(result.indicadores.P_E.fuera_rango_calidad),
      fwfl:
        result.indicadores.P_T.fuera_rango_calidad === null
          ? null
          : Number(result.indicadores.P_T.fuera_rango_calidad),
      fbmi:
        result.indicadores.IMC_E.fuera_rango_calidad === null
          ? null
          : Number(result.indicadores.IMC_E.fuera_rango_calidad),
    };
    for (const field of Object.keys(expected) as (keyof Expected)[]) {
      const a = actual[field];
      const e = expected[field];
      const match =
        typeof a === 'number' && typeof e === 'number'
          ? Math.abs(a - e) <
            (field === 'clenhei' || field === 'cbmi' ? 1e-10 : 1e-9)
          : a === e;
      if (!match) failures.push({ case: index, field, actual: a, expected: e });
    }
  });
  return failures;
}
