import { FamilyResult, type FamilyGuide } from './FamilyResult'
import { GenerateReport } from './Reports'
import { MedicalReviews } from './MedicalReviews'
import { useState } from 'react'
import { ApiError, readResponse } from './ninos-api'
type Saved = { codigo_publico: string; guardado_en: string; autor: string; contenido_sha256: string; contenido: { guia_familiar?: FamilyGuide; version_motor: string; entrada: { edad_dias: number; peso_kg: string; talla_cm: string; edema: string; tipo_medicion: string }; revision_medica: string; orientacion: { version: string; indicadores: { indicador: string; z: number | null; clasificacion: string | null; motivo: string; recomendacion: string; fuentes: { titulo: string; url: string }[] }[]; avisos: { texto: string }[] } } }
export function SavedOrientations({ code, canSave, onSessionExpired }: { code: string; canSave: boolean; onSessionExpired: () => void }) {
  const [rows, setRows] = useState<Saved[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function run(save: boolean) {
    setBusy(true); setError(''); setNotice('')
    try {
      const url = `/api/evaluaciones/${code}/orientaciones`
      if (save) {
        const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'X-NutriTech-Request': '1' } })
        const saved = await readResponse<Saved>(response)
        setRows(old => [saved, ...(old ?? []).filter(row => row.codigo_publico !== saved.codigo_publico)])
        setNotice('Resultado guardado. Ahora puedes generar el reporte para la familia.')
      } else setRows(await readResponse<Saved[]>(await fetch(url, { credentials: 'same-origin' })))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof Error ? err.message : 'No se pudo completar la operación.')
    } finally { setBusy(false) }
  }
  return <section className="mt-4 border-t border-institucional/15 pt-4" aria-label="Resultados guardados">
    <h3 className="font-semibold">Resultados guardados</h3>
    <p className="mt-2 text-sm">Guarda una copia del resultado para preparar el reporte y dar seguimiento. La revisión médica se registra por separado.</p>
    <div className="mt-3 flex flex-wrap gap-3">
      {canSave && <button type="button" disabled={busy} onClick={() => void run(true)} className="rounded-lg bg-institucional px-3 py-2 text-white disabled:opacity-50">Guardar resultado y preparar reporte</button>}
      <button type="button" disabled={busy} onClick={() => void run(false)} className="rounded-lg border border-institucional px-3 py-2 text-institucional disabled:opacity-50">Ver resultados anteriores</button>
    </div>
    {busy && <p role="status" className="mt-2 text-sm">Procesando…</p>}
    {notice && <p role="status" className="mt-2 text-sm">{notice}</p>}
    {error && <p role="alert" className="mt-2 text-alerta">{error}</p>}
    {rows?.length === 0 && <p className="mt-2 text-sm">Todavía no hay orientaciones guardadas.</p>}
    <div className="mt-3 space-y-3">{rows?.map(row => <details open={Boolean(notice) && row === rows[0]} key={row.codigo_publico} className="rounded-lg border border-institucional/15 p-3">
      <summary className="cursor-pointer font-medium">{new Date(row.guardado_en).toLocaleString('es-GT', { timeZone: 'America/Guatemala' })} · {row.autor}</summary>
      <FamilyResult guide={row.contenido.guia_familiar} /><GenerateReport evaluation={code} orientation={row.codigo_publico} onSessionExpired={onSessionExpired} /><details className="mt-4"><summary className="cursor-pointer font-semibold">Ver información clínica y seguimiento</summary><p className="mt-2 text-sm">Orientación automática · {row.contenido.version_motor} · {row.contenido.orientacion.version}</p>
      <p className="mt-2 text-sm">Datos usados: {row.contenido.entrada.peso_kg} kg · {row.contenido.entrada.talla_cm} cm · {row.contenido.entrada.edad_dias} días · Edema: {row.contenido.entrada.edema}</p>
      {row.contenido.orientacion.indicadores.map(item => <div key={item.indicador} className="mt-3 border-t border-institucional/10 pt-2"><p className="font-medium">{item.indicador}: {item.clasificacion ?? 'Sin clasificación automática'} · Z: {item.z === null ? 'No disponible' : item.z.toFixed(2)}</p><p className="text-sm">{item.recomendacion}</p><p className="mt-1 text-xs">{item.motivo}</p>{item.fuentes.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="mr-2 text-sm text-institucional underline">{source.titulo}</a>)}</div>)}
      <ul className="mt-3 list-disc pl-5 text-sm">{row.contenido.orientacion.avisos.map(item => <li key={item.texto}>{item.texto}</li>)}</ul>
      <MedicalReviews evaluation={code} orientation={row.codigo_publico} onSessionExpired={onSessionExpired} />
      <p className="mt-3 break-all text-xs text-secundario">Registro: {row.codigo_publico} · SHA-256: {row.contenido_sha256}</p></details>
    </details>)}</div>
  </section>
}
