import { test } from 'node:test'
import assert from 'node:assert/strict'
import { referenceAge, measurementDay, compareReferenceWeight } from '../src/components/weight-reference.ts'

test('edad exacta: nacimiento, año bisiesto y cambio de año', () => {
  assert.equal(referenceAge('2026-10-07', '2026-10-07', '2026-10-07'), 0)
  assert.equal(referenceAge('2024-02-28', '2024-03-01', '2026-10-07'), 2)
  assert.equal(referenceAge('2025-12-31', '2026-01-01', '2026-10-07'), 1)
})

test('no consulta con fechas vacías, inexistentes, invertidas o futuras', () => {
  for (const [birth, date] of [['', '2026-10-07'], ['2024-02-30', '2026-10-07'], ['2026-10-07', '2026-10-06'], ['2026-10-07', '2026-10-08'], ['2026-10-07', '']]) {
    assert.equal(referenceAge(birth, date, '2026-10-07'), null)
  }
})

test('la medición registrada usa el día de Guatemala al cruzar medianoche UTC', () => {
  assert.equal(measurementDay('2026-10-08T05:59:00Z'), '2026-10-07')
  assert.equal(measurementDay('2026-10-08T06:00:00Z'), '2026-10-08')
  assert.equal(measurementDay(''), '')
  assert.equal(measurementDay('invalid'), '')
})

const reference = { menos2_kg: 3, mediana_kg: 4, mas2_kg: 5 }
test('menos que la mediana puede seguir dentro de la franja; incluye límites exactos', () => {
  assert.deepEqual(compareReferenceWeight('3.50', reference), { weight: 3.5, position: 'within', belowMiddle: true })
  assert.equal(compareReferenceWeight('3', reference).position, 'within')
  assert.equal(compareReferenceWeight('5', reference).position, 'within')
  assert.equal(compareReferenceWeight('2.99', reference).position, 'below')
  assert.equal(compareReferenceWeight('5.01', reference).position, 'above')
})

test('compara con precisión completa y omite entradas o referencias inválidas', () => {
  assert.equal(compareReferenceWeight('3.27', { ...reference, menos2_kg: 3.2701 }).position, 'below')
  for (const weight of ['', ' ', '-', 'NaN', 'Infinity', '0', '-2', '100.01', '2.345']) assert.equal(compareReferenceWeight(weight, reference), null)
  assert.equal(compareReferenceWeight('4', { ...reference, menos2_kg: 5 }), null)
})
