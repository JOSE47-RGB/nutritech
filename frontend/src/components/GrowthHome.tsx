import { useEffect, useId, useState } from 'react'
import { Growth } from './Growth'
import { LeafMark } from './LeafMark'
import { ApiError, readResponse } from './ninos-api'
import './growth.css'

type Row = { sexo: 'M' | 'F'; meses: number; peso_kg: number; talla_cm: number; tipo_medicion: string }
type TableData = { sexo: 'M' | 'F'; filas: Row[] }
const ageLabel = (months: number) => months === 0 ? 'Al nacer' : months < 12 ? `${months} ${months === 1 ? 'mes' : 'meses'}` : `${Math.floor(months / 12)} ${months < 24 ? 'año' : 'años'}${months % 12 ? ` y ${months % 12} ${months % 12 === 1 ? 'mes' : 'meses'}` : ''}`
const number = (value: number) => value.toLocaleString('es-GT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function AgeTable({ rows, title }: { rows: Row[]; title: string }) {
  return <div className="growth-age-table"><table>
    <caption>{title}</caption>
    <thead><tr><th scope="col">Edad</th><th scope="col">Peso <small>kg</small></th><th scope="col">Longitud / talla <small>cm</small></th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.meses}><th scope="row">{ageLabel(row.meses)}</th><td>{number(row.peso_kg)}</td><td>{number(row.talla_cm)}</td></tr>)}</tbody>
  </table></div>
}

function MonthlyTable({ sex, admin, publicMode, onSessionExpired }: { sex: 'M' | 'F'; admin: boolean; publicMode: boolean; onSessionExpired: () => void }) {
  const [data, setData] = useState<TableData | null>(null)
  const [error, setError] = useState('')
  const [all, setAll] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/${publicMode ? 'publico/' : admin ? '' : 'mi-portal/'}crecimiento/tabla?sexo=${sex}`, { signal: controller.signal })
      .then(readResponse<TableData>)
      .then(value => { if (!controller.signal.aborted) setData(value) })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        if (err instanceof ApiError && err.status === 401) onSessionExpired()
        else setError(err instanceof Error ? err.message : 'No se pudo cargar la tabla de crecimiento.')
      })
    return () => controller.abort()
  }, [sex, admin, publicMode, onSessionExpired, revision])
  if (error) return <div className="growth-empty" role="alert"><p>{error}</p><button className="growth-link" onClick={() => { setError(''); setData(null); setRevision(value => value + 1) }}>Volver a intentar</button></div>
  if (!data) return <p className="growth-empty" role="status">Cargando tabla de crecimiento…</p>
  const first = data.filas.filter(row => row.meses <= (all ? 30 : 12))
  const last = data.filas.filter(row => all ? row.meses > 30 : [15, 18, 21, 24, 30, 36, 42, 48, 54, 60].includes(row.meses))
  return <><p className="growth-table-intro">Referencias para {sex === 'M' ? 'niños' : 'niñas'} · Medianas OMS</p>
    <div className="growth-age-grid"><AgeTable rows={first} title={all ? 'Del nacimiento a los 2 años y 6 meses' : 'Su primer año'}/><AgeTable rows={last} title={all ? 'Hasta los 5 años' : 'Mientras sigue creciendo'}/></div>
    <div className="growth-table-bottom"><p>Antes de los 2 años: longitud acostado.<br/>Desde los 2 años: talla de pie.</p><button className="growth-link" aria-pressed={all} onClick={() => setAll(value => !value)}>{all ? 'Ver tabla resumida' : 'Ver todos los meses'}</button></div>
  </>
}

export function GrowthHome({ admin = false, canHistory = true, publicMode = false, onSessionExpired }: { admin?: boolean; canHistory?: boolean; publicMode?: boolean; onSessionExpired: () => void }) {
  const [sex, setSex] = useState<'M' | 'F'>('M')
  const [mode, setMode] = useState<'table' | 'history'>('table')
  const title = useId()
  return <section className="growth-home" aria-labelledby={title}>
    <header className="growth-home-heading"><div><p className="portal-eyebrow">Acompañamos su crecimiento</p><h2 id={title}>Peso y talla según la edad</h2><p>Una guía visual desde el nacimiento hasta los 5 años.</p></div><LeafMark/></header>
    <div className="growth-home-tabs" aria-label="Consulta de crecimiento"><button aria-pressed={mode === 'table'} onClick={() => setMode('table')}>Tabla por edad</button>{canHistory && <button aria-pressed={mode === 'history'} onClick={() => setMode('history')}>Gráfica de un niño</button>}</div>
    {mode === 'table' ? <div className="growth-home-body">
      <div className="growth-table-toolbar"><span>Elige la referencia</span><div className="growth-sex" role="group" aria-label="Referencia según sexo"><button aria-pressed={sex === 'M'} onClick={() => setSex('M')}>Niño</button><button aria-pressed={sex === 'F'} onClick={() => setSex('F')}>Niña</button></div></div>
      <MonthlyTable key={sex} sex={sex} admin={admin} publicMode={publicMode} onSessionExpired={onSessionExpired}/>
      <p className="growth-home-note"><strong>Cada niño crece a su ritmo.</strong> Estos valores son referencias centrales, no un peso o talla obligatorios. Una diferencia por sí sola no indica enfermedad.</p>
      <details className="growth-home-sources"><summary>¿De dónde vienen los datos?</summary><p>Tablas mensuales oficiales de la OMS, separadas por sexo. Se muestran medianas redondeadas a un decimal; no sustituyen una evaluación individual.</p><a href="https://www.who.int/tools/child-growth-standards/standards/weight-for-age" target="_blank" rel="noopener noreferrer">Peso para la edad</a><a href="https://www.who.int/tools/child-growth-standards/standards/length-height-for-age" target="_blank" rel="noopener noreferrer">Longitud y talla para la edad</a></details>
    </div> : <div className="growth-home-body"><Growth embedded admin={admin} canHistory={canHistory} onSessionExpired={onSessionExpired}/></div>}
  </section>
}
