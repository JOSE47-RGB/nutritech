import { FamilyResult, type FamilyGuide } from './FamilyResult'
import { useEffect, useState } from 'react'
import type { Evaluation } from './Evaluaciones'
import { ApiError, readResponse } from './ninos-api'
import { GenerateReport } from './Reports'
type Saved = { codigo_publico: string; guardado_en: string; contenido: { guia_familiar?: FamilyGuide; orientacion: { indicadores: { indicador: string; z: number | null; estado: string; clasificacion: string | null; recomendacion: string; motivo: string; fuentes: { titulo: string; url: string }[] }[]; avisos: { texto: string }[] } } }
const names: Record<string, string> = { P_E: 'Peso para la edad', T_E: 'Longitud/talla para la edad', P_T: 'Peso para longitud/talla', IMC_E: 'IMC para la edad' }
export function UserResult({ evaluation, canReport, onNew, onSessionExpired, admin = false, onHistory }: { admin?: boolean; onHistory?: () => void; evaluation: Evaluation; canReport: boolean; onNew: () => void; onSessionExpired: () => void }) {
  const [saved, setSaved] = useState<Saved | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    fetch(admin ? `/api/evaluaciones/${evaluation.codigo_publico}/orientaciones` : `/api/mi-portal/evaluaciones/${evaluation.codigo_publico}/orientacion`, { method: 'POST', credentials: 'same-origin', headers: { 'X-NutriTech-Request': '1' }, signal: controller.signal }).then(readResponse<Saved>).then(result => { if (active) setSaved(result) }).catch((err: unknown) => {
      if (!active) return
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof ApiError ? err.message : 'La medición quedó registrada, pero no se pudo confirmar la orientación. Reintenta sin crear otra medición.')
    }).finally(() => clearTimeout(timeout))
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [evaluation.codigo_publico, onSessionExpired, attempt, admin])
  return <section aria-labelledby="user-result-title"><p role="status" className="mb-4 rounded-xl bg-verde-claro p-4">Medición registrada para {evaluation.ninos.primer_nombre} {evaluation.ninos.primer_apellido}.</p><h2 id="user-result-title" className="text-2xl font-bold text-institucional">Así va el crecimiento de {evaluation.ninos.primer_nombre}</h2><p className="my-3 text-sm">{evaluation.peso_kg} kg · {evaluation.talla_cm} cm · {evaluation.edad_dias} días de edad. Orientación automática para revisión profesional.</p>
    {!saved && !error && <p role="status" className="portal-info">Verificando referencias y preparando los resultados…</p>}
    {error && <div role="alert" className="portal-error"><p>{error}</p><button className="mt-3 underline" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Reintentar orientación</button></div>}
    {saved && <><p className="family-caption">Resultado guardado. Los avisos de seguimiento se preparan automáticamente con esta evaluación.</p><FamilyResult guide={saved.contenido.guia_familiar} /><details><summary className="cursor-pointer font-semibold">Ver medidas, cálculos y fuentes (detalle profesional)</summary><div className="portal-result-grid">{saved.contenido.orientacion.indicadores.map(item => <article key={item.indicador} className={item.estado === 'ORIENTATIVA' ? 'portal-indicator' : 'portal-indicator review'}><h3>{names[item.indicador] ?? item.indicador}</h3><strong>{item.clasificacion ?? 'Requiere revisión'}</strong><p>{item.z === null ? 'Puntaje Z no disponible.' : `Puntaje Z: ${item.z.toFixed(2)}.`}</p><p className="mt-2">{item.recomendacion}</p><details className="mt-3 text-sm"><summary className="cursor-pointer">Motivo y fuentes</summary><p>{item.motivo}</p>{item.fuentes.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 block underline">{source.titulo}</a>)}</details></article>)}</div><section className="mt-5 rounded-xl bg-azul-claro p-5"><h3 className="font-semibold">Avisos y recomendaciones para revisión</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{saved.contenido.orientacion.avisos.map(item => <li key={item.texto}>{item.texto}</li>)}</ul></section><p className="mt-3 text-xs text-secundario">Los puntajes se presentan a dos decimales; la clasificación conserva la precisión completa. Cada indicador se interpreta por separado.</p></details></>}
    <div className="portal-result-actions">{saved && canReport && <GenerateReport evaluation={evaluation.codigo_publico} orientation={saved.codigo_publico} apiBase={admin ? "/api/reportes" : "/api/mi-portal/reportes"} onSessionExpired={onSessionExpired} />}{onHistory && <button className="consult-secondary" onClick={onHistory}>Ver historial de este niño</button>}<button className="portal-primary" disabled={!saved && !error} onClick={onNew}>Nueva evaluación</button></div>
  </section>
}
