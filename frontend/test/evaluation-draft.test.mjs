import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluationPayload, newEvaluationDraft } from '../src/components/evaluation-draft.ts'

const complete = () => newEvaluationDraft({ peso: '4.25', talla: '50.10', tipo: 'LONGITUD_ACOSTADO', edema: 'NO', lugar: 'VISITA_DOMICILIAR', observaciones: '  Control de prueba.  ' })
const payload = draft => evaluationPayload(draft, 'NINO_PRUEBA', '3', '2026-10-08T10:30:00-06:00')

test('el envío conserva medidas, método y edema aunque sus campos estén en pasos anteriores', () => {
  assert.deepEqual(payload(complete()), {
    nino_codigo: 'NINO_PRUEBA', centro_salud_id: '3', evaluado_en: '2026-10-08T16:30:00.000Z',
    peso_kg: 4.25, talla_cm: 50.1, tipo_medicion: 'LONGITUD_ACOSTADO', edema: 'NO',
    lugar_evaluacion: 'VISITA_DOMICILIAR', observaciones: 'Control de prueba.',
  })
})

test('otro niño comienza sin medidas y no hereda edema ni observaciones', () => {
  const previous = complete()
  const next = newEvaluationDraft()
  assert.equal(next.peso, '')
  assert.equal(next.talla, '')
  assert.equal(next.edema, 'DESCONOCIDO')
  assert.equal(next.observaciones, '')
  assert.throws(() => payload(next), /peso/)
  assert.equal(previous.peso, '4.25')
})

test('el paso desde consulta temporal conserva sus medidas sin inventar otras', () => {
  const draft = newEvaluationDraft({ peso: '4', talla: '30', tipo: 'LONGITUD_ACOSTADO', edema: 'DESCONOCIDO' })
  assert.equal(payload(draft).talla_cm, 30)
  assert.equal(payload(draft).edema, 'DESCONOCIDO')
  assert.equal(payload(draft).observaciones, undefined)
})

test('un envío final incompleto o con precisión extra no convierte campos vacíos en cero', () => {
  for (const invalid of [{ peso: '' }, { talla: '' }, { peso: '4.256' }, { talla: '50.101' }, { tipo: '' }, { edema: '' }]) {
    assert.throws(() => payload({ ...complete(), ...invalid }))
  }
  assert.throws(() => evaluationPayload(complete(), 'NINO', '', '2026-10-08'), /centro/)
  assert.throws(() => evaluationPayload(complete(), 'NINO', '3', ''), /fecha/)
})
