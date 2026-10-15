import { FamilyResult, type FamilyGuide } from './FamilyResult'
import { useEffect, useState } from 'react'
import { ApiError, readResponse } from './ninos-api'
type Score = { z: number | null; fuera_rango_calidad: boolean | null; motivo: string | null }
type Orientation = { version: string; indicadores: { indicador: string; estado: string; motivo: string; clasificacion: string | null; recomendacion: string; fuentes: { titulo: string; url: string }[] }[]; avisos: { texto: string; fuente: { titulo: string; url: string } }[] }
type Calculation = { guia_familiar?: FamilyGuide; orientacion: Orientation; edema: 'SI' | 'NO' | 'DESCONOCIDO'; talla_original_cm: number; talla_ajustada_cm: number; ajuste_cm: number; imc_ajustado: number | null; medicion_pie_menor_9_meses: boolean; version_motor: string; indicadores: Record<string, Score> }
const names: Record<string, string> = { P_E: 'Peso para la edad', T_E: 'Longitud/talla para la edad', P_T: 'Peso para longitud/talla', IMC_E: 'IMC para la edad' }
const reasons: Record<string, string> = { EDAD_FUERA_DE_COBERTURA: 'Edad fuera de la cobertura del motor.', MEDIDA_INVALIDA: 'La medida no permite calcular este indicador.', EDEMA: 'No se calcula este indicador con edema presente.', EDEMA_DESCONOCIDO: 'No se calcula: el estado de edema es desconocido.', TALLA_FUERA_DE_COBERTURA: 'Longitud/talla fuera de la cobertura de referencia.', REFERENCIA_AUSENTE: 'Falta una referencia necesaria.' }
export function EvaluationCalculation({ code, onSessionExpired }: { code: string; onSessionExpired: () => void }) {
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Calculation | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!attempt) return
    const controller = new AbortController(); let active = true
    const timeout = setTimeout(() => controller.abort(), 20000)
    fetch(`/api/evaluaciones/${code}/calculo`, { signal: controller.signal, credentials: 'same-origin' }).then(async response => {
      if (response.status === 503) throw new Error('Las referencias no están disponibles o no superaron la verificación. No se generó el cálculo.')
      return readResponse<Calculation>(response)
    }).then(result => { if (active) setData(result) }).catch((err: unknown) => {
      if (!active) return
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof Error && err.name !== 'AbortError' ? err.message : 'No se pudo obtener el cálculo. Intenta nuevamente.')
    }).finally(() => { clearTimeout(timeout); if (active) setLoading(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [attempt, code, onSessionExpired])
  return <div className="mt-4 border-t border-institucional/15 pt-4">
    <button type="button" disabled={loading} onClick={() => { setData(null); setError(''); setLoading(true); setAttempt(value => value + 1) }} className="rounded-lg border border-institucional px-3 py-2 font-semibold text-institucional disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-institucional">{loading ? 'Verificando y calculando…' : data ? 'Volver a calcular' : 'Ver resultado y sugerencias'}</button>
    {loading && <p role="status" className="mt-3 text-sm text-secundario">Comprobando las referencias y calculando indicadores…</p>}
    {error && <p role="alert" className="mt-3 border-l-4 border-alerta bg-fondo p-3">{error}</p>}
    {data && <section aria-label="Cálculo provisional" className="mt-4 rounded-lg bg-azul-claro p-4"><FamilyResult guide={data.guia_familiar} /><details><summary className="cursor-pointer font-semibold">Ver detalle para el personal de salud</summary><h3 className="mt-4 font-semibold">Puntajes Z · Cálculo provisional</h3><p className="mt-2 text-sm">Resultados calculados al consultar. Incluyen clasificación orientativa para revisión del médico. No se guardan como resultados validados ni generan alertas persistidas.</p>
      <p className="mt-3 text-sm">Medida original: {data.talla_original_cm.toFixed(2)} cm · Medida ajustada: {data.talla_ajustada_cm.toFixed(2)} cm · Ajuste: {data.ajuste_cm > 0 ? '+' : ''}{data.ajuste_cm.toFixed(1)} cm</p>
      {data.edema === 'NO' && data.imc_ajustado !== null && <p className="mt-1 text-sm">IMC con medida ajustada: {data.imc_ajustado.toFixed(2)} kg/m²</p>}
      {data.medicion_pie_menor_9_meses && <p className="mt-3 border-l-4 border-advertencia bg-white p-3 text-sm">El motor marcó el método de medición de pie para revisión por la edad registrada.</p>}
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(data.indicadores).map(([key, score]) => <div key={key} className="rounded-lg bg-white p-3"><dt className="font-medium">{names[key] || key}</dt><dd className="mt-1">{score.z === null ? <span className="text-sm">{reasons[score.motivo || ''] || 'No disponible.'}</span> : <><span className="text-xl font-semibold">{score.z.toFixed(2)}</span><span className="ml-2 text-sm text-secundario">puntaje Z</span>{score.fuera_rango_calidad && <p className="mt-2 text-sm">Bandera de calidad: revisar la medición registrada.</p>}</>}</dd></div>)}</dl>
      <section aria-label="Orientación para revisión médica" className="mt-4 border-t border-institucional/20 pt-4">
        <h4 className="font-semibold">Clasificación orientativa y recomendaciones</h4>
        <p className="mt-2 text-sm">La decisión final corresponde al médico. Las comparaciones usan el puntaje completo, aunque arriba se muestren dos decimales.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{data.orientacion.indicadores.map(item => <article key={item.indicador} className="rounded-lg bg-white p-3">
          <h5 className="font-semibold">{names[item.indicador]}</h5>
          <p className="mt-2 font-medium">{item.clasificacion ?? (item.estado === 'NO_DISPONIBLE' ? 'No disponible' : 'Requiere revisión')}</p>
          <p className="mt-2 text-sm">{item.recomendacion}</p>
          <details className="mt-2 text-sm"><summary className="cursor-pointer">Motivo y fuente</summary><p className="mt-2">{item.motivo}</p>{item.fuentes.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-institucional underline">{source.titulo}</a>)}</details>
        </article>)}</div>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{data.orientacion.avisos.map(item => <li key={item.texto}>{item.texto} <a href={item.fuente.url} target="_blank" rel="noopener noreferrer" className="text-institucional underline">Fuente</a></li>)}</ul>
        <p className="mt-2 text-xs text-secundario">Versión: {data.orientacion.version}</p>
      </section>
      <p className="mt-3 break-all text-xs text-secundario">Motor: {data.version_motor} · Referencia OMS-2006</p></details>
    </section>}
  </div>
}
