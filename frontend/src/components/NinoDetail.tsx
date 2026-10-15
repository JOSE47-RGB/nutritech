import { NinoEditor } from './NinoEditor'
import { useEffect, useState } from 'react'
import { ApiError, readResponse } from './ninos-api'
import type { Nino } from './ninos-api'
import { GuardianForm } from './GuardianForm'
interface Guardian { codigo_publico: string; nombres: string; apellidos: string; telefono: string | null; correo: string | null; direccion: string | null; activo: boolean; parentesco: string; es_principal: boolean; autorizado_contacto: boolean }
interface Detail extends Nino { version_registro: number; direccion_referencia: string | null; creado_en: string; responsables: Guardian[] }
const kinships: Record<string, string> = { MADRE: 'Madre', PADRE: 'Padre', TUTOR: 'Tutor', ABUELO_A: 'Abuelo/a', OTRO: 'Otro' }
export function NinoDetail({ code, canEdit, onBack, onSessionExpired }: { code: string; canEdit: boolean; onBack: () => void; onSessionExpired: () => void }) {
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000); let active = true
    fetch(`/api/ninos/${code}`, { signal: controller.signal, credentials: 'same-origin' }).then(readResponse<Detail>)
      .then((value) => { if (active) { setData(value); setError('') } })
      .catch((err: unknown) => { if (active) { setData(null); if (err instanceof ApiError && err.status === 401) onSessionExpired(); else setError(err instanceof ApiError ? err.message : 'No se pudo consultar el expediente.') } })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [code, revision, onSessionExpired])
  function reload() { setLoading(true); setRevision((value) => value + 1) }
  async function primary(person: string) {
    if (saving) return
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/ninos/${code}/responsables/${person}/principal`, { method: 'POST', credentials: 'same-origin', headers: { 'X-NutriTech-Request': '1' }, signal: AbortSignal.timeout(15000) })
      await readResponse(response); setNotice('Responsable principal actualizado.'); reload()
    } catch (err) { if (err instanceof ApiError && err.status === 401) onSessionExpired(); else setError(err instanceof ApiError ? err.message : 'No se pudo confirmar el cambio. Actualiza el expediente antes de reintentar.') }
    finally { setSaving(false) }
  }
  return <section>
    <div className="mb-6 flex flex-wrap justify-between gap-3"><button type="button" onClick={onBack} className="font-semibold text-institucional underline">Volver al listado</button><button type="button" disabled={loading || saving || adding || editing} onClick={reload} className="text-sm text-institucional underline disabled:opacity-40">Actualizar expediente</button></div>
    {loading && <p role="status">Cargando expediente…</p>}
    {error && <p role="alert" className="mb-5 border-l-4 border-alerta bg-fondo p-3">{error}</p>}
    {notice && <p role="status" className="mb-5 border-l-4 border-salud bg-verde-claro p-3">{notice}</p>}
    {!loading && data && <>
      <p className="break-all text-sm font-medium text-institucional">{data.codigo_expediente}</p><h1 className="mt-2 text-3xl font-semibold">{[data.primer_nombre, data.segundo_nombre, data.primer_apellido, data.segundo_apellido].filter(Boolean).join(' ')}</h1>
      {canEdit && !editing && !adding && <button type="button" onClick={() => setEditing(true)} className="mt-4 rounded border border-institucional px-4 py-2 text-institucional">Editar datos generales</button>}
      {editing && canEdit && <NinoEditor data={data} onCancel={() => setEditing(false)} onSessionExpired={onSessionExpired} onSaved={() => { setEditing(false); setNotice('Expediente actualizado.'); reload() }} />}
      <dl className="mt-7 grid gap-5 rounded-xl bg-fondo p-5 sm:grid-cols-2">
        {Object.entries({ 'Fecha de nacimiento': data.fecha_nacimiento.split('-').reverse().join('/'), 'Sexo biológico': data.sexo_biologico === 'M' ? 'Masculino' : 'Femenino', Estado: data.estado === 'ACTIVO' ? 'Activo' : data.estado === 'INACTIVO' ? 'Inactivo' : 'Archivado', Comunidad: data.comunidad || 'Sin asignar', Certificado: `•••• ${data.certificado_ultimos4}`, 'Dirección de referencia': data.direccion_referencia || 'Sin registrar' }).map(([label, value]) => <div key={label}><dt className="text-sm text-secundario">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
      </dl>
      <div className="mt-9 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">Responsables familiares</h2>{canEdit && data.estado === 'ACTIVO' && !adding && !editing && <button type="button" onClick={() => setAdding(true)} className="rounded-lg bg-institucional px-4 py-3 font-semibold text-white">Vincular responsable</button>}</div>
      {adding && canEdit && data.estado === 'ACTIVO' && <GuardianForm code={code} first={!data.responsables.some((person) => person.es_principal)} onSessionExpired={onSessionExpired} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); setNotice('Responsable vinculado correctamente.'); reload() }} />}
      {data.responsables.length === 0 && <p className="mt-5 rounded-xl border border-dashed border-institucional/25 p-6 text-secundario">Este expediente todavía no tiene responsables vinculados.</p>}
      <div className="mt-5 space-y-4">{data.responsables.map((person) => <article key={person.codigo_publico} className="rounded-xl border border-institucional/15 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{person.nombres} {person.apellidos}</h3><p className="mt-1 text-sm text-secundario">{kinships[person.parentesco] || person.parentesco}{!person.activo && ' · Inactivo'}</p></div>{person.es_principal && <span className="rounded-full bg-verde-claro px-3 py-1 text-sm font-medium">Principal</span>}</div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{Object.entries({ Teléfono: person.telefono || 'Sin registrar', Correo: person.correo || 'Sin registrar', Dirección: person.direccion || 'Sin registrar', Contacto: person.autorizado_contacto ? 'Autorizado' : 'No autorizado' }).map(([label, value]) => <div key={label}><dt className="text-secundario">{label}</dt><dd className="mt-1 break-words text-base">{value}</dd></div>)}</dl>
        {canEdit && data.estado === 'ACTIVO' && person.activo && !person.es_principal && <button type="button" disabled={saving || adding || editing} onClick={() => primary(person.codigo_publico)} className="mt-4 rounded-lg border border-institucional px-3 py-2 text-sm font-semibold text-institucional disabled:opacity-50">{saving ? 'Guardando…' : 'Marcar como principal'}</button>}
      </article>)}</div>
    </>}
  </section>
}
