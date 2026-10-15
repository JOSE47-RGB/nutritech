import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ApiError, readResponse } from './ninos-api'
async function content(code: string, apiBase = '/api/reportes') {
  const response = await fetch(`${apiBase}/${code}/contenido`, { credentials: 'same-origin' })
  if (!response.ok) await readResponse(response)
  if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('No se recibió un reporte imprimible.')
  return response.text()
}
export function Viewer({ html, close }: { html: string; close: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    const wasInert = root?.inert ?? false
    if (root) root.inert = true
    closeButton.current?.focus()
    return () => { if (root) root.inert = wasInert; previous?.focus() }
  }, [])
  return createPortal(<div role="dialog" aria-modal="true" aria-label="Reporte imprimible" className="fixed inset-0 z-50 flex flex-col bg-white p-4" onKeyDown={event => { if (event.key === 'Escape') close() }}>
    <div className="mb-3 flex flex-wrap items-center gap-3"><h2 className="mr-auto text-xl font-semibold">Reporte imprimible</h2><button disabled={!ready} className="rounded bg-institucional px-4 py-2 text-white disabled:opacity-50" onClick={() => frame.current?.contentWindow?.print()}>Imprimir / Guardar como PDF</button><button ref={closeButton} onClick={close} className="rounded border px-4 py-2">Cerrar</button></div>
    <p className="mb-2 text-sm">En el diálogo de impresión selecciona tu impresora o «Guardar como PDF». Revisa las páginas antes de confirmar.</p>
    <iframe ref={frame} title="Contenido del reporte" srcDoc={html} sandbox="allow-same-origin allow-modals" onLoad={() => setReady(true)} className="min-h-0 flex-1 border" />
  </div>, document.body)
}
export function GenerateReport({ evaluation, orientation, onSessionExpired, apiBase = '/api/reportes' }: { apiBase?: string; evaluation: string; orientation: string; onSessionExpired: () => void }) {
  const [html, setHtml] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(crypto.randomUUID())
  async function generate() {
    setBusy(true); setError('')
    try {
      const report = await readResponse<{ codigo_publico: string }>(await fetch(apiBase, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-NutriTech-Request': '1' }, body: JSON.stringify({ evaluacion: evaluation, orientacion: orientation, solicitud_id: requestId.current }) }))
      setHtml(await content(report.codigo_publico, apiBase)); requestId.current = crypto.randomUUID()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof Error ? err.message : 'No se pudo generar el reporte.')
    } finally { setBusy(false) }
  }
  return <div className="mt-4"><button disabled={busy} type="button" className="rounded border border-institucional px-3 py-2 text-institucional disabled:opacity-50" onClick={() => void generate()}>{busy ? 'Generando reporte…' : 'Ver reporte para la familia / PDF'}</button>{error && <p role="alert" className="mt-2 text-alerta">{error}</p>}{html && <Viewer html={html} close={() => setHtml(null)} />}</div>
}
type Page = { total: number; pagina: number; paginas: number; datos: { codigo_publico: string; generado_en: string; usuarios: { codigo_acceso: string }; orientacion: { codigo_publico: string; evaluacion: { codigo_publico: string } } | null }[] }
export function Reports({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [data, setData] = useState<Page | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true; const controller = new AbortController()
    fetch(`/api/reportes?pagina=${page}`, { signal: controller.signal }).then(readResponse<Page>).then(result => { if (active) setData(result) }).catch((err: unknown) => {
      if (!active) return
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof Error ? err.message : 'No se pudieron consultar los reportes.')
    })
    return () => { active = false; controller.abort() }
  }, [page, refresh, onSessionExpired])
  async function open(code: string) {
    setBusy(true); setError('')
    try { setHtml(await content(code)) } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof Error ? err.message : 'No se pudo abrir el reporte.')
    } finally { setBusy(false) }
  }
  const reload = () => { setData(null); setError(''); setRefresh(value => value + 1) }
  return <section><h1 className="text-3xl font-semibold">Reportes guardados</h1><p className="mt-3">Genera un reporte desde una orientación guardada en el historial de evaluaciones. Aquí puedes volver a consultar e imprimir las copias generadas.</p><button className="mt-3 text-institucional underline" onClick={reload}>Actualizar</button>
    {error && <p role="alert" className="mt-3 text-alerta">{error}</p>}{!data && !error && <p role="status">Cargando reportes…</p>}{busy && <p role="status">Abriendo reporte…</p>}
    {data && <><p className="mt-3">{data.total} reportes</p><div className="mt-3 space-y-3">{data.datos.map(row => <article key={row.codigo_publico} className="rounded border border-institucional/20 p-4"><h2 className="font-semibold">{new Date(row.generado_en).toLocaleString('es-GT', { timeZone: 'America/Guatemala' })} · {row.usuarios.codigo_acceso}</h2><p className="mt-2 break-all text-sm">Reporte: {row.codigo_publico}</p><p className="break-all text-sm">Evaluación: {row.orientacion?.evaluacion.codigo_publico}</p><button disabled={busy} className="mt-3 text-institucional underline" onClick={() => void open(row.codigo_publico)}>Abrir reporte</button></article>)}</div><div className="mt-4 flex gap-3"><button disabled={page<=1} onClick={() => {setPage(page-1);reload()}}>Anterior</button><span>Página {page} de {data.paginas}</span><button disabled={page>=data.paginas} onClick={() => {setPage(page+1);reload()}}>Siguiente</button></div></>}
    {html && <Viewer html={html} close={() => setHtml(null)} />}
  </section>
}
