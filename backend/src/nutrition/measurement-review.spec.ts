import { createRequire } from 'node:module';
import {
  NutritionCalculator,
  type Measurement,
  type Reference,
} from './calculator';
import { measurementReview } from './measurement-review';
import { recommendations } from './recommendations';
import { familyGuidance } from './family-guidance';
import { alertCandidates } from '../alerts/alert-policy';

const { loadBundle } = createRequire(__filename)(
  '../../scripts/anthro-import.cjs',
) as { loadBundle: () => { rows: Reference[] } };
const engine = new NutritionCalculator(loadBundle().rows);
const newborn: Measurement = {
  sexo: 'M',
  edad_dias: 0,
  peso_kg: 4,
  talla_cm: 30,
  tipo_medicion: 'LONGITUD_ACOSTADO',
  edema: 'DESCONOCIDO',
};

function assess(input: Measurement) {
  const actual = engine.calculate(input);
  const quality = engine.calculate({ ...input, edema: 'NO' });
  const review = measurementReview(input, quality);
  const orientation = recommendations(actual, input.edema);
  return {
    actual,
    review,
    orientation,
    guide: familyGuidance(
      orientation.indicadores,
      input.edema,
      Boolean(review),
      review,
    ),
  };
}

describe('Confirmación de medidas sin imponer un tamaño estándar', () => {
  it('identifica los 30 cm del ejemplo aunque el edema esté sin revisar', () => {
    const original = { ...newborn };
    const { actual, review, guide } = assess(newborn);
    expect(review?.avisos.map((a) => a.codigo)).toEqual([
      'T_E:CALIDAD',
      'P_T:TALLA_FUERA_DE_COBERTURA',
    ]);
    expect(guide.titulo).toContain('30 cm');
    expect(review?.avisos[0].detalle).toContain('día del nacimiento');
    expect(review?.avisos[1].detalle).toContain('límite pertenece a la tabla');
    expect(review?.si_se_confirma).toContain('conserva el valor real');
    expect(guide.estado_edema).toBe('DESCONOCIDO');
    expect(guide.hallazgos).toEqual([]);
    expect(actual.indicadores.P_E.z).toBeNull();
    expect(newborn).toEqual(original);
  });

  it.each([
    { sexo: 'M' as const, peso_kg: 2.6, talla_cm: 46 },
    { sexo: 'F' as const, peso_kg: 4, talla_cm: 53 },
  ])(
    'acepta tamaños diferentes sin inventar un error para $sexo de $talla_cm cm',
    (values) => {
      const { review, orientation } = assess({
        ...newborn,
        ...values,
        edema: 'NO',
      });
      expect(review).toBeNull();
      expect(orientation.indicadores.every((i) => i.motivo !== 'CALIDAD')).toBe(
        true,
      );
    },
  );

  it('distingue talla baja interpretable de una bandera de calidad', () => {
    const { review, orientation } = assess({
      ...newborn,
      peso_kg: 2.6,
      talla_cm: 46,
      edema: 'NO',
    });
    expect(review).toBeNull();
    expect(
      orientation.indicadores.find((i) => i.indicador === 'T_E')?.regla,
    ).toBe('T_E:TALLA_BAJA');
  });

  it('no presenta los límites de la tabla de peso para talla como límites de captura', () => {
    const { review, orientation } = assess({
      ...newborn,
      peso_kg: 1.5,
      talla_cm: 44,
      edema: 'NO',
    });
    expect(review?.avisos.map((a) => a.codigo)).toContain(
      'P_T:TALLA_FUERA_DE_COBERTURA',
    );
    expect(review?.avisos.map((a) => a.codigo)).not.toContain('T_E:CALIDAD');
    expect(
      orientation.indicadores.find((i) => i.indicador === 'T_E')?.estado,
    ).toBe('ORIENTATIVA');
    expect(
      orientation.indicadores.find((i) => i.indicador === 'P_T')?.regla,
    ).toBeNull();
  });

  it('conserva prioridad a la valoración médica cuando se indica edema presente', () => {
    const { guide, review } = assess({ ...newborn, edema: 'SI' });
    expect(guide.titulo).toContain('valoración médica por hinchazón');
    expect(review?.avisos[0].titulo).toContain('30 cm');
    expect(guide.hallazgos).toEqual([]);
  });

  it('genera avisos de medidas y edema pendiente sin duplicados ni diagnósticos', () => {
    const { orientation, review } = assess(newborn);
    const alerts = alertCandidates(orientation, review);
    expect(alerts.map((a) => a.codigo)).toEqual([
      'EDEMA_DESCONOCIDO',
      'T_E:CALIDAD',
      'P_T:TALLA_FUERA_DE_COBERTURA',
    ]);
    expect(alerts.every((a) => a.tipo === 'DATOS')).toBe(true);
    expect(alerts.every((a) => a.mensaje.length <= 600)).toBe(true);
    expect(alerts.find((a) => a.codigo === 'T_E:CALIDAD')?.titulo).toContain(
      '30 cm',
    );
    const withoutEdema = assess({ ...newborn, edema: 'NO' });
    const confirmed = alertCandidates(
      withoutEdema.orientation,
      withoutEdema.review,
    );
    expect(confirmed.filter((a) => a.codigo === 'T_E:CALIDAD')).toHaveLength(1);
  });

  it('retira el aviso anterior al volver a calcular medidas que no activan banderas', () => {
    expect(assess(newborn).review).not.toBeNull();
    expect(
      assess({ ...newborn, talla_cm: 50, peso_kg: 3.4, edema: 'NO' }).review,
    ).toBeNull();
  });
});
