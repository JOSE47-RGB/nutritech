import { ClassificationProposal } from './ClassificationProposal'
import { useEffect, useState } from 'react'
import { ApiError, readResponse } from './ninos-api'

type Rule = { codigo: string; etiqueta: string; z_min: string | null; z_max: string | null; incluye_min: boolean; incluye_max: boolean; nivel_revision: string; genera_alerta: boolean; activa: boolean }
type Age = { sexo: string; cantidad: number; desde: number | null; hasta: number | null }
type Height = { sexo: string; tipo_medicion: string; cantidad: number; desde: string | null; hasta: string | null }
type Indicator = { codigo: string; nombre: string; eje_referencia: string; variable_resultado: string; unidad_resultado: string; activo: boolean; parametros_edad: Age[]; parametros_talla: Height[]; reglas: Rule[] }
type Pattern = { codigo: string; nombre: string; organizacion_fuente: string; version: string; referencia_documental: string | null; activo: boolean; vigente_desde: string | null; vigente_hasta: string | null; indicadores: Indicator[] }
const sex = (value: string) => value === 'F' ? 'Femenino' : 'Masculino'
const date = (value: string | null) => value ? value.split('-').reverse().join('/') : 'Sin definir'
function interval(rule: Rule) {
  const lower = rule.z_min === null ? null : `z ${rule.incluye_min ? '≥' : '>'} ${rule.z_min}`
  const upper = rule.z_max === null ? null : `z ${rule.incluye_max ? '≤' : '<'} ${rule.z_max}`
  return [lower, upper].filter(Boolean).join(' y ') || 'Sin límites'
}

export function PatronesView({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    let active = true
    fetch('/api/patrones', { signal: controller.signal, credentials: 'same-origin' }).then(readResponse<Pattern[]>).then((rows) => { if (active) { setPatterns(rows); setError('') } }).catch((err: unknown) => {
      if (!active) return
      setPatterns([])
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof ApiError ? err.message : 'No se pudo consultar la configuración. Comprueba la conexión y vuelve a intentar.')
    }).finally(() => { clearTimeout(timeout); if (active) setLoading(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [revision, onSessionExpired])
  function refresh() { setLoading(true); setRevision((old) => old + 1) }
  return <section aria-labelledby="patterns-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mb-2 text-sm font-semibold uppercase text-institucional">Configuración</p><h1 id="patterns-title" className="text-3xl font-semibold">Patrones nutricionales</h1></div><span className="rounded-full bg-azul-claro px-3 py-1 text-sm font-medium text-institucional">Solo consulta</span></div>
    <p className="mt-4 text-secundario">Consulta las fuentes, parámetros de referencia y reglas de clasificación registrados en NutriTech.</p>
    <div className="mt-5 rounded-xl border-l-4 border-institucional bg-azul-claro p-4"><h2 className="font-semibold">Referencias del cálculo nutricional</h2><p className="mt-2">Los conteos indican cuántos datos están cargados. No comprueban que las tablas estén completas ni que hayan sido validadas. El cálculo provisional está disponible en el historial de evaluaciones. El patrón permanece inactivo en este catálogo; su estado no equivale a una validación clínica institucional.</p></div>
    <ClassificationProposal onSessionExpired={onSessionExpired} />
    <button type="button" disabled={loading} onClick={refresh} className="mt-5 rounded-lg border border-institucional px-4 py-2 font-semibold text-institucional disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-institucional">{loading ? 'Consultando…' : 'Actualizar datos'}</button>
    {loading && <p role="status" className="mt-5">Cargando patrones e indicadores…</p>}
    {!loading && error && <p role="alert" className="mt-5 rounded-lg border-l-4 border-alerta bg-fondo p-4">{error}</p>}
    {!loading && !error && !patterns.length && <p role="status" className="mt-6 rounded-xl border border-dashed border-institucional/30 p-6">No hay patrones de crecimiento registrados.</p>}
    {!loading && !error && <div className="mt-6 space-y-6">{patterns.map((pattern) => <article key={pattern.codigo} className="rounded-xl border border-institucional/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{pattern.nombre}</h2><p className="mt-1 text-sm text-secundario">{pattern.codigo} · Versión {pattern.version}</p></div><span className="rounded bg-fondo px-3 py-1 text-sm">{pattern.activo ? 'Activo en la base' : 'Inactivo'}</span></div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-secundario">Organización fuente</dt><dd>{pattern.organizacion_fuente}</dd></div><div><dt className="text-sm text-secundario">Vigencia registrada</dt><dd>{date(pattern.vigente_desde)} — {date(pattern.vigente_hasta)}</dd></div><div className="sm:col-span-2"><dt className="text-sm text-secundario">Referencia documental</dt><dd className="mt-1 whitespace-pre-wrap break-words">{pattern.referencia_documental || 'Sin referencia registrada'}</dd></div></dl>
      {!pattern.indicadores.length && <p className="mt-5">No hay tipos de indicador registrados.</p>}
      <div className="mt-5 space-y-3">{pattern.indicadores.map((indicator) => {
        const ageCount = indicator.parametros_edad.reduce((total, item) => total + item.cantidad, 0)
        const heightCount = indicator.parametros_talla.reduce((total, item) => total + item.cantidad, 0)
        const expectedCount = indicator.eje_referencia === 'EDAD_DIAS' ? ageCount : heightCount
        const activeRules = indicator.reglas.filter((rule) => rule.activa).length
        return <details key={indicator.codigo} className="rounded-lg border border-institucional/15 p-4"><summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-institucional"><span className="font-semibold">{indicator.nombre}</span><span className="ml-2 text-sm text-secundario">{expectedCount} parámetros del eje · {activeRules} reglas activas{!indicator.activo ? ' · Indicador inactivo' : ''}</span></summary>
          <p className="mt-3 text-sm text-secundario">Referencia por {indicator.eje_referencia === 'EDAD_DIAS' ? 'edad en días' : 'longitud/talla en centímetros'} · Variable: {indicator.variable_resultado} ({indicator.unidad_resultado})</p>
          {expectedCount === 0 && <p className="mt-3 border-l-4 border-advertencia bg-fondo p-3">Faltan parámetros para el eje de este indicador.</p>}
          {activeRules === 0 && <p className="mt-3 border-l-4 border-advertencia bg-fondo p-3">No hay reglas activas de clasificación.</p>}
          <h3 className="mt-5 font-semibold">Parámetros por edad</h3>{!ageCount ? <p className="mt-2 text-sm text-secundario">Sin datos cargados.</p> : <ul className="mt-2 space-y-2">{indicator.parametros_edad.map((row) => <li key={row.sexo} className="rounded bg-fondo p-3 text-sm">{sex(row.sexo)}: {row.cantidad} filas · Desde {row.desde} hasta {row.hasta} días</li>)}</ul>}
          <h3 className="mt-4 font-semibold">Parámetros por longitud/talla</h3>{!heightCount ? <p className="mt-2 text-sm text-secundario">Sin datos cargados.</p> : <ul className="mt-2 space-y-2">{indicator.parametros_talla.map((row) => <li key={`${row.sexo}-${row.tipo_medicion}`} className="rounded bg-fondo p-3 text-sm">{sex(row.sexo)} · {row.tipo_medicion === 'LONGITUD_ACOSTADO' ? 'Longitud acostado' : 'Talla de pie'}: {row.cantidad} filas · Desde {row.desde} hasta {row.hasta} cm</li>)}</ul>}
          {(ageCount > 0 || heightCount > 0) && <p className="mt-2 text-sm text-secundario">Los extremos muestran los valores mínimo y máximo presentes; puede haber valores intermedios faltantes.</p>}
          <h3 className="mt-5 font-semibold">Reglas registradas</h3>{!indicator.reglas.length ? <p className="mt-2 text-sm text-secundario">Sin reglas cargadas.</p> : <ul className="mt-3 divide-y divide-institucional/15">{indicator.reglas.map((rule) => <li key={rule.codigo} className="py-3"><p className="font-medium">{rule.etiqueta} <span className="text-sm text-secundario">· {rule.activa ? 'Activa' : 'Inactiva'}</span></p><p className="mt-1 text-sm">{interval(rule)}</p><p className="mt-1 text-sm text-secundario">Revisión: {rule.nivel_revision} · Genera alerta: {rule.genera_alerta ? 'Sí' : 'No'}</p></li>)}</ul>}
        </details>
      })}</div>
    </article>)}</div>}
  </section>
}
