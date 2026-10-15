import { EdemaField } from './EdemaField'
import { WeightReferenceHint } from './WeightReferenceHint'
import { measurementDay } from './weight-reference'
import { EvaluationSteps, MeasurementFields } from './EvaluationFields'
import { evaluationPayload, newEvaluationDraft } from './evaluation-draft'
import { ValidatedForm } from './ValidatedForm'
import { AnnulEvaluation } from './AnnulEvaluation'
import { SavedOrientations } from './SavedOrientations'
import { EvaluationCalculation } from './EvaluationCalculation'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ApiError, readResponse } from './ninos-api'

export type Child = { codigo_publico: string; codigo_expediente: string; primer_nombre: string; segundo_nombre: string | null; primer_apellido: string; segundo_apellido: string | null; fecha_nacimiento: string; sexo_biologico?: 'M' | 'F' }
type Center = { id: string; nombre: string }
export type Evaluation = { edema: 'SI' | 'NO' | 'DESCONOCIDO'; codigo_publico: string; evaluado_en: string; edad_dias: number; peso_kg: string; talla_cm: string; tipo_medicion: string; lugar_evaluacion: string; estado: string; motivo_anulacion: string | null; anulada_en: string | null; observaciones: string | null; ninos: Child; centros_salud: { nombre: string } }
type Page = { datos: Evaluation[]; total: number; pagina: number; paginas: number }
const input = 'mt-2 block w-full rounded-lg border border-secundario/40 bg-white px-3 py-2.5 focus:ring-2 focus:ring-institucional'
const button = 'rounded-lg bg-institucional px-4 py-3 font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-institucional'
const name = (child: Child) => [child.primer_nombre, child.segundo_nombre, child.primer_apellido, child.segundo_apellido].filter(Boolean).join(' ')
const dateLabel = (date: string) => new Date(date).toLocaleString('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' })
const method = (value: string) => value === 'LONGITUD_ACOSTADO' ? 'Longitud acostado' : 'Talla de pie'
function localNow() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
function message(error: unknown) { return error instanceof ApiError ? error.message : 'No se pudo completar la solicitud. Comprueba la conexión y vuelve a intentar.' }

export type EvaluationPrefill = { child: Child; peso: string; talla: string; tipo: string; edema: string; date: string }
export function EvaluacionForm({ onSessionExpired, onHistory, renderSaved, initial }: { initial?: EvaluationPrefill; onSessionExpired: () => void; onHistory?: (child: Child) => void; renderSaved?: (evaluation: Evaluation) => ReactNode }) {
  const [centers, setCenters] = useState<Center[]>([])
  const [center, setCenter] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState('')
  const [children, setChildren] = useState<Child[]>([])
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<Child | null>(initial?.child ?? null)
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Evaluation | null>(null)
  const [date, setDate] = useState(() => initial ? '' : localNow())
  const [step, setStep] = useState(initial ? 1 : 0)
  const [draft, setDraft] = useState(() => newEvaluationDraft(initial ? { peso: initial.peso, talla: initial.talla, tipo: initial.tipo, edema: initial.edema } : undefined))
  const heading = useRef<HTMLHeadingElement>(null)
  function goTo(next: number) {
    setStep(next); setError('')
    requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })
  }
  function selectChild(child: Child) {
    if (child.codigo_publico !== selected?.codigo_publico) { setDraft(newEvaluationDraft()); setDate(localNow()) }
    setSelected(child); goTo(1)
  }
  function updateDraft(event: FormEvent<HTMLFormElement>) {
    const field = event.target
    if ((field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) && field.name in draft) {
      const { name, value } = field
      setDraft(old => ({ ...old, [name]: value }))
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    fetch('/api/evaluaciones/centros', { signal: controller.signal }).then(readResponse<Center[]>).then((rows) => {
      if (active) { setCenters(rows); setCenter(old => rows.some(row => row.id === old) ? old : rows.length === 1 ? rows[0].id : ''); setError('') }
    }).catch((err: unknown) => { if (active) { if (err instanceof ApiError && err.status === 401) onSessionExpired(); else setError(message(err)) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [onSessionExpired, revision])
  function fail(err: unknown) { if (err instanceof ApiError && err.status === 401) onSessionExpired(); else setError(message(err)) }
  async function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSearching(true); setError(''); setChildren([]); setSearched(false)
    try { setChildren(await fetch(`/api/evaluaciones/ninos?${new URLSearchParams({ busqueda: search.trim() })}`, { signal: AbortSignal.timeout(15000) }).then(readResponse<Child[]>)); setSearched(true) } catch (err) { fail(err) } finally { setSearching(false) }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current || !selected) return
    const instant = new Date(date).getTime()
    if (!date || !Number.isFinite(instant) || instant > new Date().getTime() || measurementDay(date) < selected.fecha_nacimiento) { setError('Revisa la fecha: la medición no puede ser futura ni anterior al nacimiento.'); return }
    if (step === 1) { goTo(2); return }
    let payload: ReturnType<typeof evaluationPayload>
    try { payload = evaluationPayload(draft, selected.codigo_publico, center, date) }
    catch (err) { setError(err instanceof Error ? err.message : 'Revisa los datos de la evaluación.'); return }
    saving.current = true; setBusy(true); setError('')
    try {
      const result = await fetch('/api/evaluaciones', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NutriTech-Request': '1' }, body: JSON.stringify(payload) }).then(readResponse<Evaluation>)
      setSaved(result)
      requestAnimationFrame(() => document.getElementById('user-result-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (err) { fail(err) } finally { saving.current = false; setBusy(false) }
  }
  function reset() { setSaved(null); setSelected(null); setChildren([]); setSearch(''); setSearched(false); setDate(localNow()); setDraft(newEvaluationDraft()); goTo(0) }
  if (saved && renderSaved) return <>{renderSaved(saved)}</>
  if (saved) return <section aria-labelledby="eval-saved"><h1 id="eval-saved" className="text-3xl font-semibold">Medición registrada</h1><p role="status" className="mt-5 rounded-lg bg-verde-claro p-4">Se guardó la evaluación de {name(saved.ninos)}.</p><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-secundario">Peso</dt><dd>{saved.peso_kg} kg</dd></div><div><dt className="text-secundario">Longitud / talla</dt><dd>{saved.talla_cm} cm · {method(saved.tipo_medicion)}</dd></div><div><dt className="text-secundario">Fecha (Guatemala)</dt><dd>{dateLabel(saved.evaluado_en)}</dd></div><div><dt className="text-secundario">Edad en la evaluación</dt><dd>{saved.edad_dias} días</dd></div></dl><p className="mt-5 rounded-lg bg-azul-claro p-4">La medición quedó guardada. Ahora puedes ver su resultado y preparar el reporte para la familia.</p>{onHistory && <><EvaluationCalculation code={saved.codigo_publico} onSessionExpired={onSessionExpired} /><SavedOrientations code={saved.codigo_publico} canSave onSessionExpired={onSessionExpired} /></>}<div className="mt-6 flex flex-wrap gap-3"><button className={button} onClick={reset}>Registrar otra medición</button>{onHistory && <button className="p-3 font-semibold text-institucional underline" onClick={() => onHistory(saved.ninos)}>Ver resultado e historial de este niño</button>}</div></section>
  return <section aria-labelledby="eval-title" className="evaluation-wizard">
    <h1 id="eval-title" className="text-3xl font-semibold">Evaluar a un niño registrado</h1><p className="guide-hint mt-2">Elige su expediente, completa las medidas y revisa antes de guardar.</p>
    <EvaluationSteps current={step} labels={['Elige al niño', 'Sus medidas', 'Revisar y guardar']} />
    {error && <p role="alert" className="portal-error">{error}</p>}
    {step === 0 && <>
      <h2 ref={heading} tabIndex={-1} className="guide-title">¿A quién vamos a evaluar?</h2>
      <ValidatedForm onSubmit={event => void find(event)} className="rounded-xl bg-fondo p-4"><label htmlFor="eval-search" className="font-medium">Nombre o expediente del niño</label><div className="mt-2 flex flex-wrap items-end gap-3"><input id="eval-search" className={`${input} min-w-0 flex-1`} required minLength={3} maxLength={80} value={search} onChange={event => setSearch(event.target.value)} disabled={searching} /><button className={button} disabled={searching}>{searching ? 'Buscando…' : 'Buscar niño'}</button></div><p className="mt-2 text-sm text-secundario">Escribe al menos 3 caracteres y elige su expediente.</p></ValidatedForm>
      {searched && children.length === 0 && <p role="status" className="mt-4">No se encontraron niños activos. Prueba con otro nombre o expediente.</p>}
      {selected && !searching && <button type="button" className="guide-edit" onClick={() => goTo(1)}>Continuar con {name(selected)} →</button>}
      <div className="evaluation-search-results">{children.map(child => <button type="button" key={child.codigo_publico} onClick={() => selectChild(child)}><strong>{name(child)}</strong><small>{child.codigo_expediente}</small><small>Nacimiento: {child.fecha_nacimiento.split('-').reverse().join('/')}</small><span>Evaluar a este niño →</span></button>)}</div>
    </>}
    {selected && step > 0 && <>
      <div className="evaluation-child-summary"><div><strong>{name(selected)}</strong><small>{selected.codigo_expediente} · Nació: {selected.fecha_nacimiento.split('-').reverse().join('/')}</small></div>{!initial && <button type="button" disabled={busy} onClick={() => goTo(0)}>Cambiar niño</button>}</div>
      <ValidatedForm key={`${selected.codigo_publico}-${step}`} onInput={updateDraft} onChange={updateDraft} onSubmit={event => void submit(event)}>
        <h2 ref={heading} tabIndex={-1} className="guide-title">{step === 1 ? '¿Cuánto pesa y mide?' : 'Confirma antes de guardar'}</h2>
        <p className="guide-hint">{step === 1 ? 'Usa las medidas tomadas con una báscula y un tallímetro.' : 'Estas medidas quedarán en el historial del niño seleccionado.'}</p>
        <fieldset disabled={busy || step !== 1} hidden={step !== 1}>
          <label className="evaluation-date">Fecha y hora de medición<input name="evaluado_en" type="datetime-local" required max={localNow()} value={date} onInput={event => setDate(event.currentTarget.value)} onChange={event => setDate(event.target.value)} /><small>{initial ? 'Confirma la fecha y hora real. ' : ''}Hora del dispositivo: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</small></label>
          <MeasurementFields methodName="tipo" weight={draft.peso} height={draft.talla} method={draft.tipo} />
        </fieldset>
        {step === 1 && <WeightReferenceHint compact birth={selected.fecha_nacimiento} measured={measurementDay(date)} sex={selected.sexo_biologico} weight={draft.peso} edema={draft.edema} onSessionExpired={onSessionExpired} />}
        <fieldset disabled={busy || step !== 2} hidden={step !== 2}>
          <div className="guide-review"><dl><div><dt>Peso</dt><dd>{draft.peso} kg</dd></div><div><dt>Longitud/talla</dt><dd>{draft.talla} cm</dd></div><div><dt>Se midió</dt><dd>{method(draft.tipo)}</dd></div><div><dt>Fecha de medición</dt><dd>{date ? dateLabel(new Date(date).toISOString()) : 'Sin fecha'}</dd></div></dl><button type="button" className="guide-edit" onClick={() => goTo(1)}>Cambiar medidas o fecha</button></div>
          {loading ? <p role="status">Consultando centros de salud…</p> : !centers.length ? <div className="portal-error"><p>No hay un centro activo disponible o no se pudo cargar el catálogo.</p><button type="button" className="guide-edit" onClick={() => { setLoading(true); setRevision(value => value + 1) }}>Volver a consultar centros</button></div> : <label className="evaluation-review-center">Centro de salud<select name="centro_salud_id" required className={input} value={center} onChange={event => setCenter(event.target.value)}><option value="">Seleccionar centro</option>{centers.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>}
          <EdemaField initial={draft.edema} />
          <details className="evaluation-options"><summary>Lugar y observaciones (opcional)</summary><label>Lugar de evaluación<select name="lugar" className={input} defaultValue={draft.lugar}><option value="CLINICA">Clínica</option><option value="VISITA_DOMICILIAR">Visita domiciliar</option><option value="JORNADA_COMUNITARIA">Jornada comunitaria</option><option value="OTRO">Otro</option></select></label><label>Observaciones<textarea name="observaciones" className={input} defaultValue={draft.observaciones} rows={3} maxLength={2000} /></label></details>
        </fieldset>
        <div className="guide-actions guide-actions-sticky"><button type="button" className="consult-secondary" disabled={busy} onClick={() => goTo(step === 2 ? 1 : 0)} hidden={step === 1 && Boolean(initial)}>← Atrás</button><button type="submit" className="portal-primary" disabled={busy || (step === 2 && (loading || !centers.length))}>{busy ? 'Guardando…' : step === 1 ? 'Continuar →' : renderSaved ? 'Guardar y ver resultado' : 'Guardar medición'}</button></div>
        <p className="family-caption">{step === 1 ? 'Todavía no se guarda nada. Puedes volver atrás sin perder las medidas.' : 'Al guardar se registra la medición.' + (renderSaved ? ' Después se calcula la orientación y se preparan los avisos.' : '')}</p>
      </ValidatedForm>
    </>}
  </section>
}

type HistoryProps = { canAnnul?: boolean; onSessionExpired: () => void; onCreate?: () => void }
export function EvaluacionesList({ initialChild, ...props }: HistoryProps & { initialChild?: Child | null }) {
  const [child, setChild] = useState<Child | null>(initialChild ?? null)
  const [search, setSearch] = useState('')
  const [children, setChildren] = useState<Child[]>([])
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  async function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setChildren([]); setSearched(false)
    try { setChildren(await fetch(`/api/evaluaciones/pacientes-historial?${new URLSearchParams({ busqueda: search.trim() })}`, { signal: AbortSignal.timeout(15000) }).then(readResponse<Child[]>)); setSearched(true) }
    catch (err) { if (err instanceof ApiError && err.status === 401) props.onSessionExpired(); else setError(message(err)) }
    finally { setBusy(false) }
  }
  if (child) return <><div className="mb-5 rounded-xl bg-azul-claro p-4"><p className="font-semibold">Historial de {name(child)}</p><p className="text-sm">Expediente: {child.codigo_expediente}</p><button className="mt-2 underline" onClick={() => { setChild(null); setChildren([]); setSearched(false) }}>Cambiar de niño</button></div><PatientHistory key={child.codigo_publico} child={child} {...props} /></>
  return <section><h1 className="text-3xl font-semibold">Historial de un niño</h1><p className="my-4">Busca y selecciona al niño. Después verás únicamente sus evaluaciones y reportes.</p><ValidatedForm onSubmit={event => void find(event)}><label htmlFor="history-child">Nombre o número de expediente</label><input id="history-child" required minLength={3} maxLength={80} className={input} value={search} onChange={event => setSearch(event.target.value)} disabled={busy} /><button className={`${button} mt-3`} disabled={busy}>{busy ? 'Buscando…' : 'Buscar niño'}</button></ValidatedForm>{error && <p role="alert" className="my-4">{error}</p>}{searched && !children.length && <p role="status" className="my-4">No se encontraron niños con evaluaciones para esa búsqueda.</p>}<ul className="mt-4 space-y-3">{children.map(row => <li key={row.codigo_publico}><button className="w-full rounded-xl border border-institucional/30 p-4 text-left" onClick={() => setChild(row)}><strong>{name(row)}</strong><span className="block text-sm">{row.codigo_expediente} · Ver su historial</span></button></li>)}</ul></section>
}
function PatientHistory({ child, onSessionExpired, onCreate, canAnnul = false }: HistoryProps & { child: Child }) {
  const [query, setQuery] = useState({ pagina: 1, revision: 0 })
  const [data, setData] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true; const controller = new AbortController()
    fetch(`/api/evaluaciones?${new URLSearchParams({ pagina: String(query.pagina), nino_codigo: child.codigo_publico })}`, { signal: controller.signal }).then(readResponse<Page>).then((rows) => { if (active) { setData(rows); setError('') } }).catch((err: unknown) => { if (active) { setData(null); if (err instanceof ApiError && err.status === 401) onSessionExpired(); else setError(message(err)) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [query, onSessionExpired, child.codigo_publico])
  function page(pagina: number) { setLoading(true); setQuery((old) => ({ pagina, revision: old.revision + 1 })) }
  return <section aria-labelledby="eval-history"><div className="flex flex-wrap items-start justify-between gap-4"><h1 id="eval-history" className="text-3xl font-semibold">Historial de evaluaciones</h1>{onCreate && <button className={button} onClick={onCreate}>Evaluar a un niño registrado</button>}</div><p className="mt-3 text-secundario">Mediciones más recientes primero. Fechas mostradas en hora de Guatemala.</p><p className="mt-4 rounded-lg bg-azul-claro p-4">1. Elige «Ver resultado y sugerencias». 2. Guarda el resultado si deseas conservarlo. 3. Genera el reporte para entregarlo a la familia.</p>
    {loading && <p role="status" className="mt-5">Cargando evaluaciones…</p>}
    {!loading && error && <div role="alert" className="mt-5 border-l-4 border-alerta bg-fondo p-4"><p>{error}</p><button className="mt-2 font-semibold text-institucional underline" onClick={() => page(query.pagina)}>Reintentar</button></div>}
    {!loading && data && <><p role="status" className="mt-5 text-sm text-secundario">{data.total} evaluaciones registradas</p>{!data.datos.length ? <p className="mt-4 rounded-lg border border-dashed border-institucional/30 p-6">No hay evaluaciones para mostrar en esta página.</p> : <div className="mt-4 space-y-4">{data.datos.map((item) => <article className="rounded-xl border border-institucional/20 p-4" key={item.codigo_publico}><div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-semibold">{name(item.ninos)}</h2><span className="rounded bg-fondo px-2 py-1 text-sm">{item.estado}</span></div><p className="mt-1 break-all text-sm text-secundario">{item.ninos.codigo_expediente}</p><p className="mt-3">{dateLabel(item.evaluado_en)} · {item.edad_dias} días de edad</p><dl className="mt-3 grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-secundario">Peso</dt><dd className="font-semibold">{item.peso_kg} kg</dd></div><div><dt className="text-sm text-secundario">{method(item.tipo_medicion)}</dt><dd className="font-semibold">{item.talla_cm} cm</dd></div><div><dt className="text-sm text-secundario">Centro</dt><dd>{item.centros_salud.nombre}</dd></div><div><dt className="text-sm text-secundario">Lugar</dt><dd>{item.lugar_evaluacion.replaceAll('_', ' ').toLowerCase()}</dd></div></dl><p className="mt-3 text-sm">Edema: {item.edema === 'SI' ? 'Presente' : item.edema === 'NO' ? 'Ausente' : 'Desconocido / no evaluado'}</p>{item.estado !== 'ANULADA' && <EvaluationCalculation code={item.codigo_publico} onSessionExpired={onSessionExpired} />}<SavedOrientations code={item.codigo_publico} canSave={Boolean(onCreate) && item.estado !== 'ANULADA'} onSessionExpired={onSessionExpired} />{item.estado === 'ANULADA' && <p className="mt-4 border-l-4 border-alerta bg-fondo p-3">Anulada{item.anulada_en ? ` el ${dateLabel(item.anulada_en)}` : ''}: {item.motivo_anulacion || 'Sin motivo disponible'}</p>}{canAnnul && item.estado === 'REGISTRADA' && <AnnulEvaluation code={item.codigo_publico} onSessionExpired={onSessionExpired} onSaved={() => page(query.pagina)} />}{item.observaciones && <p className="mt-4 whitespace-pre-wrap break-words border-t border-institucional/10 pt-3"><span className="font-medium">Observaciones: </span>{item.observaciones}</p>}</article>)}</div>}<div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p>Página {data.pagina} de {data.paginas}</p><div className="flex gap-2"><button disabled={data.pagina <= 1} className="rounded border border-institucional/30 px-3 py-2 disabled:opacity-40" onClick={() => page(data.pagina - 1)}>Anterior</button><button disabled={data.pagina >= data.paginas} className="rounded border border-institucional/30 px-3 py-2 disabled:opacity-40" onClick={() => page(data.pagina + 1)}>Siguiente</button></div></div></>}
  </section>
}
