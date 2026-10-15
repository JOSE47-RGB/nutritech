import { useState, type FormEvent } from 'react'
import { ApiError, readResponse } from './ninos-api'
export function AnnulEvaluation({ code, onSaved, onSessionExpired }: { code: string; onSaved: () => void; onSessionExpired: () => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await readResponse(await fetch(`/api/evaluaciones/${code}/anular`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-NutriTech-Request': '1' }, body: JSON.stringify({ motivo: reason.trim() }) }))
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof Error ? err.message : 'No se pudo anular la evaluación.')
    } finally { setBusy(false) }
  }
  if (!open) return <button type="button" className="mt-4 text-alerta underline" onClick={() => setOpen(true)}>Anular captura incorrecta</button>
  return <form onSubmit={event => void submit(event)} className="mt-4 rounded border border-alerta p-4"><h3 className="font-semibold">Anular esta evaluación</h3><p className="my-3">La medición quedará anulada y conservará su historial. Los reportes anteriores no cambian y las alertas siguen requiriendo revisión. Esta acción no se puede deshacer desde la aplicación.</p><fieldset disabled={busy}><label className="block">Motivo de anulación<textarea required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 block w-full rounded border p-2" rows={3} /></label><div className="mt-3 flex gap-3"><button disabled={reason.trim().length < 5 || busy} className="rounded bg-alerta px-4 py-2 text-white disabled:opacity-50">{busy ? 'Anulando…' : 'Confirmar anulación'}</button><button type="button" onClick={() => { setOpen(false); setError('') }} className="rounded border px-4 py-2">Cancelar</button></div></fieldset>{error && <p role="alert" className="mt-3 text-alerta">{error}</p>}</form>
}
