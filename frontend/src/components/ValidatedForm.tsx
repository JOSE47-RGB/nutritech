import { useRef, useState } from 'react'
import type { FormHTMLAttributes, InvalidEvent } from 'react'
const labels: Record<string, string> = {
  centro_salud_id: 'Centro de salud', evaluado_en: 'Fecha y hora de evaluación', birth: 'Fecha de nacimiento', date: 'Fecha de medición', sexo: 'Sexo', peso: 'Peso (kg)', talla: 'Longitud o talla (cm)', metodo: 'Cómo se midió', edema: 'Revisión de hinchazón',
  certificado: 'Certificado de nacimiento', primer_nombre: 'Primer nombre', segundo_nombre: 'Segundo nombre', primer_apellido: 'Primer apellido', segundo_apellido: 'Segundo apellido', fecha_nacimiento: 'Fecha de nacimiento', sexo_biologico: 'Sexo', nombres: 'Nombres', apellidos: 'Apellidos', correo: 'Correo electrónico', dpi: 'DPI', tipo: 'Cómo se midió', parentesco: 'Parentesco',
}
type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
function isField(target: EventTarget | null): target is Field { return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement }
function explain(field: Field) {
  const v = field.validity
  if (v.valueMissing) return 'Completa este campo para continuar.'
  if (v.badInput) return 'Escribe un número válido.'
  if (v.typeMismatch) return 'Revisa el formato. Para un correo, usa nombre@ejemplo.com o déjalo vacío si es opcional.'
  if (field instanceof HTMLInputElement) {
    const display = (value: string) => field.type === 'date' ? value.split('-').reverse().join('/') : value
    if (v.rangeUnderflow) return `El valor mínimo permitido es ${display(field.min)}.`
    if (v.rangeOverflow) return `El valor máximo permitido es ${display(field.max)}.`
    if (v.stepMismatch && field.type === 'number') return 'Usa hasta dos decimales, por ejemplo 12.50.'
  }
  if (v.tooShort) return `Completa al menos ${'minLength' in field ? field.minLength : 1} caracteres.`
  if (v.patternMismatch) return 'Revisa el formato indicado junto al campo.'
  return field.validationMessage || 'Revisa este dato.'
}
export function ValidatedForm({ children, onInvalidCapture, onInputCapture, onBlurCapture, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  const form = useRef<HTMLFormElement>(null)
  const summary = useRef<HTMLDivElement>(null)
  const [issues, setIssues] = useState<Record<string, { label: string; message: string }>>({})
  function flag(field: Field) {
    const key = field.name || field.id
    if (!key) return
    field.setAttribute('aria-invalid', 'true')
    setIssues(old => ({ ...old, [key]: { label: labels[key] || field.labels?.[0]?.textContent?.split('*')[0]?.trim() || 'Dato del formulario', message: explain(field) } }))
  }
  function invalid(event: InvalidEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isField(event.target)) flag(event.target)
    requestAnimationFrame(() => summary.current?.focus())
    onInvalidCapture?.(event)
  }
  function update(field: Field) {
    const key = field.name || field.id
    if (field.validity.valid) { field.removeAttribute('aria-invalid'); setIssues(old => { if (!(key in old)) return old; const next = { ...old }; delete next[key]; return next }) }
    else if (field.getAttribute('aria-invalid') === 'true') flag(field)
  }
  return <form {...props} ref={form} onInvalidCapture={invalid} onInputCapture={event => { if (isField(event.target)) update(event.target); onInputCapture?.(event) }} onBlurCapture={event => { if (isField(event.target)) { if (!event.target.validity.valid) flag(event.target); else update(event.target) } onBlurCapture?.(event) }}>
    {Object.keys(issues).length > 0 && <div ref={summary} tabIndex={-1} role="alert" className="form-issues"><strong>Revisa estos datos para continuar</strong><p>Tu información sigue en el formulario. Selecciona un campo para corregirlo.</p><ul>{Object.entries(issues).map(([key, issue]) => <li key={key}><button type="button" onClick={() => { const target = form.current?.elements.namedItem(key); if (target instanceof HTMLElement) target.focus() }}>{issue.label}: {issue.message}</button></li>)}</ul></div>}
    {children}
  </form>
}
