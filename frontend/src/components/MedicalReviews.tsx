import { useState } from 'react'
import { ApiError, readResponse } from './ninos-api'
type History = { puede_valorar: boolean; datos: { codigo_publico: string; decision: string; valoracion: string; acciones: string; registrado_en: string; autor: string }[] }
export function MedicalReviews({ evaluation, orientation, onSessionExpired }: { evaluation: string; orientation: string; onSessionExpired: () => void }) {
  const [data, setData] = useState<History | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [decision, setDecision] = useState('REQUIERE_INFORMACION')
  const [text, setText] = useState('')
  const [actions, setActions] = useState('')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const url = `/api/evaluaciones/${evaluation}/orientaciones/${orientation}/valoraciones`
  async function run(save: boolean) {
    setBusy(true); setError(''); setNotice('')
    try {
      if (save) {
        await readResponse(await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-NutriTech-Request': '1' }, body: JSON.stringify({ solicitud_id: requestId, decision, valoracion: text, acciones: actions }) }))
        setNotice('Valoración registrada. El resultado automático original se conserva.'); setText(''); setActions(''); setRequestId(crypto.randomUUID())
      }
      setData(await readResponse<History>(await fetch(url, { credentials: 'same-origin' })))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof Error ? err.message : 'No se pudo completar la operación.')
    } finally { setBusy(false) }
  }
  const changed = () => setRequestId(crypto.randomUUID())
  return <section className="mt-4 border-t border-institucional/20 pt-3" aria-label="Valoraciones médicas">
    <h4 className="font-semibold">Valoración médica</h4>
    <button type="button" disabled={busy} onClick={() => void run(false)} className="mt-2 text-institucional underline disabled:opacity-50">Consultar valoraciones y permisos</button>
    {error && <p role="alert" className="mt-2 text-alerta">{error}</p>}
    {notice && <p role="status" className="mt-2">{notice}</p>}
    {busy && <p role="status">Procesando…</p>}
    {data && <>
      <p className="mt-2 text-sm">{data.datos.length ? 'Historial de valoraciones (hasta 20, más recientes primero).' : 'Sin valoración médica registrada.'}</p>
      {data.datos.map(row => <article key={row.codigo_publico} className="mt-3 rounded bg-fondo p-3"><p className="font-medium">{row.decision.replaceAll('_', ' ')} · {row.autor}</p><p className="text-xs">{new Date(row.registrado_en).toLocaleString('es-GT', { timeZone: 'America/Guatemala' })}</p><p className="mt-2 whitespace-pre-wrap break-words">{row.valoracion}</p><p className="mt-2 whitespace-pre-wrap break-words"><strong>Acciones indicadas: </strong>{row.acciones}</p></article>)}
      {data.puede_valorar ? <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void run(true) }}>
        <fieldset disabled={busy} className="space-y-3"><legend className="font-medium">Registrar una nueva valoración</legend>
        <label className="block">Interpretación<select className="mt-1 block w-full rounded border p-2" value={decision} onChange={event => { setDecision(event.target.value); changed() }}><option value="REQUIERE_INFORMACION">Requiere información adicional</option><option value="COINCIDE">Coincide con la orientación</option><option value="DIFIERE">Difiere de la orientación</option></select></label>
        <label className="block">Valoración y fundamento<textarea required minLength={10} maxLength={4000} value={text} onChange={event => { setText(event.target.value); changed() }} className="mt-1 block w-full rounded border p-2" rows={3} /></label>
        <label className="block">Acciones indicadas<textarea required minLength={10} maxLength={4000} value={actions} onChange={event => { setActions(event.target.value); changed() }} className="mt-1 block w-full rounded border p-2" rows={3} /></label>
        <p className="text-sm">Se conservarán autor y fecha. Una aclaración posterior se registra como una nueva valoración.</p>
        <button className="rounded bg-institucional px-3 py-2 text-white" type="submit">Registrar valoración</button></fieldset>
      </form> : <p className="mt-2 text-sm">El registro requiere autorización para valoración médica y una evaluación no anulada.</p>}
    </>}
  </section>
}
