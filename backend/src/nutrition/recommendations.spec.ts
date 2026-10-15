import { recommendations } from './recommendations';
import { NutritionCalculator, type Indicator } from './calculator';
const result = () => {
  const output = new NutritionCalculator([]).calculate({
    sexo: 'F',
    edad_dias: 731,
    peso_kg: 12,
    talla_cm: 85,
    tipo_medicion: 'TALLA_DE_PIE',
    edema: 'NO',
  });
  for (const key of Object.keys(output.indicadores) as Indicator[])
    output.indicadores[key] = {
      z: 0,
      motivo: null,
      fuera_rango_calidad: false,
    };
  return output;
};
describe('Orientación por evaluación', () => {
  it('conserva el lado correcto del límite sin redondear', () => {
    const output = result();
    output.indicadores.P_T.z = -3.004;
    const item = recommendations(output, 'NO').indicadores.find(
      (row) => row.indicador === 'P_T',
    )!;
    expect(item.regla).toBe('P_T:EMACIACION_SEVERA');
    expect(item.z).toBe(-3.004);
    output.indicadores.P_T.z = -3;
    expect(
      recommendations(output, 'NO').indicadores.find(
        (row) => row.indicador === 'P_T',
      )!.regla,
    ).toBe('P_T:EMACIACION');
  });
  it.each(['SI', 'DESCONOCIDO'] as const)(
    'retiene la interpretación incluso de talla con edema %s',
    (edema) => {
      expect(
        recommendations(result(), edema).indicadores.every(
          (row) =>
            row.clasificacion === null && row.estado === 'REQUIERE_REVISION',
        ),
      ).toBe(true);
    },
  );
  it.each([true, null])('no clasifica calidad %s', (quality) => {
    const output = result();
    output.indicadores.P_E.fuera_rango_calidad = quality;
    expect(
      recommendations(output, 'NO').indicadores[0].clasificacion,
    ).toBeNull();
  });
  it('no clasifica métodos marcados', () => {
    const output = result();
    output.medicion_pie_menor_9_meses = true;
    expect(
      recommendations(output, 'NO').indicadores.every(
        (row) => row.clasificacion === null,
      ),
    ).toBe(true);
  });
  it.each([null, NaN, Infinity])(
    'no interpreta como normal el puntaje %s',
    (z) => {
      const output = result();
      output.indicadores.P_E.z = z;
      expect(recommendations(output, 'NO').indicadores[0].estado).toBe(
        'NO_DISPONIBLE',
      );
    },
  );
  it('mantiene independencia entre indicadores y motivos de ausencia', () => {
    const output = result();
    output.indicadores.P_T = {
      z: null,
      motivo: 'TALLA_FUERA_DE_COBERTURA',
      fuera_rango_calidad: null,
    };
    const view = recommendations(output, 'NO');
    expect(view.indicadores[0].estado).toBe('ORIENTATIVA');
    expect(
      view.indicadores.find((row) => row.indicador === 'P_T')!.motivo,
    ).toBe('TALLA_FUERA_DE_COBERTURA');
    expect(view.persistida).toBe(false);
    expect(view.decision_final).toBe('MEDICO');
    expect(
      view.indicadores.every(
        (row) => row.fuentes.length > 0 && row.recomendacion.length > 0,
      ),
    ).toBe(true);
  });
});
