import test from 'node:test'
import assert from 'node:assert/strict'
import { familyPresentation, familyReportHtml } from '../src/components/family-guide.ts'

const base = {
  titulo: 'Revisar la longitud/talla: 30 cm', siguiente_paso: 'Pide repetir la medida.',
  estado_edema: 'DESCONOCIDO', factores: 'Revisar antecedentes.', nota: 'Orientación.',
  hallazgos: [], pendientes: [{ indicador: 'T_E', mensaje: 'Revisar.' }],
  fuente: { titulo: 'OMS', url: 'https://www.who.int/' }, aviso_medidas: 'Confirmar.',
  revision_medidas: {
    avisos: [{ codigo: 'T_E:CALIDAD', titulo: 'Revisar la longitud/talla: 30 cm', detalle: 'Medida por confirmar.' }],
    explicacion: 'Una medida fuera de la referencia puede ser real.', comprobar: 'Repetir.',
    si_se_confirma: 'Conserva el valor real y solicita valoración.',
    fuente: { titulo: 'OMS Anthro', url: 'https://www.who.int/' },
  },
}

test('edema pendiente no se presenta como una hinchazón observada', () => {
  const view = familyPresentation(base)
  assert.equal(view.title, base.titulo)
  assert.match(view.edemaMessage, /no significa que el niño la tenga/)
  assert.doesNotMatch(view.edemaMessage, /Se indicó hinchazón/)
})

test('edema presente conserva la alerta clínica aunque haya medidas por confirmar', () => {
  const view = familyPresentation({ ...base, estado_edema: 'SI', titulo: 'Necesita valoración médica por hinchazón en ambos pies' })
  assert.match(view.title, /valoración médica/)
  assert.match(view.edemaMessage, /Se indicó hinchazón/)
})

test('las copias anteriores siguen visibles y no confunden desconocido con presente', () => {
  const old = { ...base, estado_edema: undefined, revision_medidas: undefined, titulo: 'Falta revisar la hinchazón en ambos pies (edema)' }
  const view = familyPresentation(old)
  assert.match(view.title, /confirmación/)
  assert.equal(view.edema, 'DESCONOCIDO')
  assert.match(view.edemaMessage, /no significa/)
})

test('reporte temporal conserva la alerta concreta, el siguiente paso y escapa los datos', () => {
  const html = familyReportHtml(base)
  assert.match(html, /longitud\/talla: 30 cm/)
  assert.match(html, /Si la medida se confirma/)
  assert.match(html, /Conserva el valor real/)
  assert.match(html, /no significa que el niño la tenga/)
  const unsafe = familyReportHtml({ ...base, revision_medidas: { ...base.revision_medidas, si_se_confirma: '<script>alert(1)</script>' } })
  assert.doesNotMatch(unsafe, /<script>/)
  assert.match(unsafe, /&lt;script&gt;/)
})

test('un resultado completo sin avisos mantiene sus comparaciones', () => {
  const normal = { ...base, estado_edema: 'NO', aviso_medidas: null, revision_medidas: null, pendientes: [], titulo: 'Medidas dentro de los intervalos esperados', comparaciones: [{ pregunta: '¿Su talla corresponde a su edad?', resultado: 'Dentro del intervalo de referencia.' }] }
  assert.equal(familyPresentation(normal).attention, false)
  assert.equal(familyPresentation(normal).edemaMessage, null)
  assert.match(familyReportHtml(normal), /Dentro del intervalo/)
})
