import type { WeightReference } from './growth-data'

function calendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date.getTime()
    : null
}

export function referenceAge(birth: string, measured: string, today: string) {
  const start = calendarDay(birth)
  const end = calendarDay(measured)
  if (start === null || end === null || end < start || measured > today) return null
  return (end - start) / 86400000
}

// A saved evaluation uses the day in Guatemala, even on a device in another zone.
export function measurementDay(value: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(date)
    : ''
}

export function compareReferenceWeight(value: string, reference: WeightReference) {
  const weight = Number(value)
  const { menos2_kg: lower, mediana_kg: middle, mas2_kg: upper } = reference
  if (
    !value.trim() || !Number.isFinite(weight) || weight < 0.3 || weight > 100 ||
    Math.abs(weight * 100 - Math.round(weight * 100)) > 1e-8 ||
    ![lower, middle, upper].every(Number.isFinite) ||
    lower <= 0 || lower >= middle || middle >= upper
  ) return null
  return {
    weight,
    position: weight < lower ? 'below' : weight > upper ? 'above' : 'within',
    belowMiddle: weight < middle,
  } as const
}
