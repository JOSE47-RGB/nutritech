import { useState, type FormEvent } from 'react'
import { ApiError, readResponse, type Nino } from './ninos-api'
export type EditableChild = Nino & { direccion_referencia: string | null; version_registro: number }
export function NinoEditor({ data, onCancel, onSaved, onSessionExpired }: { data: EditableChild; onCancel: () => void; onSaved: () => void; onSessionExpired: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form.entries())
    setBusy(true); setError('')
    try {
      await readResponse(await fetch(`/api/ninos/${data.codigo_publico}/editar`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-NutriTech-Request': '1' }, body: JSON.stringify({ ...body, version_registro: data.version_registro }), signal: AbortSignal.timeout(15000) }))
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof ApiError ? err.message : 'No se pudo confirmar el cambio. Cancela y actualiza el expediente antes de reintentar.')
    } finally { setBusy(false) }
  }
  return <form onSubmit={event => void save(event)} className="mt-6 rounded-xl border border-institucional/25 p-5"><h2 className="text-xl font-semibold">Editar datos generales</h2><p className="mt-2 text-sm">Los cambios se registran con su motivo. Los reportes ya generados conservan la identificación anterior. Esta pantalla no modifica certificado, comunidad, fecha de nacimiento ni sexo biológico.</p><fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2">{([
    ['primer_nombre', 'Primer nombre', true], ['segundo_nombre', 'Segundo nombre', false], ['primer_apellido', 'Primer apellido', true], ['segundo_apellido', 'Segundo apellido', false],
  ] as const).map(([key, label, required]) => <label key={key}>{label}<input name={key} defaultValue={data[key] ?? ''} required={required} minLength={required ? 2 : undefined} maxLength={80} className="mt-1 block w-full rounded border p-2" /></label>)}<label className="sm:col-span-2">Dirección de referencia<textarea name="direccion_referencia" defaultValue={data.direccion_referencia ?? ''} maxLength={255} className="mt-1 block w-full rounded border p-2" /></label><label>Estado<select name="estado" defaultValue={data.estado} className="mt-1 block w-full rounded border p-2"><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option><option value="ARCHIVADO">Archivado</option></select></label><p className="text-sm text-secundario">Inactivo o archivado impide nuevas capturas; conserva las evaluaciones y permite volver a activar el expediente.</p><label className="sm:col-span-2">Motivo del cambio<textarea name="motivo" required minLength={5} maxLength={500} className="mt-1 block w-full rounded border p-2" /></label><div className="flex gap-3 sm:col-span-2"><button className="rounded bg-institucional px-4 py-2 text-white">{busy ? 'Guardando…' : 'Guardar cambios'}</button><button type="button" onClick={onCancel} className="rounded border px-4 py-2">Cancelar</button></div></fieldset>{error && <p role="alert" className="mt-3 text-alerta">{error}</p>}</form>
}
