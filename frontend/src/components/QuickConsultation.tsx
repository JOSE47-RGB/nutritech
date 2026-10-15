import { EdemaField } from './EdemaField'
import { WeightReferenceHint } from './WeightReferenceHint'
import { EvaluationSteps, MeasurementFields } from './EvaluationFields'
import { ValidatedForm } from './ValidatedForm'
import { FamilyResult, type FamilyGuide } from './FamilyResult'
import { familyReportHtml } from './family-guide'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, readResponse } from './ninos-api'
import { NinoForm } from './NinoForm'
import { EvaluacionForm } from './Evaluaciones'
import { UserResult } from './UserResult'
import type { Nino } from './ninos-api'
import { Viewer } from './Reports'

type Indicator = { indicador: string; z: number | null; estado: string; clasificacion: string | null; recomendacion: string; motivo: string | null; fuentes: { titulo: string; url: string }[] }
type Result = { guia_familiar?: FamilyGuide; entrada: { edad_dias: number; sexo: string; peso_kg: string; talla_cm: string; tipo_medicion: string; edema: string }; version_consolidacion: string; referencias_sha256: string; reglas_sha256: string; orientacion: { indicadores: Indicator[]; avisos: { texto: string }[] } }
const names: Record<string, string> = { P_E: 'Peso para la edad', T_E: 'Longitud/talla para la edad', P_T: 'Peso para longitud/talla', IMC_E: 'IMC para la edad' }
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
function report(result: Result, date: string) {
  const input = result.entrada
  const familyHtml = familyReportHtml(result.guia_familiar)

  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>NutriTech · Consulta informativa</title><style>@page{size:A4;margin:18mm}body{font:14px/1.5 Arial,sans-serif;color:#2f3a45;max-width:850px;margin:auto;padding:24px}h1,h2{color:#2563a6}article{border:1px solid #cad8e9;padding:14px;margin:12px 0;break-inside:avoid}small{overflow-wrap:anywhere}a{color:#2563a6}.notice{background:#e8f1fa;padding:14px}@media print{body{padding:0}}</style><h1>NUTRITECH</h1><h2>Consulta nutricional informativa</h2><p>Fecha de medición: ${escape(date)} · Edad: ${input.edad_dias} días · Sexo: ${input.sexo === 'M' ? 'Masculino' : 'Femenino'}</p><p>Peso: ${escape(input.peso_kg)} kg · Longitud/talla: ${escape(input.talla_cm)} cm · Método: ${input.tipo_medicion === 'TALLA_DE_PIE' ? 'De pie' : 'Acostado'} · Revisión de hinchazón en ambos pies: ${input.edema === "NO" ? "No presenta, evaluado" : input.edema === "SI" ? "Presenta, requiere valoración médica" : "Pendiente de revisión"}</p><p class="notice">Consulta sin expediente. No guardada en el historial clínico. Orientación automática para revisión profesional; no sustituye una evaluación ni un diagnóstico médico.</p>${familyHtml}<details><summary>Detalle para el personal de salud y fuentes</summary>${result.orientacion.indicadores.map(item => `<article><h2>${escape(names[item.indicador])}</h2><strong>${escape(item.clasificacion?.replaceAll('_', ' ') ?? 'Requiere revisión')}</strong><p>Puntaje Z: ${item.z === null ? 'No disponible' : item.z.toFixed(2)}</p><p>${escape(item.recomendacion)}</p><p>Motivo: ${escape(item.motivo)}</p>${item.fuentes.map(source => `<p>${escape(source.titulo)}<br>${escape(source.url)}</p>`).join('')}</article>`).join('')}<h2>Avisos y recomendaciones</h2><ul>${result.orientacion.avisos.map(item => `<li>${escape(item.texto)}</li>`).join('')}</ul><p>Las clasificaciones utilizan puntajes sin redondear. No se han creado alertas de seguimiento.</p><small>Versión: ${escape(result.version_consolidacion)}<br>Referencias SHA-256: ${escape(result.referencias_sha256)}<br>Reglas SHA-256: ${escape(result.reglas_sha256)}</small></details></html>`
}
export function QuickConsultation({ canReport, canRegister, onSessionExpired, publicMode = false }: { canRegister: boolean; canReport: boolean; onSessionExpired: () => void; publicMode?: boolean }) {
  const [step, setStep] = useState(0)
  const stepTitle = useRef<HTMLHeadingElement>(null)
  const goTo = (next: number) => { setStep(next); setError(''); requestAnimationFrame(() => { stepTitle.current?.focus(); stepTitle.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }) }
  const [draft, setDraft] = useState<Record<string, string>>({})
  const heading = useRef<HTMLElement>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [birthDate, setBirthDate] = useState('')
  const [registering, setRegistering] = useState(false)
  const [child, setChild] = useState<Nino | null>(null)
  const [measurementDate, setMeasurementDate] = useState('')
  const [html, setHtml] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  function updateDraft(event: FormEvent<HTMLFormElement>) {
    const field = event.target
    if ((field instanceof HTMLInputElement || field instanceof HTMLSelectElement) && field.name) {
      const { name, value } = field
      setDraft(old => old[name] === value ? old : { ...old, [name]: value })
    }
  }
  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    for (const [key, value] of Object.entries(draft)) if (!data.has(key)) data.set(key, value)
    if (!data.has('date')) data.set('date', today)
    if (!data.has('edema')) data.set('edema', 'DESCONOCIDO')
    setDraft(Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value)])))
    const birth = String(data.get('birth'))
    const date = String(data.get('date'))
    const age = (Date.parse(date) - Date.parse(birth)) / 86400000
    setError(''); setResult(null)
    if (!Number.isInteger(age) || age < 0 || date > today || age > 1856) { setError('Revisa las fechas: la medición no puede ser futura ni anterior al nacimiento. La cobertura máxima es de 1856 días.'); return }
    if (step < 2) { goTo(step + 1); return }
    if (busy) return
    setBusy(true)
    try {
      const value = await readResponse<Result>(await fetch(`/api/${publicMode ? 'publico' : 'mi-portal'}/consulta`, { method: 'POST', credentials: publicMode ? 'omit' : 'same-origin', headers: { 'Content-Type': 'application/json', 'X-NutriTech-Request': '1' }, signal: AbortSignal.timeout(30000), body: JSON.stringify({ edad_dias: age, sexo: data.get('sexo'), peso_kg: Number(data.get('peso')), talla_cm: Number(data.get('talla')), tipo_medicion: data.get('metodo'), edema: data.get('edema') }) }))
      setResult(value); setMeasurementDate(date); setBirthDate(birth); requestAnimationFrame(() => heading.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (err) { if (!publicMode && err instanceof ApiError && err.status === 401) onSessionExpired(); else setError(err instanceof ApiError ? err.message : 'No se pudo completar la consulta. Revisa la conexión e inténtalo de nuevo.') }
    finally { setBusy(false) }
  }
  const reset = () => { setStep(0); setDraft({}); setResult(null); setError(''); setRegistering(false); setChild(null) }
  const correct = () => { setStep(0); setResult(null); setError(''); requestAnimationFrame(() => document.getElementById('consult-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }
  const age = draft.birth ? Math.floor((Date.parse(draft.date || today) - Date.parse(draft.birth)) / 86400000) : null
  if (registering && result) return <div>
    <h2 className="text-2xl font-bold text-institucional">Guardar / Registrar</h2>
    {!child ? <><p className="my-4">Paso 1 de 2: crea el expediente. Al guardar se registrará al niño en la base de datos. Después confirmarás la medición para iniciar su seguimiento.</p><NinoForm canLinkGuardians onAbort={() => setRegistering(false)} initial={{ birth: birthDate, sex: result.entrada.sexo }} apiBase="/api/mi-portal/ninos" onSessionExpired={onSessionExpired} onCreated={setChild} /></> : <><p role="status" className="portal-info my-4">Expediente creado: {child.codigo_expediente}. Continúa con el paso 2 para guardar la evaluación. Si sales ahora, el expediente permanece registrado.</p><EvaluacionForm initial={{ child, peso: result.entrada.peso_kg, talla: result.entrada.talla_cm, tipo: result.entrada.tipo_medicion, edema: result.entrada.edema, date: measurementDate }} onSessionExpired={onSessionExpired} renderSaved={evaluation => <UserResult evaluation={evaluation} canReport={canReport} onSessionExpired={onSessionExpired} onNew={reset} />} /></>}
  </div>
  return <div>
    {!result && <ValidatedForm key={step} id="consult-form" className="evaluation-wizard" onInput={updateDraft} onChange={updateDraft} onSubmit={event => void calculate(event)}><EvaluationSteps current={step} labels={['Sobre el niño', 'Sus medidas', 'Revisar y calcular']} />
      <h3 ref={stepTitle} tabIndex={-1} className="guide-title">{['Empecemos con su edad', '¿Cuánto pesa y mide?', 'Revisa antes de calcular'][step]}</h3>
      <p className="guide-hint">{['No necesitas registrar un expediente. Completa estos tres datos.', 'Usa las medidas tomadas con una báscula y un tallímetro.', 'Confirma las medidas y la revisión del personal de salud.'][step]}</p>
      <fieldset disabled={busy || step !== 0} hidden={step !== 0} className="quick-fields">
      <label>Fecha de nacimiento<input name="birth" defaultValue={draft.birth} type="date" min="1900-01-01" max={draft.date && draft.date < today ? draft.date : today} required /></label>
      <label>Fecha de medición<input name="date" type="date" min={draft.birth && draft.birth <= today ? draft.birth : undefined} max={today} defaultValue={draft.date || today} required /></label>
      <label>Sexo<select name="sexo" required defaultValue={draft.sexo || ""}><option value="" disabled>Selecciona</option><option value="M">Masculino</option><option value="F">Femenino</option></select></label>
      </fieldset>
      {step === 0 && age !== null && Number.isFinite(age) && age >= 0 && <p className="age-preview" role="status"><strong>Edad: {age < 31 ? `${age} días` : `${Math.round(age / 30.4375)} meses aproximadamente`}.</strong> ¿Coincide con la edad del niño?</p>}
      <fieldset disabled={busy || step !== 1} hidden={step !== 1}>
      <MeasurementFields weight={draft.peso} height={draft.talla} method={draft.metodo} />
      </fieldset>
      <fieldset disabled={busy || step !== 2} hidden={step !== 2}>
        <div className="guide-review"><h4>Estos son los datos de la consulta</h4><dl><div><dt>Nacimiento</dt><dd>{draft.birth?.split('-').reverse().join('/') || '—'}</dd></div><div><dt>Medición</dt><dd>{(draft.date || today).split('-').reverse().join('/')}</dd></div><div><dt>Sexo</dt><dd>{draft.sexo === 'M' ? 'Masculino' : 'Femenino'}</dd></div><div><dt>Peso</dt><dd>{draft.peso} kg</dd></div><div><dt>Estatura</dt><dd>{draft.talla} cm</dd></div><div><dt>Se midió</dt><dd>{draft.metodo === 'TALLA_DE_PIE' ? 'De pie' : 'Acostado'}</dd></div></dl><button type="button" className="guide-edit" onClick={() => goTo(0)}>Cambiar datos</button></div>
        <EdemaField initial={draft.edema || "DESCONOCIDO"} />
      </fieldset>
      {step === 1 && <WeightReferenceHint compact publicMode={publicMode} birth={draft.birth || ''} measured={draft.date ?? today} sex={draft.sexo} weight={draft.peso} edema={draft.edema} onSessionExpired={onSessionExpired} />}
      <div className="guide-actions guide-actions-sticky">{step > 0 && <button type="button" className="consult-secondary" disabled={busy} onClick={() => goTo(step - 1)}>← Atrás</button>}<button type="submit" className="portal-primary" disabled={busy}>{busy ? 'Preparando resultado…' : step === 2 ? 'Ver resultado →' : 'Continuar →'}</button></div>
      <p className="family-caption">{step === 2 ? publicMode ? 'La consulta es temporal. Podrás imprimir el reporte; no se guarda un historial.' : 'La consulta es temporal. Después podrás imprimir el reporte o registrar al niño.' : `Paso ${step + 1} de 3 · Puedes volver atrás sin perder tus datos.`}</p></ValidatedForm>}
    {error && <p role="alert" className="portal-error">{error}</p>}
    {result && <section ref={heading} aria-labelledby="quick-result"><div className="consult-steps"><span>1 · Medidas completas</span><strong>2 · Resultado y reporte</strong></div><h2 id="quick-result" className="mb-4 text-2xl font-bold text-institucional" tabIndex={-1}>Resultado de la consulta</h2><p role="status" className="mb-4">{result.entrada.edad_dias} días · {result.entrada.peso_kg} kg · {result.entrada.talla_cm} cm. Consulta sin guardar.</p><FamilyResult guide={result.guia_familiar} onCorrect={correct} /><div className="consult-actions">{canReport && <button className="portal-primary" onClick={() => setHtml(report(result, measurementDate))}>Ver reporte para la familia</button>}<button className="consult-secondary" onClick={reset}>Evaluar a otro niño</button></div><p className="family-caption">Estas alertas son informativas. La consulta temporal no crea un historial ni avisos de seguimiento.</p><details><summary className="cursor-pointer font-semibold">Ver detalle para el personal de salud</summary><div className="portal-result-grid">{result.orientacion.indicadores.map(item => <article key={item.indicador} className={item.estado === 'ORIENTATIVA' ? 'portal-indicator' : 'portal-indicator review'}><h3>{names[item.indicador]}</h3><strong>{item.clasificacion?.replaceAll('_', ' ') ?? 'Requiere revisión'}</strong><p>Puntaje Z: {item.z === null ? 'No disponible' : item.z.toFixed(2)}</p><p>{item.recomendacion}</p><details className="mt-3"><summary>Motivo y fuentes</summary><p>{item.motivo}</p>{item.fuentes.map(source => <a className="block underline" key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.titulo}</a>)}</details></article>)}</div><div className="portal-info mt-4"><div><h3 className="font-bold">Avisos y recomendaciones</h3><ul className="list-disc pl-5">{result.orientacion.avisos.map(item => <li key={item.texto}>{item.texto}</li>)}</ul><p className="mt-2">No se han creado alertas de seguimiento. Las clasificaciones usan puntajes sin redondear.</p></div></div></details><div className="consult-actions">{canRegister && <details className="family-more"><summary>¿Quieres guardar esta consulta para darle seguimiento?</summary><p>Los datos de la medición ya están completos. Solo faltan los datos del expediente.</p><button className="portal-primary" onClick={() => setRegistering(true)}>Registrar al niño y conservar la evaluación</button></details>}</div></section>}
    {html && <Viewer html={html} close={() => setHtml(null)} />}
  </div>
}
