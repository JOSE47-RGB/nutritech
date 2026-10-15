import { useEffect, useState } from 'react'
import { ApiError, readResponse } from './ninos-api'
type Row = { codigo_publico: string; titulo: string; mensaje: string; estado: string; tipo_aviso: string | null; revision: number; generada_en: string; orientacion: { codigo_publico: string; evaluacion: { codigo_publico: string; estado: string; ninos: { codigo_expediente: string; primer_nombre: string; primer_apellido: string } } } | null }
type Page = { total: number; pagina: number; paginas: number; puede_atender: boolean; datos: Row[] }
type Detail = { estado: string; revision: number; politica: string | null; regla: string | null; historial: { anterior: string | null; nuevo: string; autor: string; fecha: string; comentario: string }[]; orientacion: { version_motor: string; orientacion: { indicadores: { indicador: string; clasificacion: string | null; motivo: string; fuentes: { titulo: string; url: string }[] }[] } } | null }
const label = (value: string) => ({ PENDIENTE: 'Por revisar', EN_REVISION: 'En seguimiento', ATENDIDA: 'Atendida', DESCARTADA: 'Descartada', DATOS: 'Revisar datos', HALLAZGO: 'Revisar crecimiento', REVISION_CLINICA: 'Valoración médica' })[value] ?? value.replaceAll('_', ' ')
const date = (value: string) => new Date(value).toLocaleString('es-GT', { timeZone: 'America/Guatemala' })
function FollowUp({ row, canAttend, onChanged, onSessionExpired }: { row: Row; canAttend: boolean; onChanged: () => void; onSessionExpired: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [next, setNext] = useState('')
  const [comment, setComment] = useState('')
  const transitions: Record<string, string[]> = { PENDIENTE: ['EN_REVISION', 'DESCARTADA'], EN_REVISION: ['ATENDIDA', 'DESCARTADA'], ATENDIDA: ['EN_REVISION'], DESCARTADA: ['EN_REVISION'] }
  const options = (transitions[row.estado] ?? []).filter(state => row.orientacion?.evaluacion.estado !== 'ANULADA' || state === 'DESCARTADA')
  async function run(save: boolean) {
    setBusy(true); setError('')
    try {
      if (save) {
        await readResponse(await fetch(`/api/alertas/${row.codigo_publico}/estado`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NutriTech-Request': '1' }, body: JSON.stringify({ estado: next, revision: row.revision, comentario: comment }) }))
        onChanged(); return
      }
      setDetail(await readResponse<Detail>(await fetch(`/api/alertas/${row.codigo_publico}`)))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof Error ? err.message : 'No se pudo completar la operación.')
    } finally { setBusy(false) }
  }
  return <div className="mt-3">
    <button type="button" disabled={busy} onClick={() => void run(false)} className="text-institucional underline">Ver origen e historial</button>
    {error && <p role="alert" className="mt-2 text-alerta">{error}</p>}
    {busy && <p role="status">Procesando…</p>}
    {detail && <div className="mt-3 rounded bg-fondo p-3">
      <p className="text-sm">Política: {detail.politica ?? 'Registro anterior'} · Motivo: {detail.regla ?? 'Consultar registro original'}</p>
      {detail.orientacion && <details className="mt-2"><summary className="cursor-pointer">Fuentes de la orientación · {detail.orientacion.version_motor}</summary>{detail.orientacion.orientacion.indicadores.map(item => <p key={item.indicador} className="mt-2 text-sm">{item.indicador}: {item.clasificacion ?? item.motivo}. {item.fuentes.map(source => <a key={source.url} className="mr-2 text-institucional underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.titulo}</a>)}</p>)}</details>}
      <ol className="mt-3 space-y-2">{detail.historial.map((item, index) => <li key={index} className="border-t border-institucional/10 pt-2 text-sm"><strong>{label(item.nuevo)}</strong> · {item.autor} · {date(item.fecha)}<p className="whitespace-pre-wrap break-words">{item.comentario}</p></li>)}</ol>
    </div>}
    {canAttend && options.length > 0 && <form className="mt-3" onSubmit={event => { event.preventDefault(); void run(true) }}><fieldset disabled={busy} className="space-y-2"><legend className="font-medium">Registrar seguimiento</legend><label className="block">¿Qué harás con esta alerta?<select required value={next} onChange={event => setNext(event.target.value)} className="mt-1 block rounded border p-2"><option value="">Selecciona…</option>{options.map(state => <option key={state} value={state}>{label(state)}</option>)}</select></label><label className="block">Anota lo que se revisó o la acción realizada<textarea required minLength={10} maxLength={600} value={comment} onChange={event => setComment(event.target.value)} className="mt-1 block w-full rounded border p-2" rows={2} /></label><button type="submit" className="rounded bg-institucional px-3 py-2 text-white">Guardar seguimiento</button></fieldset></form>}
  </div>
}
export function Alerts({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [status, setStatus] = useState('PENDIENTE')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [data, setData] = useState<Page | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController(); let active = true
    fetch(`/api/alertas?${new URLSearchParams({ pagina: String(page), ...(status ? { estado: status } : {}) })}`, { signal: controller.signal }).then(readResponse<Page>).then(result => { if (active) setData(result) }).catch((err: unknown) => {
      if (!active) return
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof Error ? err.message : 'No se pudo cargar la bandeja.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [status, page, refresh, onSessionExpired])
  function reload() { setLoading(true); setError(''); setData(null); setRefresh(old => old + 1) }
  return <section><h1 className="text-3xl font-semibold">Alertas y seguimiento</h1><p className="mt-3">Aquí encontrarás los avisos de las evaluaciones guardadas. Elige una alerta, revisa al niño y anota la acción realizada.</p>
    <div className="mt-4 flex flex-wrap gap-3"><label>Estado<select value={status} className="ml-2 rounded border p-2" onChange={event => { setStatus(event.target.value); setPage(1); reload() }}><option value="">Todos</option>{['PENDIENTE','EN_REVISION','ATENDIDA','DESCARTADA'].map(state => <option key={state} value={state}>{label(state)}</option>)}</select></label><button className="text-institucional underline" onClick={reload}>Actualizar</button></div>
    {loading && <p role="status" className="mt-4">Cargando alertas…</p>}{error && <p role="alert" className="mt-4 text-alerta">{error}</p>}
    {!loading && data && <><p role="status" className="mt-4">{data.total} alertas</p>{data.datos.length === 0 && <p className="mt-3">No hay alertas para este filtro. Los avisos se generan al guardar orientaciones; las anteriores pueden procesarse volviendo a guardarlas.</p>}
      <div className="mt-4 space-y-4">{data.datos.map(row => <article key={`${row.codigo_publico}:${row.revision}`} className="rounded-xl border border-institucional/20 border-l-4 border-l-advertencia bg-white p-5"><h2 className="text-lg font-semibold">{row.titulo}</h2><p className="mt-1 text-sm">{label(row.estado)} · {label(row.tipo_aviso ?? 'REGISTRO_ANTERIOR')} · {date(row.generada_en)}</p>{row.orientacion && <p className="mt-2">{row.orientacion.evaluacion.ninos.primer_nombre} {row.orientacion.evaluacion.ninos.primer_apellido} · {row.orientacion.evaluacion.ninos.codigo_expediente}<span className="hidden">Evaluación: {row.orientacion.evaluacion.codigo_publico} · Orientación: {row.orientacion.codigo_publico}</span></p>}{row.orientacion?.evaluacion.estado === 'ANULADA' && <p className="mt-2 font-semibold">Evaluación anulada: revisar y descartar con justificación.</p>}<p className="mt-3">{row.mensaje}</p><FollowUp row={row} canAttend={data.puede_atender} onChanged={reload} onSessionExpired={onSessionExpired} /></article>)}</div>
      <div className="mt-4 flex items-center gap-3"><button disabled={page<=1} onClick={() => {setPage(page-1);reload()}}>Anterior</button><span>Página {page} de {data.paginas}</span><button disabled={page>=data.paginas} onClick={() => {setPage(page+1);reload()}}>Siguiente</button></div>
    </>}
  </section>
}
