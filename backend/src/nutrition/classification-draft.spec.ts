import {
  DRAFT_RULES,
  classificationProposal,
  matchesRule,
  reviewDraftScore,
  validateDraft,
} from './classification-draft';
import type { Indicator } from './calculator';
const choose = (indicator: Indicator, z: number) =>
  reviewDraftScore(indicator, { z, fuera_rango_calidad: false, motivo: null })
    .regla?.codigo;
describe('Revisión técnica del borrador de clasificación', () => {
  it('mantiene veinte reglas completas sin huecos ni solapamientos', () => {
    expect(validateDraft()).toEqual({
      reglas: 20,
      indicadores: 4,
      huecos: 0,
      solapamientos: 0,
    });
  });
  it.each(['P_T', 'IMC_E'] as const)(
    'respeta todos los límites exactos y vecinos en %s',
    (indicator) => {
      for (const [z, expected] of [
        [-3.001, 'EMACIACION_SEVERA'],
        [-3, 'EMACIACION'],
        [-2.001, 'EMACIACION'],
        [-2, 'INTERVALO_CENTRAL'],
        [1, 'INTERVALO_CENTRAL'],
        [1.001, 'POSIBLE_RIESGO_SOBREPESO'],
        [2, 'POSIBLE_RIESGO_SOBREPESO'],
        [2.001, 'SOBREPESO'],
        [3, 'SOBREPESO'],
        [3.001, 'OBESIDAD'],
      ] as const)
        expect(choose(indicator, z)).toBe(expected);
    },
  );
  it('peso para la edad nunca etiqueta sobrepeso u obesidad', () => {
    expect(choose('P_E', -3.001)).toBe('BAJO_PESO_SEVERO');
    expect(choose('P_E', -3)).toBe('BAJO_PESO');
    expect(choose('P_E', -2)).toBe('SIN_BAJO_PESO');
    expect(choose('P_E', 1)).toBe('SIN_BAJO_PESO');
    expect(choose('P_E', 1.001)).toBe('CONSULTAR_PROPORCION');
    expect(choose('P_E', 4)).toBe('CONSULTAR_PROPORCION');
  });
  it('talla usa su propio extremo alto y mantiene menos severos los límites bajos', () => {
    expect(choose('T_E', -3.001)).toBe('TALLA_BAJA_SEVERA');
    expect(choose('T_E', -3)).toBe('TALLA_BAJA');
    expect(choose('T_E', -2)).toBe('SIN_TALLA_BAJA');
    expect(choose('T_E', 3)).toBe('SIN_TALLA_BAJA');
    expect(choose('T_E', 3.001)).toBe('TALLA_MUY_ALTA');
  });
  it('detecta huecos, límites duplicados y códigos duplicados', () => {
    const copy = () => DRAFT_RULES.map((r) => ({ ...r }));
    let rows = copy();
    rows[1].incluye_min = false;
    expect(() => validateDraft(rows)).toThrow('Hueco');
    rows = copy();
    rows[0].incluye_max = true;
    expect(() => validateDraft(rows)).toThrow('solapamiento');
    rows = copy();
    rows[1].codigo = rows[0].codigo;
    expect(() => validateDraft(rows)).toThrow('duplicado');
  });
  it('cada punto de una malla de revisión tiene exactamente una coincidencia', () => {
    for (const indicator of ['P_E', 'T_E', 'P_T', 'IMC_E'] as const)
      for (let i = -10000; i <= 10000; i++)
        expect(
          DRAFT_RULES.filter(
            (r) => r.indicador === indicator && matchesRule(r, i / 1000),
          ),
        ).toHaveLength(1);
  });
  it('no clasifica ausencias, fallos de calidad ni métodos marcados', () => {
    for (const z of [null, NaN, Infinity])
      expect(
        reviewDraftScore('P_T', { z, fuera_rango_calidad: false, motivo: null })
          .regla,
      ).toBeNull();
    expect(
      reviewDraftScore('P_T', { z: 0, fuera_rango_calidad: true, motivo: null })
        .estado,
    ).toBe('REVISAR_DATOS');
    expect(
      reviewDraftScore(
        'T_E',
        { z: 0, fuera_rango_calidad: false, motivo: null },
        true,
      ).regla,
    ).toBeNull();
    expect(
      reviewDraftScore('P_T', {
        z: null,
        fuera_rango_calidad: null,
        motivo: 'EDEMA_DESCONOCIDO',
      }).estado,
    ).toBe('NO_DISPONIBLE');
  });
  it('documenta por qué no debe clasificar el puntaje redondeado de la pantalla', () => {
    expect(choose('P_T', -3.004)).toBe('EMACIACION_SEVERA');
    expect(choose('P_T', Number((-3.004).toFixed(2)))).toBe('EMACIACION');
    expect(
      classificationProposal().pendientes.some((item) =>
        item.includes('sin redondear'),
      ),
    ).toBe(true);
  });
  it('no activa reglas ni define prioridades clínicas', () => {
    expect(classificationProposal()).toMatchObject({
      estado: 'BORRADOR',
      activa: false,
      revision_clinica: 'PENDIENTE',
      nivel_revision: null,
      genera_alerta: false,
    });
  });
});
