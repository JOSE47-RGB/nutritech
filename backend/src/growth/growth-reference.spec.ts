import {
  referenceWeight,
  weightWarning,
  localDate,
  periodKey,
} from './growth-reference';
import { lmsScore, type Reference } from '../nutrition/calculator';
import { dateBounds } from './growth.service';
import { monthlyReferences } from './growth-monthly';
const rows: Reference[] = [
  {
    indicator: 'P_E',
    sexo_biologico: 'F',
    edad_dias: 365,
    valor_l: 0,
    valor_m: 9,
    valor_s: 0.1,
  },
  {
    indicator: 'P_E',
    sexo_biologico: 'M',
    edad_dias: 365,
    valor_l: -0.2,
    valor_m: 10,
    valor_s: 0.12,
  },
];
describe('Referencia y fechas de crecimiento', () => {
  it('conserva las medianas mensuales OMS y el cambio a talla de pie a los 24 meses', () => {
    const boys = monthlyReferences('M').filas;
    const girls = monthlyReferences('F').filas;
    expect(boys).toHaveLength(61);
    expect(girls).toHaveLength(61);
    expect(boys[1]).toMatchObject({
      meses: 1,
      peso_kg: 4.4709,
      talla_cm: 54.7244,
    });
    expect(girls[0]).toMatchObject({
      meses: 0,
      peso_kg: 3.2322,
      talla_cm: 49.1477,
    });
    expect(girls[23].tipo_medicion).toBe('LONGITUD_ACOSTADO');
    expect(girls[24]).toMatchObject({
      meses: 24,
      talla_cm: 85.7153,
      tipo_medicion: 'TALLA_DE_PIE',
    });
    expect(girls[60].talla_cm).toBe(109.4233);
    expect(boys[60].peso_kg).toBe(18.3366);
  });
  it('invierte LMS en -2, 0 y +2 sin redondear por sexo', () => {
    for (const row of rows) {
      const result = referenceWeight(rows, row.sexo_biologico, 365)!;
      const lms = {
        l: Number(row.valor_l),
        m: Number(row.valor_m),
        s: Number(row.valor_s),
      };
      expect(result.mediana_kg).toBe(lms.m);
      expect(lmsScore(result.menos2_kg, lms, false)).toBeCloseTo(-2, 10);
      expect(lmsScore(result.mas2_kg, lms, false)).toBeCloseTo(2, 10);
    }
    expect(referenceWeight(rows, 'F', 365)?.mediana_kg).not.toBe(
      referenceWeight(rows, 'M', 365)?.mediana_kg,
    );
  });
  it('no extrapola edades ni usa filas de otro sexo', () => {
    for (const age of [-1, 365.5, 1827, NaN, 0])
      expect(referenceWeight(rows, 'F', age)).toBeNull();
    expect(
      referenceWeight([{ ...rows[0], edad_dias: 1826 }], 'F', 1826),
    ).not.toBeNull();
    expect(referenceWeight([rows[0]], 'M', 365)).toBeNull();
  });
  it('diferencia edema pendiente, presente y una captura extrema', () => {
    expect(weightWarning(rows, 'F', 365, 9, 'DESCONOCIDO')).toMatch(
      /Falta revisar/,
    );
    expect(weightWarning(rows, 'F', 365, 9, 'SI')).toMatch(/Hinchazón/);
    expect(weightWarning(rows, 'F', 365, 100, 'NO')).toMatch(/calidad/);
    expect(weightWarning(rows, 'F', 365, 9, 'NO')).toBeNull();
  });
  it('agrupa con la fecha local de Guatemala, no UTC', () => {
    const date = localDate(new Date('2024-02-01T05:59:59Z'));
    expect(date).toBe('2024-01-31');
    expect(periodKey(date, 'mes')).toBe('2024-01');
    expect(periodKey(date, 'ano')).toBe('2024');
  });
  it('incluye todo el último día y valida fechas reales', () => {
    const range = dateBounds({
      desde: '2024-02-29',
      hasta: '2024-02-29',
      agrupar: 'dia',
    });
    expect(range.gte?.toISOString()).toBe('2024-02-29T06:00:00.000Z');
    expect(range.lt?.toISOString()).toBe('2024-03-01T06:00:00.000Z');
    expect(() => dateBounds({ desde: '2025-02-29', agrupar: 'dia' })).toThrow();
    expect(() =>
      dateBounds({ desde: '2024-03-01', hasta: '2024-02-29', agrupar: 'dia' }),
    ).toThrow();
  });
});
