import { Growth } from './Growth'
import { Communities } from './Communities'
import { TaskIcon } from './TaskIcon'
import { UserResult } from './UserResult'
import { QuickConsultation } from './QuickConsultation'
import type { Child } from './Evaluaciones'
import { LeafMark } from './LeafMark'
import './user-portal.css'
import './workspace.css'
import { Backups } from './Backups'
import { Users, Audit, Menus } from './Admin'
import { Dashboard } from './Dashboard'
import { Reports } from './Reports'
import { Alerts } from './Alerts'
import { PatronesView } from './PatronesView'
import { EvaluacionForm, EvaluacionesList } from './Evaluaciones'
import { NinoDetail } from './NinoDetail'
import { useEffect, useState } from 'react'
import type { MenuModule, MenuOption, Profile } from '../types'
import { NinosList } from './NinosList'
import { NinoForm } from './NinoForm'
import { RoleEditor } from './RoleEditor'

// Disponibilidad de pantallas, no reglas de autorización. El servidor decide los permisos.
const available = new Set(['/admin/respaldos', '/admin/usuarios', '/admin/auditoria', '/admin/menus', '/reportes', '/alertas', '/dashboard', '/admin/roles', '/ninos', '/ninos/crear', '/evaluaciones', '/evaluaciones/crear', '/admin/configuracion/patrones'])

const navigation: Record<string, [string, string]> = {
  '/dashboard': ['Inicio', 'home'], '/ninos': ['Buscar niños', 'child'], '/ninos/crear': ['Registrar niño', 'add'],
  '/evaluaciones': ['Historial', 'history'], '/evaluaciones/crear': ['Evaluar niño', 'measure'],
  '/alertas': ['Alertas', 'alert'], '/reportes': ['Reportes', 'report'],
}

interface Props {
  onPreview?: () => void
  user: Profile
  busy: boolean
  error: string
  onLogout: () => void
  onSessionExpired: () => void
}

function flatten(options: MenuOption[]): MenuOption[] {
  return options.flatMap((option) => [option, ...flatten(option.hijos)])
}

function MenuItems({ options, selected, onSelect }: {
  options: MenuOption[]; selected: string; onSelect: (code: string) => void
}) {
  return <ul className="space-y-1">
    {options.map((option) => {
      if (option.tipo === 'SEPARADOR') return <li key={option.id} aria-hidden="true" className="my-3 border-t border-white/20" />
      if (option.tipo === 'GRUPO') return <li key={option.id}><details open className="py-2">
        <summary className="cursor-pointer rounded px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-white">{option.nombre}</summary>
        <div className="ml-3 border-l border-white/20 pl-2"><MenuItems options={option.hijos} selected={selected} onSelect={onSelect} /></div>
      </details></li>
      const ready = option.ruta !== null && available.has(option.ruta)
      return <li key={option.id}>
        <button type="button" disabled={!ready} onClick={() => onSelect(option.codigo)} aria-current={selected === option.codigo ? 'page' : undefined}
          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default ${selected === option.codigo ? 'bg-white font-semibold text-institucional' : ready ? 'text-white hover:bg-white/15' : 'text-white/80'}`}>
          <span className="nav-label"><TaskIcon name={navigation[option.ruta ?? '']?.[1] ?? 'report'}/>{navigation[option.ruta ?? '']?.[0] ?? option.nombre}</span>{!ready && <span className="rounded border border-white/30 px-1.5 py-0.5 text-xs">Pendiente</span>}
        </button>
        {option.hijos.length > 0 && <div className="ml-3 pl-2"><MenuItems options={option.hijos} selected={selected} onSelect={onSelect} /></div>}
      </li>
    })}
  </ul>
}

export function Workspace({ user, busy, error, onLogout, onSessionExpired, onPreview }: Props) {
  const [modules, setModules] = useState<MenuModule[]>([])
  const [loading, setLoading] = useState(true)
  const [menuError, setMenuError] = useState('')
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState('HOME')
  const [evaluationChild, setEvaluationChild] = useState<Child | null>(null)
  const [historyChild, setHistoryChild] = useState<Child | null>(null)
  const [openedChild, setOpenedChild] = useState<string | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/menu', { credentials: 'same-origin', signal: controller.signal })
        if (!active) return
        if (response.status === 401) { onSessionExpired(); return }
        if (!response.ok) throw new Error()
        const data = await response.json() as MenuModule[]
        if (active) { setModules(data); setMenuError('') }
      } catch {
        if (active) { setModules([]); setMenuError('No se pudo cargar el menú. Intenta actualizarlo.') }
      } finally { clearTimeout(timeout); if (active) setLoading(false) }
    }
    void load()
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [revision, onSessionExpired])

  const allOptions = modules.flatMap((module) => flatten(module.opciones))
  const current = allOptions.find((option) => option.codigo === selected) ?? (selected === 'HOME' ? allOptions.find(option => option.ruta === '/dashboard') : undefined)
  useEffect(() => {
    document.title = `NutriTech | ${current?.ruta === '/dashboard' ? 'Inicio' : navigation[current?.ruta ?? '']?.[0] ?? current?.nombre ?? (selected === 'QUICK' ? 'Consulta rápida' : selected === 'HELP' ? 'Ayuda rápida' : selected === 'COMMUNITIES' ? 'Comunidades' : selected === 'GROWTH' ? 'Crecimiento' : 'Mi cuenta')}`
  }, [current?.nombre, current?.ruta, selected])

  const rolesView = !loading && current?.ruta === '/admin/roles'
  const listView = !loading && current?.ruta === '/ninos'
  const createView = !loading && current?.ruta === '/ninos/crear'
  const evaluationCreate = allOptions.find((option) => option.ruta === '/evaluaciones/crear')
  const evaluationList = allOptions.find((option) => option.ruta === '/evaluaciones')
  const createOption = allOptions.find((option) => option.ruta === '/ninos/crear')
  const listOption = allOptions.find((option) => option.ruta === '/ninos')

  function select(code: string) { setEvaluationChild(null); setHistoryChild(null); setOpenedChild(null); setSelected(code); setMobileMenu(false) }
  function refresh() { setLoading(true); setRevision((value) => value + 1) }

  return (
    <div className="user-portal admin-portal"><div className="portal-shell">
      <header className="portal-header"><button className="portal-brand" onClick={() => select('HOME')} aria-label="NutriTech inicio"><LeafMark/><span><strong>NUTRI<span>TECH</span></strong><small>Sistema de Seguimiento Nutricional Infantil</small></span></button><div className="admin-header-actions"><button onClick={() => select('ACCOUNT')}>Mi cuenta</button>{onPreview && <button onClick={onPreview}>Vista de usuario normal</button>}<button disabled={busy} onClick={onLogout}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</button></div></header>
      <div className="portal-session"><span>Hola, <strong>{user.nombres}</strong></span><span>{user.roles.map(role => role.nombre).join(' · ')}</span></div>
      <div className="admin-layout">
      <aside className="admin-sidebar" aria-label="Menú principal">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <h2 className="text-lg font-semibold">Tu menú</h2>
          <button type="button" className="rounded border border-institucional/30 px-3 py-2 text-sm lg:hidden" aria-expanded={mobileMenu} aria-controls="menu-options" onClick={() => setMobileMenu((value) => !value)}>{mobileMenu ? 'Ocultar' : 'Menú'}</button>
        </div>
        <nav id="menu-options" className={`${mobileMenu ? 'block' : 'hidden'} mt-3 lg:block`}>
          {user.permisos.includes('evaluaciones.crear') && <button className="mb-5 w-full rounded-lg bg-azul-claro px-3 py-3 text-left font-semibold text-institucional" aria-current={selected === 'QUICK' ? 'page' : undefined} onClick={() => select('QUICK')}><span className="nav-label"><TaskIcon name="measure"/>Consulta rápida</span></button>}
          {loading && <p role="status" className="px-3 py-2 text-sm">Cargando opciones…</p>}
          {!loading && modules.map((module) => {
            const advanced = flatten(module.opciones).some(option => option.ruta?.startsWith('/admin/'))
            const links = <MenuItems options={module.opciones} selected={current?.codigo ?? selected} onSelect={select} />
            return advanced ? <details key={module.id} className="admin-advanced" open={flatten(module.opciones).some(option => option.codigo === current?.codigo)}><summary>{module.nombre === 'Seguridad' ? 'Administrar el sistema' : module.nombre}</summary>{links}</details> : <section key={module.id} aria-label={module.nombre} className="nav-section">{links}</section>
          })}
          {user.permisos.includes('evaluaciones.ver') && <button type="button" className="w-full rounded-lg text-left" aria-current={selected === 'GROWTH' ? 'page' : undefined} onClick={() => select('GROWTH')}><span className="nav-label"><TaskIcon name="measure"/>Crecimiento</span></button>}
          {user.permisos.includes('comunidades.gestionar') && <button type="button" className="w-full rounded-lg text-left" aria-current={selected === 'COMMUNITIES' ? 'page' : undefined} onClick={() => select('COMMUNITIES')}><span className="nav-label"><TaskIcon name="home"/>Comunidades</span></button>}
          {!loading && !menuError && !modules.length && <p className="px-3 text-sm">No tienes opciones de menú asignadas.</p>}
          <button type="button" className="nav-help w-full rounded-lg text-left" aria-current={selected === 'HELP' ? 'page' : undefined} onClick={() => select('HELP')}><span className="nav-label"><TaskIcon name="help"/>Ayuda rápida</span></button>
        </nav>
      </aside>
      <main className="portal-card admin-content">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-institucional/10 pb-5">
          <p className="text-sm font-medium text-secundario"><button type="button" className="breadcrumb-home" onClick={() => select('HOME')}>Inicio</button> / <strong>{current?.ruta === '/dashboard' ? 'Inicio' : navigation[current?.ruta ?? '']?.[0] ?? current?.nombre ?? (selected === 'QUICK' ? 'Consulta rápida' : selected === 'HELP' ? 'Ayuda rápida' : selected === 'COMMUNITIES' ? 'Comunidades' : selected === 'GROWTH' ? 'Crecimiento' : 'Mi cuenta')}</strong></p>
          <button type="button" hidden={!menuError} disabled={loading} onClick={refresh} className="rounded-lg border border-institucional px-3 py-2 text-sm font-semibold text-institucional focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-institucional disabled:opacity-60">{loading ? 'Actualizando…' : 'Actualizar menú'}</button>
        </div>
        {menuError && <p role="alert" className="mb-6 rounded-lg border-l-4 border-alerta bg-fondo p-3">{menuError}</p>}
        {selected === 'GROWTH' && user.permisos.includes('evaluaciones.ver') ? <Growth admin onSessionExpired={onSessionExpired} /> : selected === 'COMMUNITIES' && user.permisos.includes('comunidades.gestionar') ? <Communities onSessionExpired={onSessionExpired} /> : selected === 'HELP' ? <section><p className="portal-eyebrow">Estamos para orientarte</p><h1>¿Por dónde empiezo?</h1><div className="help-grid">{[
          ['Solo quiero saber cómo va su crecimiento', 'Elige Consulta rápida. Completa las medidas, revisa el resultado e imprime el reporte. No necesitas crear un expediente.'],
          ['Quiero darle seguimiento', 'Registra al niño una vez. En las próximas visitas, búscalo y agrega una evaluación.'],
          ['Necesito revisar un resultado anterior', 'En Historial, selecciona al niño para ver únicamente sus evaluaciones. Los reportes guardados están en Reportes.'],
          ['Tengo un aviso pendiente', 'Abre Alertas para consultar el aviso y registrar el seguimiento. La valoración médica corresponde al personal de salud.'],
        ].map(([title, body]) => <details key={title}><summary>{title}</summary><p>{body}</p></details>)}</div><button type="button" className="portal-primary" onClick={() => select('HOME')}>Ir al inicio</button></section> : selected === 'QUICK' && user.permisos.includes('evaluaciones.crear') ? <section><h1 className="mb-4 text-3xl font-semibold">Consulta rápida</h1><QuickConsultation canRegister={user.permisos.includes('ninos.buscar')} canReport={user.permisos.includes('reportes.generar')} onSessionExpired={onSessionExpired} /></section> : !loading && current?.ruta === '/admin/respaldos' ? <Backups key={revision} onSessionExpired={onSessionExpired} /> : !loading && current?.ruta === '/admin/usuarios' ? <Users key={revision} permissions={user.permisos} onSessionExpired={onSessionExpired} /> : !loading && current?.ruta === '/admin/auditoria' ? <Audit key={revision} onSessionExpired={onSessionExpired} /> : !loading && current?.ruta === '/admin/menus' ? <Menus key={revision} canEdit={user.permisos.includes('menus.gestionar')} onSessionExpired={onSessionExpired} /> : !loading && current?.ruta === '/dashboard' ? <Dashboard key={revision} onSessionExpired={onSessionExpired} routes={[...allOptions.flatMap(option => option.ruta ? [option.ruta] : []), ...(user.permisos.includes('evaluaciones.crear') ? ['/consulta'] : []), ...(user.permisos.includes('evaluaciones.ver') ? ['/crecimiento'] : [])]} onNavigate={route => { if (route === '/crecimiento') { select('GROWTH'); return } if (route === '/consulta') { select('QUICK'); return } const option = allOptions.find(item => item.ruta === route); if (option) select(option.codigo) }} /> : !loading && current?.ruta === '/reportes' ? <Reports key={revision} onSessionExpired={onSessionExpired} /> : !loading && current?.ruta === '/alertas' ? <Alerts key={revision} onSessionExpired={onSessionExpired} /> : !loading && current?.ruta === '/admin/configuracion/patrones' ? <PatronesView key={revision} onSessionExpired={onSessionExpired} /> : !loading && current?.ruta === '/evaluaciones/crear' ? <EvaluacionForm initial={evaluationChild ? { child: evaluationChild, peso: '', talla: '', tipo: '', edema: 'DESCONOCIDO', date: 'la fecha indicada' } : undefined} renderSaved={user.permisos.includes('evaluaciones.ver') ? evaluation => <UserResult key={evaluation.codigo_publico} admin evaluation={evaluation} canReport={user.permisos.includes('reportes.generar')} onSessionExpired={onSessionExpired} onNew={() => { setEvaluationChild(null); setRevision(value => value + 1) }} onHistory={evaluationList ? () => { select(evaluationList.codigo); setHistoryChild(evaluation.ninos) } : undefined} /> : undefined} key={revision} onSessionExpired={onSessionExpired} onHistory={evaluationList ? child => { select(evaluationList.codigo); setHistoryChild(child) } : undefined} /> : !loading && current?.ruta === '/evaluaciones' ? <EvaluacionesList initialChild={historyChild} canAnnul={user.permisos.includes('evaluaciones.anular')} key={revision} onSessionExpired={onSessionExpired} onCreate={evaluationCreate ? () => select(evaluationCreate.codigo) : undefined} /> : rolesView ? <RoleEditor key={revision} onSessionExpired={onSessionExpired} /> : listView ? (
          openedChild ? <NinoDetail key={`${openedChild}-${revision}`} code={openedChild} canEdit={user.permisos.includes('ninos.editar')} onBack={() => setOpenedChild(null)} onSessionExpired={onSessionExpired} /> : <NinosList key={`list-${revision}`} onOpen={setOpenedChild} onSessionExpired={onSessionExpired} onCreate={createOption ? () => select(createOption.codigo) : undefined} />
        ) : createView ? (
          <NinoForm onCreated={evaluationCreate ? child => { select(evaluationCreate.codigo); setEvaluationChild(child) } : undefined} canLinkGuardians={user.permisos.includes('ninos.editar')} key={`create-${revision}`} onSessionExpired={onSessionExpired} onViewList={listOption ? () => select(listOption.codigo) : undefined} />
        ) : (
          <section aria-labelledby="account-title">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-salud">Sesión activa</p>
            <h1 id="account-title" className="text-2xl font-semibold sm:text-3xl">Bienvenido, {user.nombres}</h1>
            {selected !== 'ACCOUNT' && selected !== 'HOME' && !current && !loading && !menuError && <p role="status" className="mt-4 border-l-4 border-advertencia bg-fondo p-3">La opción seleccionada ya no está disponible en tu menú.</p>}
            <dl className="mt-7 grid gap-5 sm:grid-cols-2">
              <div><dt className="text-sm text-secundario">Nombre completo</dt><dd className="mt-1 font-medium">{user.nombres} {user.apellidos}</dd></div>
              <div><dt className="text-sm text-secundario">Código de acceso</dt><dd className="mt-1 font-medium">{user.codigo_acceso}</dd></div>
              <div><dt className="text-sm text-secundario">Módulos en tu menú</dt><dd className="mt-1 font-medium">{loading ? 'Consultando…' : modules.length}</dd></div>
              <div><dt className="text-sm text-secundario">Sesión válida hasta</dt><dd className="mt-1 font-medium">{new Date(user.expira_en).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</dd></div>
            </dl>
            <p className="mt-7 rounded-lg border-l-4 border-salud bg-verde-claro p-4 leading-relaxed">Tu menú muestra las opciones permitidas para tu cuenta. Selecciona una opción para consultar expedientes, evaluaciones y seguimiento.</p>
          </section>
        )}
        {error && <p role="alert" className="mt-5 border-l-4 border-alerta bg-fondo p-3">{error}</p>}

      </main>
    </div><footer className="portal-footer"><p><strong>NUTRITECH</strong><span>Seguimiento nutricional infantil</span></p><p>Salud · Prevención · Desarrollo</p></footer></div></div>
  )
}
