import { ValidatedForm } from './ValidatedForm'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, readResponse } from './ninos-api'

interface Person { dpi_ultimos4?: string | null; codigo_publico: string; nombres: string; apellidos: string; telefono: string | null }
const input = 'mt-2 w-full rounded-lg border border-secundario/40 bg-white px-3 py-2.5 focus:ring-2 focus:ring-institucional outline-none'
export function GuardianForm({ code, first, onSaved, onCancel, onSessionExpired, apiBase = '/api/ninos' }: { apiBase?: string; code: string; first: boolean; onSaved: () => void; onCancel: () => void; onSessionExpired: () => void }) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [selected, setSelected] = useState<Person | null>(null)
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  function failure(err: unknown) {
    if (err instanceof ApiError && err.status === 401) onSessionExpired()
    else setError(err instanceof ApiError ? err.message : 'No se pudo confirmar la operación. Actualiza el expediente antes de reintentar.')
  }
  async function search() {
    if (busy) return
    if (query.trim().length < 3) { setError('Escribe al menos tres caracteres.'); return }
    setBusy(true); setError(''); setSelected(null); setResults([])
    try {
      const response = await fetch(`${apiBase}/responsables/buscar`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NutriTech-Request': '1' }, body: JSON.stringify({ busqueda: query.trim() }), credentials: 'same-origin', signal: AbortSignal.timeout(8000) })
      setResults(await readResponse<Person[]>(response)); setSearched(true)
    } catch (err) { failure(err) } finally { setBusy(false) }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || inFlight.current) return
    if (mode === 'existing' && !selected) { setError('Busca y selecciona al responsable.'); return }
    const form = new FormData(event.currentTarget)
    const responsable = Object.fromEntries(['dpi', 'nombres', 'apellidos', 'telefono', 'correo', 'direccion'].map((key) => [key, String(form.get(key) || '').trim()]).filter(([, value]) => value))
    inFlight.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(`${apiBase}/${code}/responsables`, {
        method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', 'X-NutriTech-Request': '1' },
        body: JSON.stringify({ ...(mode === 'new' ? { responsable } : { responsable_codigo: selected!.codigo_publico }), parentesco: form.get('parentesco'), es_principal: form.has('es_principal'), autorizado_contacto: form.has('autorizado_contacto') }),
      })
      await readResponse(response); onSaved()
    } catch (err) { failure(err) } finally { inFlight.current = false; setBusy(false) }
  }
  return <section aria-labelledby="guardian-form-title" className="mt-6 rounded-xl border border-institucional/20 bg-fondo p-5">
    <h3 id="guardian-form-title" className="text-xl font-semibold">Vincular madre, padre o responsable</h3>
    <div className="mt-4 flex flex-wrap gap-2">{(['existing', 'new'] as const).map((value) => <button key={value} type="button" disabled={busy} aria-pressed={mode === value} onClick={() => { setMode(value); setError('') }} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${mode === value ? 'bg-institucional text-white' : 'bg-white text-institucional'}`}>{value === 'existing' ? 'Buscar existente' : 'Registrar nuevo'}</button>)}</div>
    {mode === 'existing' && <div className="mt-5">
      <label htmlFor="guardian-search" className="text-sm font-medium">Buscar por DPI completo, nombre, apellido o teléfono</label>
      <div className="flex items-end gap-2"><input id="guardian-search" maxLength={80} value={query} disabled={busy} onChange={(event) => { setQuery(event.target.value); setSelected(null); setSearched(false); setResults([]) }} className={input} /><button type="button" onClick={search} disabled={busy} className="rounded-lg border border-institucional bg-white px-3 py-2.5 text-institucional">Buscar</button></div>
      {searched && !results.length && <p className="mt-3 text-sm">No se encontraron responsables. Puedes registrar uno nuevo.</p>}
      {results.length > 0 && <fieldset className="mt-3 space-y-2"><legend className="mb-2 text-sm text-secundario">Selecciona a la persona correcta (máximo 20 resultados).</legend>{results.map((person) => <label key={person.codigo_publico} className="flex cursor-pointer items-start gap-3 rounded-lg border border-institucional/20 bg-white p-3"><input type="radio" name="chosen-person" disabled={busy} checked={selected?.codigo_publico === person.codigo_publico} onChange={() => setSelected(person)} className="mt-1 accent-institucional" /><span>{person.nombres} {person.apellidos}<span className="block text-sm text-secundario">{person.telefono || 'Sin teléfono registrado'}{person.dpi_ultimos4 && ` · DPI terminado en ${person.dpi_ultimos4}`}</span></span></label>)}</fieldset>}
    </div>}
    <ValidatedForm onSubmit={submit} className="mt-5"><fieldset disabled={busy} className="space-y-5"><legend className="sr-only">Datos y vínculo del responsable</legend>
      {mode === 'new' && <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label htmlFor="guardian-dpi" className="text-sm font-medium">DPI (opcional)</label><input id="guardian-dpi" name="dpi" inputMode="numeric" pattern="[0-9]{13}" minLength={13} maxLength={13} placeholder="13 dígitos, sin espacios" className={input} /><p className="mt-2 text-sm text-secundario">Permite encontrar a la misma persona para vincular a sus hijos. Si no dispone del DPI, puedes continuar sin él.</p></div>
        <div><label htmlFor="guardian-name" className="text-sm font-medium">Nombres *</label><input id="guardian-name" name="nombres" required minLength={2} maxLength={120} className={input} /></div>
        <div><label htmlFor="guardian-lastname" className="text-sm font-medium">Apellidos *</label><input id="guardian-lastname" name="apellidos" required minLength={2} maxLength={120} className={input} /></div>
        <div><label htmlFor="guardian-phone" className="text-sm font-medium">Teléfono</label><input id="guardian-phone" name="telefono" type="tel" minLength={7} maxLength={25} className={input} /></div>
        <div><label htmlFor="guardian-email" className="text-sm font-medium">Correo electrónico (opcional)</label><input id="guardian-email" name="correo" type="email" maxLength={160} className={input} /></div>
        <div className="sm:col-span-2"><label htmlFor="guardian-address" className="text-sm font-medium">Dirección</label><input id="guardian-address" name="direccion" maxLength={255} className={input} /></div>
      </div>}
      <div><label htmlFor="kinship" className="text-sm font-medium">Parentesco con el niño *</label><select id="kinship" name="parentesco" required defaultValue="" className={input}><option value="" disabled>Selecciona una opción</option><option value="MADRE">Madre</option><option value="PADRE">Padre</option><option value="TUTOR">Tutor</option><option value="ABUELO_A">Abuelo/a</option><option value="OTRO">Otro</option></select></div>
      <label className="flex items-center gap-3"><input type="checkbox" name="es_principal" defaultChecked={first} className="h-4 w-4 accent-institucional" />Responsable principal</label>
      <p className="text-sm text-secundario">Si eliges un nuevo principal, el anterior conservará su vínculo como responsable.</p>
      <label className="flex items-center gap-3"><input type="checkbox" name="autorizado_contacto" defaultChecked className="h-4 w-4 accent-institucional" />Autorizado para contacto</label>
      {error && <p role="alert" className="border-l-4 border-alerta bg-white p-3">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" className="rounded-lg bg-institucional px-4 py-3 font-semibold text-white">{busy ? 'Procesando…' : 'Guardar vínculo'}</button><button type="button" onClick={onCancel} className="rounded-lg border border-institucional px-4 py-3 text-institucional">Cancelar</button></div>
    </fieldset></ValidatedForm>
  </section>
}
