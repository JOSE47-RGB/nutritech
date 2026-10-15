import { familyGuidance } from './family-guidance';
import { recommendations } from './recommendations';
import { NutritionCalculator, type Indicator } from './calculator';
const scores = () => {
  const result = new NutritionCalculator([]).calculate({
    sexo: 'F',
    edad_dias: 731,
    peso_kg: 12,
    talla_cm: 85,
    tipo_medicion: 'TALLA_DE_PIE',
    edema: 'NO',
  });
  for (const key of Object.keys(result.indicadores) as Indicator[])
    result.indicadores[key] = {
      z: 0,
      motivo: null,
      fuera_rango_calidad: false,
    };
  return result;
};
describe('Explicación familiar sin cambiar la clasificación', () => {
  it('explica obesidad a partir de la regla validada, no del peso por sí solo', () => {
    const data = scores();
    data.indicadores.P_E.z = 3.5;
    expect(
      familyGuidance(recommendations(data, 'NO').indicadores, 'NO').titulo,
    ).not.toContain('obesidad');
    data.indicadores.P_T.z = 3.1;
    expect(
      familyGuidance(recommendations(data, 'NO').indicadores, 'NO').titulo,
    ).toContain('obesidad');
  });
  it('conserva el límite sin redondear de desnutrición severa', () => {
    const data = scores();
    data.indicadores.P_T.z = -3.004;
    expect(
      familyGuidance(recommendations(data, 'NO').indicadores, 'NO').titulo,
    ).toContain('aguda severa');
    data.indicadores.P_T.z = -3;
    expect(
      familyGuidance(recommendations(data, 'NO').indicadores, 'NO').titulo,
    ).not.toContain('severa');
  });
  it.each(['SI', 'DESCONOCIDO'] as const)(
    'no concluye obesidad ni normalidad con edema %s',
    (edema) => {
      const data = scores();
      data.indicadores.P_T.z = 4;
      const guide = familyGuidance(
        recommendations(data, edema).indicadores,
        edema,
      );
      expect(guide.titulo).toContain('hinchazón');
      expect(guide.hallazgos).toEqual([]);
    },
  );
  it('pide revisar las medidas y nunca infiere una categoría de puntajes dudosos', () => {
    const data = scores();
    data.indicadores.P_T = { z: 12, motivo: null, fuera_rango_calidad: true };
    const guide = familyGuidance(recommendations(data, 'NO').indicadores, 'NO');
    expect(guide.titulo).toContain('Revisemos');
    expect(guide.hallazgos).toEqual([]);
    expect(guide.factores).toContain('No se asigna una causa individual');
  });
  it('no interpreta un resultado antiguo incompleto como normal', () => {
    expect(familyGuidance([], 'NO').titulo).toContain('Revisemos');
  });
});

describe('Comparaciones visibles', () => {
  it('muestra peso para talla y talla para edad incluso en intervalos centrales', () => {
    const guide = familyGuidance(
      recommendations(scores(), 'NO').indicadores,
      'NO',
    );
    expect(guide.comparaciones[0].resultado).toContain('intervalo central');
    expect(guide.comparaciones[1].resultado).toContain('intervalo esperado');
  });
  it('explica por qué no concluye y destaca datos dudosos con edema pendiente', () => {
    const guide = familyGuidance(
      recommendations(scores(), 'DESCONOCIDO').indicadores,
      'DESCONOCIDO',
      true,
    );
    expect(guide.aviso_medidas).toContain('límites de calidad');
    expect(
      guide.comparaciones.every((item) =>
        item.resultado.includes('no se puede'),
      ),
    ).toBe(true);
    expect(guide.peso_referencia).toContain('No existe un único peso ideal');
  });
});
