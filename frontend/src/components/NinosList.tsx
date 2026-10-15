import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, readResponse } from './ninos-api'
import type { NinosPage } from './ninos-api'

export function NinosList({ onSessionExpired, onCreate, onOpen }: { onSessionExpired: () => void; onCreate?: () => void; onOpen: (code: string) => void }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ACTIVO')
  const [query, setQuery] = useState({ busqueda: '', estado: 'ACTIVO', pagina: 1, revision: 0 })
  const [data, setData] = useState<NinosPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    let active = true
    const params = new URLSearchParams({ busqueda: query.busqueda, estado: query.estado, pagina: String(query.pagina), limite: '20' })
    fetch(`/api/ninos?${params}`, { credentials: 'same-origin', signal: controller.signal })
      .then(readResponse<NinosPage>)
      .then((result) => { if (active) { setData(result); setError('') } })
      .catch((err: unknown) => {
        if (!active) return
        setData(null)
        if (err instanceof ApiError && err.status === 401) onSessionExpired()
        else setError(err instanceof ApiError ? err.message : 'No se pudo consultar el listado. Comprueba la conexión e intenta nuevamente.')
      })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [query, onSessionExpired])

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true)
    setQuery((old) => ({ busqueda: search.trim(), estado: status, pagina: 1, revision: old.revision + 1 }))
  }
  function page(pagina: number) { setLoading(true); setQuery((old) => ({ ...old, pagina })) }

  return <section aria-labelledby="ninos-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-sm font-semibold uppercase tracking-wide text-institucional">Expedientes</p><h1 id="ninos-title" className="text-3xl font-semibold">Niños registrados</h1></div>
      {onCreate && <button type="button" onClick={onCreate} className="rounded-lg bg-institucional px-4 py-3 font-semibold text-white hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-institucional">Registrar niño</button>}
    </div>
    <form onSubmit={filter} className="mt-7 flex flex-wrap items-end gap-3 rounded-xl bg-fondo p-4">
      <div className="min-w-0 flex-1 basis-52"><label htmlFor="ninos-search" className="text-sm font-medium">Buscar por nombre o expediente</label><input id="ninos-search" type="search" maxLength={80} value={search} onChange={(event) => setSearch(event.target.value)} className="mt-2 w-full rounded-lg border border-secundario/40 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-institucional" /></div>
      <div><label htmlFor="ninos-status" className="text-sm font-medium">Estado</label><select id="ninos-status" value={status} onChange={(event) => setStatus(event.target.value)} className="mt-2 block rounded-lg border border-secundario/40 bg-white px-3 py-2.5 focus:ring-2 focus:ring-institucional"><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option><option value="ARCHIVADO">Archivados</option><option value="TODOS">Todos</option></select></div>
      <button disabled={loading} className="rounded-lg border border-institucional px-4 py-2.5 font-semibold text-institucional disabled:opacity-60">Buscar</button>
    </form>
    {loading && <p role="status" className="mt-6">Cargando expedientes…</p>}
    {!loading && error && <div role="alert" className="mt-6 rounded-lg border-l-4 border-alerta bg-fondo p-4"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setQuery((old) => ({ ...old, revision: old.revision + 1 })) }} className="mt-3 font-semibold text-institucional underline">Reintentar</button></div>}
    {!loading && data && <>
      <p role="status" className="mt-6 text-sm text-secundario">{data.total} {data.total === 1 ? 'expediente encontrado' : 'expedientes encontrados'}</p>
      {data.datos.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-institucional/30 p-8 text-center"><h2 className="text-lg font-semibold">No hay expedientes para mostrar</h2><p className="mt-2 text-secundario">Revisa los filtros o registra el primer niño si tienes permiso.</p></div> : <div className="mt-4 overflow-x-auto rounded-xl border border-institucional/15" role="region" aria-label="Listado de niños" tabIndex={0}>
        <table className="w-full text-left text-sm"><caption className="sr-only">Expedientes de niños, página {data.pagina}</caption><thead className="bg-azul-claro"><tr>{['Niño y expediente', 'Nacimiento', 'Sexo biológico', 'Comunidad', 'Certificado', 'Estado'].map((title) => <th scope="col" key={title} className="whitespace-nowrap px-4 py-3 font-semibold">{title}</th>)}</tr></thead><tbody className="divide-y divide-institucional/10">
          {data.datos.map((nino) => <tr key={nino.codigo_publico} className="align-top"><td className="min-w-56 px-4 py-4"><p className="text-base font-medium">{[nino.primer_nombre, nino.segundo_nombre, nino.primer_apellido, nino.segundo_apellido].filter(Boolean).join(' ')}</p><p className="mt-1 break-all text-sm text-secundario">{nino.codigo_expediente}</p><button type="button" onClick={() => onOpen(nino.codigo_publico)} className="mt-2 font-semibold text-institucional underline">Ver expediente</button></td><td className="whitespace-nowrap px-4 py-4">{nino.fecha_nacimiento.split('-').reverse().join('/')}</td><td className="px-4 py-4">{nino.sexo_biologico === 'M' ? 'Masculino' : 'Femenino'}</td><td className="px-4 py-4">{nino.comunidad || 'Sin asignar'}</td><td className="whitespace-nowrap px-4 py-4">•••• {nino.certificado_ultimos4}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-sm ${nino.estado === 'ACTIVO' ? 'bg-verde-claro text-texto' : 'bg-fondo text-texto'}`}>{nino.estado === 'ACTIVO' ? 'Activo' : nino.estado === 'INACTIVO' ? 'Inactivo' : 'Archivado'}</span></td></tr>)}
        </tbody></table>
      </div>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-secundario">Página {data.pagina} de {data.paginas}</p><div className="flex gap-2"><button type="button" disabled={data.pagina <= 1} onClick={() => page(data.pagina - 1)} className="rounded-lg border border-institucional/30 px-3 py-2 text-sm disabled:cursor-default disabled:opacity-40">Anterior</button><button type="button" disabled={data.pagina >= data.paginas} onClick={() => page(data.pagina + 1)} className="rounded-lg border border-institucional/30 px-3 py-2 text-sm disabled:cursor-default disabled:opacity-40">Siguiente</button></div></div>
    </>}
  </section>
}
