import { lmsScore, type Reference, type Sex } from '../nutrition/calculator';
export const GROWTH_SOURCE = {
  titulo: 'OMS 2006 · Peso para la edad',
  url: 'https://www.who.int/tools/child-growth-standards/standards/weight-for-age',
};
export function referenceWeight(rows: Reference[], sex: Sex, days: number) {
  if (!Number.isInteger(days) || days < 0 || days > 1826) return null;
  const row = rows.find(
    (r) =>
      r.indicator === 'P_E' && r.sexo_biologico === sex && r.edad_dias === days,
  );
  if (!row) return null;
  const l = Number(row.valor_l),
    m = Number(row.valor_m),
    s = Number(row.valor_s);
  if (![l, m, s].every(Number.isFinite) || m <= 0 || s <= 0) return null;
  const at = (z: number) =>
    l === 0 ? m * Math.exp(s * z) : m * (1 + l * s * z) ** (1 / l);
  const lower = at(-2),
    upper = at(2);
  if (![lower, upper].every((v) => Number.isFinite(v) && v > 0)) return null;
  return { mediana_kg: m, menos2_kg: lower, mas2_kg: upper };
}
export function weightWarning(
  rows: Reference[],
  sex: Sex,
  days: number,
  weight: number,
  edema: string,
) {
  if (edema === 'SI')
    return 'Hinchazón registrada: el peso necesita valoración profesional.';
  if (edema !== 'NO')
    return 'Falta revisar hinchazón en ambos pies; no interpretar el peso todavía.';
  const row = rows.find(
    (r) =>
      r.indicator === 'P_E' && r.sexo_biologico === sex && r.edad_dias === days,
  );
  if (!row || !referenceWeight(rows, sex, days))
    return 'Sin referencia disponible para esta edad.';
  if (!Number.isFinite(weight) || weight <= 0)
    return 'Revisar el peso registrado.';
  const z = lmsScore(
    weight,
    { l: Number(row.valor_l), m: Number(row.valor_m), s: Number(row.valor_s) },
    true,
  );
  return z < -6 || z > 5
    ? 'Medida fuera de los límites de calidad: comprobar peso y edad.'
    : null;
}
export function localDate(date: Date) {
  return new Date(date.getTime() - 6 * 3600000).toISOString().slice(0, 10);
}
export function periodKey(date: string, group: 'dia' | 'mes' | 'ano') {
  return date.slice(0, group === 'ano' ? 4 : group === 'mes' ? 7 : 10);
}
