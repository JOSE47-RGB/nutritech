import { TaskIcon } from './TaskIcon'
import { GrowthHome } from './GrowthHome'
import { useEffect, useState } from 'react'
import { ApiError, readResponse } from './ninos-api'

type Summary = { consultado_en: string; ninos_activos: number | null; evaluaciones_registradas: number | null; orientaciones_sin_valoracion: number | null; alertas_pendientes: number | null; alertas_en_revision: number | null }
const cards = [
  ['ninos_activos', 'Niños activos', 'Expedientes con estado activo.', '/ninos'],
  ['evaluaciones_registradas', 'Evaluaciones registradas', 'Excluye las evaluaciones anuladas.', '/evaluaciones'],
  ['orientaciones_sin_valoracion', 'Por revisar con el médico', 'Copias guardadas sin valoración, de evaluaciones registradas. Un niño puede tener varias.', '/evaluaciones'],
  ['alertas_pendientes', 'Alertas pendientes', 'Avisos cuyo seguimiento aún está pendiente.', '/alertas'],
  ['alertas_en_revision', 'Alertas en revisión', 'Avisos que se están revisando.', '/alertas'],
] as const
export function Dashboard({ onSessionExpired, onNavigate, routes }: { onSessionExpired: () => void; onNavigate: (route: string) => void; routes: string[] }) {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    fetch('/api/dashboard', { credentials: 'same-origin', signal: controller.signal }).then(readResponse<Summary>).then(result => { if (active) setData(result) }).catch((err: unknown) => {
      if (!active) return
      if (err instanceof ApiError && err.status === 401) onSessionExpired()
      else setError(err instanceof ApiError ? err.message : 'No se pudo cargar el resumen. Intenta actualizarlo.')
    }).finally(() => clearTimeout(timeout))
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [revision, onSessionExpired])
  return <section aria-labelledby="dashboard-title">
    {routes.includes('/crecimiento') && <GrowthHome admin onSessionExpired={onSessionExpired}/>}
    <section className="admin-quick" aria-labelledby="quick-title"><p className="portal-eyebrow">Inicio</p><h1 id="quick-title">¿Qué necesitas hacer?</h1><p className="home-intro">Elige una tarea para comenzar.</p><div className="admin-task-grid">{[
      ['/consulta', 'measure', 'Consulta rápida', 'Calcula y obtén un reporte sin registrar.'],
      ['/evaluaciones/crear', 'add', 'Evaluar a un niño', 'Guarda sus medidas y ve el resultado.'],
      ['/ninos', 'child', 'Buscar un niño', 'Abre su expediente y datos familiares.'],
      ['/ninos/crear', 'add', 'Registrar a un niño', 'Crea su expediente para darle seguimiento.'],
      ['/alertas', 'alert', 'Atender alertas', 'Revisa los avisos y su seguimiento.'],
      ['/crecimiento', 'measure', 'Ver crecimiento', 'Peso por edad y gráfica por día, mes o año.'],
      ['/reportes', 'report', 'Ver reportes', 'Consulta e imprime los reportes guardados.'],
    ].filter(([route]) => routes.includes(route)).map(([route, icon, title, description]) => <button key={route} className={`admin-task ${route === '/consulta' ? 'primary-task' : ''}`} onClick={() => onNavigate(route)}><span className="task-icon"><TaskIcon name={icon}/></span><span className="task-copy"><strong>{title}</strong><span>{description}</span></span><span className="task-arrow" aria-hidden="true">→</span></button>)}</div></section>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 id="dashboard-title" className="text-3xl font-semibold">Resumen del seguimiento</h1><button type="button" disabled={!data && !error} className="rounded border border-institucional px-4 py-2 text-institucional disabled:opacity-50" onClick={() => { setData(null); setError(''); setRevision(value => value + 1) }}>Actualizar</button></div>
    <p className="mt-3 text-secundario">Totales del historial disponible para tu cuenta.</p>
    {error && <p role="alert" className="mt-4 border-l-4 border-alerta bg-fondo p-4">{error}</p>}
    {!data && !error && <p role="status" className="mt-4">Consultando resumen…</p>}
    {data && <><p className="mt-3 text-sm text-secundario">Consultado: {new Date(data.consultado_en).toLocaleString('es-GT', { timeZone: 'America/Guatemala' })} (Guatemala)</p><div className="admin-stats">{cards.map(([key, label, description, route]) => <article key={key} className={`admin-stat ${key.startsWith('alertas') ? 'attention' : ''}`}><h2 className="font-semibold">{label}</h2><p className="my-3 text-3xl font-semibold text-institucional">{data[key] === null ? <span className="text-base text-secundario">Sin permiso de consulta</span> : data[key].toLocaleString('es-GT')}</p><details className="stat-help"><summary>¿Qué incluye?</summary><p>{description}</p></details>{data[key] !== null && routes.includes(route) && <button type="button" onClick={() => onNavigate(route)} className="mt-4 text-sm font-semibold text-institucional underline">{route === '/ninos' ? 'Ver expedientes' : route === '/alertas' ? 'Ver bandeja de alertas' : 'Ver evaluaciones'}</button>}</article>)}</div></>}
    <details className="admin-summary-help"><summary>Acerca de estos totales</summary><p>Los conteos de alertas incluyen todos los avisos abiertos, también los asociados a evaluaciones anuladas. Abrir la bandeja muestra todos sus estados. Estos conteos no indican gravedad clínica ni sustituyen la valoración del médico.</p></details>
  </section>
}
