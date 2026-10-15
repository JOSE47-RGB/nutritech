import { alertCandidates } from './alert-policy';
import { recommendations } from '../nutrition/recommendations';
import { NutritionCalculator, type Indicator } from '../nutrition/calculator';
function input() {
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
}
describe('Política de avisos de seguimiento', () => {
  it('no genera avisos por intervalos centrales', () =>
    expect(alertCandidates(recommendations(input(), 'NO'))).toEqual([]));
  it.each(['SI', 'DESCONOCIDO'] as const)(
    'consolida edema %s en un aviso sin perder su motivo',
    (edema) => {
      const alerts = alertCandidates(recommendations(input(), edema));
      expect(alerts).toHaveLength(1);
      expect(alerts[0].codigo).toBe(
        edema === 'SI' ? 'EDEMA' : 'EDEMA_DESCONOCIDO',
      );
    },
  );
  it('distingue hallazgo nutricional y problema de calidad', () => {
    const result = input();
    result.indicadores.P_T.z = -3.004;
    result.indicadores.T_E.fuera_rango_calidad = true;
    const alerts = alertCandidates(recommendations(result, 'NO'));
    expect(alerts).toHaveLength(2);
    expect(alerts.find((a) => a.tipo === 'HALLAZGO')!.titulo).toContain(
      'severa',
    );
    expect(alerts.find((a) => a.tipo === 'DATOS')!.codigo).toContain('CALIDAD');
  });
  it('no convierte falta de referencia en normalidad', () => {
    const result = input();
    result.indicadores.P_E = {
      z: null,
      motivo: 'REFERENCIA_AUSENTE',
      fuera_rango_calidad: null,
    };
    expect(alertCandidates(recommendations(result, 'NO'))[0].codigo).toContain(
      'REFERENCIA_AUSENTE',
    );
  });
});
