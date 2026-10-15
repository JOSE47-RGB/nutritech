import { ValidatedForm } from './ValidatedForm'
import { GuardianForm } from './GuardianForm'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, readResponse } from './ninos-api'
import type { Nino } from './ninos-api'

interface Community { id: string; nombre: string; municipio: string; departamento: string }
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const input = 'mt-2 w-full rounded-lg border border-secundario/40 bg-white px-3 py-3 outline-none focus:border-institucional focus:ring-2 focus:ring-institucional/20'

export function NinoForm({ onSessionExpired, onViewList, onCreated, initial, apiBase = '/api/ninos', canLinkGuardians = false, onAbort }: { onAbort?: () => void; canLinkGuardians?: boolean; onSessionExpired: () => void; onViewList?: () => void; onCreated?: (child: Nino) => void; initial?: { birth: string; sex: string }; apiBase?: string }) {
  const [addingGuardian, setAddingGuardian] = useState(true)
  const [guardianCount, setGuardianCount] = useState(0)
  const [communities, setCommunities] = useState<Community[]>([])
  const [catalogError, setCatalogError] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<Nino | null>(null)
  const inFlight = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    let active = true
    fetch(`${apiBase}/comunidades`, { signal: controller.signal, credentials: 'same-origin' })
      .then(readResponse<Community[]>)
      .then((rows) => { if (active) { setCommunities(rows); setCatalogError('') } })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof ApiError && err.status === 401) onSessionExpired()
        else setCatalogError(err instanceof ApiError ? err.message : 'No se pudieron cargar las comunidades. Puedes reintentar o registrar sin asignar comunidad.')
      })
      .finally(() => { clearTimeout(timeout); if (active) setCatalogLoading(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [catalogRevision, onSessionExpired, apiBase])

  useEffect(() => { if (created) heading.current?.focus() }, [created])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const form = event.currentTarget
    const data = new FormData(form)
    const fields = ['certificado', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'fecha_nacimiento', 'sexo_biologico', 'comunidad_id', 'direccion_referencia']
    const body = Object.fromEntries(fields.map((field) => [field, String(data.get(field) ?? '').trim()]).filter(([, value]) => value !== ''))
    if (!/^[A-Za-z0-9\s-]+$/.test(body.certificado || '') || !/^[A-Za-z0-9]{4,80}$/.test((body.certificado || '').replace(/[\s-]/g, ''))) {
      setError('El certificado debe tener entre 4 y 80 letras o números, sin contar espacios y guiones.'); return
    }
    for (const field of ['primer_nombre', 'primer_apellido']) {
      if ((body[field] || '').length < 2) { setError('Escribe al menos dos caracteres en el primer nombre y primer apellido. Los espacios solos no son válidos.'); return }
    }
    inFlight.current = true; setSaving(true); setError('')
    try {
      const response = await fetch(apiBase, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-NutriTech-Request': '1' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      })
      const result = await readResponse<Nino>(response)
      form.reset(); setCreated(result); if (!canLinkGuardians) onCreated?.(result)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof ApiError ? err.message : 'No se pudo confirmar el registro. Comprueba el listado antes de reintentar; el certificado evita duplicados.')
    } finally { inFlight.current = false; setSaving(false) }
  }

  if (created) return <section>
    <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-salud">Registro completado</p>
    <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold outline-none">Expediente creado</h1>
    <p className="mt-5 text-lg">{created.primer_nombre} {created.primer_apellido}</p>
    <p className="mt-2 break-all rounded-lg bg-azul-claro p-4 font-medium text-institucional">{created.codigo_expediente}</p>
    <p className="mt-4 text-secundario">Certificado terminado en {created.certificado_ultimos4}. El registro se guardó correctamente.</p>
    {canLinkGuardians && <div className="mt-7"><h2 className="text-2xl font-semibold text-institucional">Padres y responsables</h2><p className="mt-2">Busca por DPI y selecciona a la madre o al padre. Si no existe, elige «Registrar nuevo». Puedes añadir a ambos y elegir al contacto principal.</p>{guardianCount > 0 && <p role="status" className="mt-3 rounded bg-verde-claro p-3">{guardianCount} vínculo(s) guardado(s) en este registro.</p>}{addingGuardian ? <GuardianForm key={guardianCount} apiBase={apiBase} code={created.codigo_publico} first={guardianCount === 0} onSessionExpired={onSessionExpired} onSaved={() => { setGuardianCount(count => count + 1); setAddingGuardian(false) }} onCancel={() => setAddingGuardian(false)} /> : <button className="portal-primary" onClick={() => setAddingGuardian(true)}>Añadir madre, padre u otro responsable</button>}</div>}
    {(!canLinkGuardians || !addingGuardian) && <div className="mt-7 flex flex-wrap gap-3">{onCreated ? <button type="button" onClick={() => onCreated(created)} className="rounded-lg bg-institucional px-4 py-3 font-semibold text-white">{guardianCount ? 'Continuar con la evaluación' : 'Continuar sin vincular responsables'}</button> : <>{onViewList && <button type="button" onClick={onViewList} className="rounded-lg bg-institucional px-4 py-3 font-semibold text-white">Finalizar y ver listado</button>}<button type="button" onClick={() => { setCreated(null); setGuardianCount(0); setAddingGuardian(true); setFormKey(value => value + 1) }} className="rounded-lg border border-institucional px-4 py-3 font-semibold text-institucional">Registrar otro niño</button></>}</div>}
  </section>

  return <section aria-labelledby="register-title">
    <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-institucional">Nuevo expediente</p>
    <h1 id="register-title" className="text-3xl font-semibold">Registrar niño</h1>
    <p className="mt-3 text-secundario">Completa los datos según el certificado de nacimiento. Los campos con * son obligatorios. {canLinkGuardians && 'Después de guardar podrás vincular aquí a sus padres o responsables.'}</p>
    <ValidatedForm key={formKey} onSubmit={submit} autoComplete="off" className="mt-7">
      <fieldset disabled={saving} className="space-y-7 disabled:opacity-70">
        <legend className="sr-only">Datos del niño</legend>
        <div className="rounded-xl bg-azul-claro p-5"><label htmlFor="certificado" className="text-sm font-semibold">Número de certificado de nacimiento *</label><input id="certificado" name="certificado" required minLength={4} maxLength={120} spellCheck={false} autoCapitalize="characters" aria-describedby="cert-help" className={input} /><p id="cert-help" className="mt-2 text-sm text-secundario">Se usará para evitar expedientes duplicados. En el listado solo se mostrarán los últimos cuatro caracteres.</p></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label htmlFor="primer-nombre" className="text-sm font-semibold">Primer nombre *</label><input id="primer-nombre" name="primer_nombre" required minLength={2} maxLength={80} className={input} /></div>
          <div><label htmlFor="segundo-nombre" className="text-sm font-semibold">Segundo nombre (opcional)</label><input id="segundo-nombre" name="segundo_nombre" maxLength={80} className={input} /></div>
          <div><label htmlFor="primer-apellido" className="text-sm font-semibold">Primer apellido *</label><input id="primer-apellido" name="primer_apellido" required minLength={2} maxLength={80} className={input} /></div>
          <div><label htmlFor="segundo-apellido" className="text-sm font-semibold">Segundo apellido (opcional)</label><input id="segundo-apellido" name="segundo_apellido" maxLength={80} className={input} /></div>
          <div><label htmlFor="fecha-nacimiento" className="text-sm font-semibold">Fecha de nacimiento *</label><input id="fecha-nacimiento" name="fecha_nacimiento" defaultValue={initial?.birth} type="date" required max={today()} min="1000-01-01" className={input} /></div>
          <div><label htmlFor="sexo-biologico" className="text-sm font-semibold">Sexo biológico *</label><select id="sexo-biologico" name="sexo_biologico" required defaultValue={initial?.sex ?? ""} className={input}><option value="" disabled>Selecciona una opción</option><option value="M">Masculino</option><option value="F">Femenino</option></select></div>
        </div>
        <div><label htmlFor="comunidad" className="text-sm font-semibold">Comunidad (opcional)</label><select id="comunidad" name="comunidad_id" defaultValue="" disabled={catalogLoading || communities.length === 0} className={input}><option value="">{catalogLoading ? 'Cargando comunidades…' : 'Sin asignar'}</option>{communities.map((community) => <option key={community.id} value={community.id}>{community.nombre} · {community.municipio}</option>)}</select>
          {!catalogLoading && !catalogError && communities.length === 0 && <p className="mt-2 text-sm text-secundario">Aún no hay comunidades en el catálogo. Este campo es opcional.</p>}
          {catalogError && <div role="alert" className="mt-3 border-l-4 border-advertencia bg-fondo p-3 text-sm"><p>{catalogError}</p><button type="button" onClick={() => { setCatalogLoading(true); setCatalogRevision((value) => value + 1) }} className="mt-2 font-semibold text-institucional underline">Reintentar comunidades</button></div>}
        </div>
        <div><label htmlFor="direccion" className="text-sm font-semibold">Dirección de referencia (opcional)</label><textarea id="direccion" name="direccion_referencia" maxLength={255} rows={3} className={input} /></div>
        {error && <p role="alert" className="rounded-lg border-l-4 border-alerta bg-fondo p-4">{error}</p>}
        <div className="flex flex-wrap gap-3"><button type="submit" className="rounded-lg bg-institucional px-5 py-3 font-semibold text-white hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-institucional">{saving ? 'Guardando…' : 'Guardar expediente'}</button>{onAbort && <button type="button" onClick={onAbort} className="rounded-lg border px-5 py-3">Volver a la consulta sin guardar</button>}</div>
      </fieldset>
    </ValidatedForm>
  </section>
}
