import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, readResponse } from './ninos-api'
import { ValidatedForm } from './ValidatedForm'
type Community = { id: string; nombre: string; municipio: string; departamento: string; activo: boolean; revision: string }
export function Communities({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [rows, setRows] = useState<Community[]>([])
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [revision, refresh] = useState(0)
  const [editing, setEditing] = useState<Community | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/admin/comunidades?${new URLSearchParams({ buscar: search })}`, { signal: controller.signal }).then(readResponse<Community[]>).then(setRows).catch((err: unknown) => {
      if (controller.signal.aborted) return
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [search, revision, onSessionExpired])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    const fields = new FormData(event.currentTarget)
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await readResponse<Community>(await fetch(`/api/admin/comunidades${editing && editing !== 'new' ? `/${editing.id}` : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NutriTech-Request': '1' }, body: JSON.stringify({ nombre: String(fields.get('nombre')).trim(), municipio: String(fields.get('municipio')).trim(), departamento: String(fields.get('departamento')).trim(), activo: fields.get('activo') === 'on', ...(editing && editing !== 'new' ? { revision: editing.revision } : {}) }) }))
      setNotice(`${result.nombre}: cambios guardados. ${result.activo ? 'Disponible al registrar niños.' : 'Oculta para nuevos registros; se conservan los expedientes existentes.'}`)
      setEditing(null); setLoading(true); refresh(v => v + 1)
    } catch (err) { if (err instanceof ApiError && err.status === 401) onSessionExpired(); else setError(err instanceof Error ? err.message : 'No se pudo guardar. Tus datos siguen en el formulario.') }
    finally { setBusy(false) }
  }
  const current = editing && editing !== 'new' ? editing : null
  return <section><p className="portal-eyebrow">Catálogos</p><h1>Comunidades</h1><p className="home-intro">Administra las opciones que aparecen al registrar a un niño.</p>
    {notice && <p role="status" className="rounded-xl bg-verde-claro p-4 mb-4">{notice}</p>}
    {error && <p role="alert" className="portal-error">{error}</p>}
    {editing ? <ValidatedForm key={current?.id || 'new'} onSubmit={event => void save(event)}><h2 className="text-xl font-semibold mb-4">{current ? 'Editar comunidad' : 'Agregar comunidad'}</h2><fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
      <label className="sm:col-span-2">Nombre de la comunidad<input name="nombre" required minLength={2} maxLength={120} defaultValue={current?.nombre} className="w-full border p-3 mt-2" placeholder="Ej. Las Flores" /></label>
      <label>Municipio<input name="municipio" required minLength={2} maxLength={100} defaultValue={current?.municipio ?? 'Génova Costa Cuca'} className="w-full border p-3 mt-2" /></label>
      <label>Departamento<input name="departamento" required minLength={2} maxLength={100} defaultValue={current?.departamento ?? 'Quetzaltenango'} className="w-full border p-3 mt-2" /></label>
      <label className="sm:col-span-2 flex gap-3 items-center"><input name="activo" type="checkbox" defaultChecked={current?.activo ?? true} />Disponible para nuevos registros</label>
      <p className="sm:col-span-2 text-sm text-secundario">Al desactivar una comunidad, sus expedientes se conservan.</p>
      <div className="sm:col-span-2 flex flex-wrap gap-3"><button className="portal-primary">{busy ? 'Guardando…' : 'Guardar comunidad'}</button><button type="button" className="consult-secondary" onClick={() => { setEditing(null); setError('') }}>Cancelar</button></div>
    </fieldset></ValidatedForm> : <><div className="flex flex-wrap gap-3 justify-between mb-5"><form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setLoading(true); setError(''); setSearch(query.trim()); refresh(v => v + 1) }}><input aria-label="Buscar comunidad o municipio" placeholder="Nombre o municipio" value={query} maxLength={120} onChange={event => setQuery(event.target.value)} className="border p-3"/><button className="consult-secondary">Buscar</button></form><button className="portal-primary" onClick={() => { setEditing('new'); setError(''); setNotice('') }}>+ Agregar comunidad</button></div>
      {loading ? <p role="status">Cargando comunidades…</p> : <><p className="text-sm text-secundario mb-3">{rows.length} resultados{rows.length === 100 ? ' · Se muestran hasta 100; busca por nombre para acotar.' : ''}</p>{!rows.length && !error && <p className="portal-info">No hay resultados. Prueba otro nombre o agrega una comunidad.</p>}<div className="grid gap-3">{rows.map(row => <article key={row.id} className="rounded-xl border border-institucional/20 p-4 flex flex-wrap justify-between gap-3 items-center"><div><h2 className="font-semibold text-institucional">{row.nombre}</h2><p className="text-sm text-secundario">{row.municipio} · {row.departamento}</p><span className="text-sm">{row.activo ? 'Disponible' : 'Inactiva'}</span></div><button className="consult-secondary" aria-label={`Editar ${row.nombre}`} onClick={() => { setEditing(row); setError(''); setNotice('') }}>Editar</button></article>)}</div></>}
    </>}
  </section>
}
