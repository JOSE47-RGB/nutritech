import { Growth } from './Growth'
import { GrowthHome } from './GrowthHome'
import { LeafMark } from './LeafMark'
import { useEffect, useRef, useState } from 'react'
import type { Profile } from '../types'
import { QuickConsultation } from './QuickConsultation'
import './user-portal.css'

export function UserPortal({ user, busy, error, onLogout, onSessionExpired, onBack, onLogin }: { user?: Profile; busy: boolean; error: string; onLogout: () => void; onSessionExpired: () => void; onBack?: () => void; onLogin?: () => void }) {
  const [view, setView] = useState<'home'|'info'|'growth'>('home')
  const [showReference, setShowReference] = useState(false)
  const referencePanel = useRef<HTMLElement>(null)
  useEffect(() => { if (showReference) { referencePanel.current?.focus(); referencePanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } }, [showReference])
  const info = view === 'info'
  const setInfo = (value: boolean) => setView(value ? 'info' : 'home')
  useEffect(() => { document.title = `NutriTech | ${view === 'growth' ? 'Crecimiento' : info ? 'Información' : 'Mi evaluación'}` }, [info, view])
  const publicMode = !user
  const canCapture = publicMode || user.permisos.includes('evaluaciones.crear')
  return <div className="user-portal"><div className="portal-shell">
    <header className="portal-header"><a href="#inicio" className="portal-brand" onClick={() => setInfo(false)} aria-label="NutriTech inicio"><LeafMark/><span><strong>NUTRI<span>TECH</span></strong><small>Sistema de Seguimiento Nutricional Infantil</small></span></a><nav aria-label="Navegación de usuario"><button className={view === 'home' ? 'selected' : ''} onClick={() => setInfo(false)} aria-current={view === 'home' ? 'page' : undefined}>⌂ <span>Inicio</span></button>{user && canCapture && <button className={view === 'growth' ? 'selected' : ''} aria-current={view === 'growth' ? 'page' : undefined} onClick={() => setView('growth')}>↗ <span>Crecimiento</span></button>}<button className={info ? 'selected' : ''} onClick={() => setInfo(true)} aria-current={info ? 'page' : undefined}>ⓘ <span>Información</span></button></nav></header>
    <div className="portal-session">{user ? <><span>Hola, <strong>{user.nombres}</strong></span><div>{onBack && <button onClick={onBack}>Volver a administración</button>}<button disabled={busy} onClick={onLogout}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</button></div></> : <><span>Consulta pública · Sin iniciar sesión</span><button className="portal-login" onClick={onLogin}>Iniciar sesión</button></>}</div>
    {onBack && <p className="portal-preview">Vista previa del diseño de Usuario normal. Conservas los permisos de tu cuenta; no estás suplantando a otro usuario.</p>}
    <main id="inicio">
    <div hidden={view !== 'home'}><div className="portal-evaluation-intro"><div><h1>Evaluemos su crecimiento</h1><p>Completa tres pasos y consulta el resultado.</p></div><button type="button" className="consult-secondary" aria-expanded={showReference} aria-controls="home-reference" onClick={() => setShowReference(value => !value)}>{showReference ? 'Ocultar tabla de peso y talla' : 'Ver tabla de peso y talla'}</button></div>
    <section className="portal-card portal-evaluation" aria-label="Evaluación sin registro"><div className="portal-evaluation-label"><span>Consulta sin guardar</span><p>{publicMode ? 'Consulta y reporte temporal, sin crear una cuenta.' : 'Puedes registrar al niño después de ver el resultado.'}</p></div>
    {canCapture ? <QuickConsultation publicMode={publicMode} canRegister={Boolean(user?.permisos.includes('ninos.buscar'))} onSessionExpired={onSessionExpired} canReport={publicMode || Boolean(user?.permisos.includes('reportes.generar'))} /> : <p role="status" className="portal-info">Tu cuenta no tiene los permisos necesarios para capturar una evaluación. Consulta al administrador.</p>}
    </section>
    {showReference && <section ref={referencePanel} tabIndex={-1} id="home-reference" className="portal-reference-panel" aria-label="Tabla de peso y talla"><div className="portal-reference-actions"><button type="button" className="consult-secondary" onClick={() => { setShowReference(false); document.getElementById('consult-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>Volver a la evaluación ↑</button></div><GrowthHome publicMode={publicMode} canHistory={canCapture && Boolean(user?.permisos.includes('ninos.buscar'))} onSessionExpired={onSessionExpired}/></section>}
    <div className="portal-info"><span aria-hidden="true">ⓘ</span><p><strong>Consulta informativa:</strong> los resultados sirven como apoyo y orientación. No sustituyen la evaluación ni el diagnóstico de un profesional de salud.</p></div></div>{info && <section className="portal-card portal-information"><p className="portal-eyebrow">Información</p><h1>Acompañamos el seguimiento infantil</h1><p>Esta vista permite consultar orientación basada en referencias OMS y obtener un reporte sin registrar un niño ni guardar la medición en la base de datos.</p><h2>¿Cómo realizar una evaluación?</h2><ol><li>Completa la fecha de nacimiento, la fecha de medición y el sexo.</li><li>Ingresa peso, longitud o talla, método de medición y estado de edema.</li><li>Revisa los indicadores y avisos. Un resultado no disponible no equivale a ausencia de riesgo.</li><li>{publicMode ? 'Abre el reporte temporal y guárdalo como PDF desde el navegador.' : 'Genera el reporte si tu cuenta tiene ese permiso y compártelo con el profesional que da seguimiento.'}</li></ol><p>La edad se calcula en días para la fecha de evaluación. No se reemplaza por una edad redondeada en años. La cobertura técnica máxima del motor es de 1856 días. Al recargar o cerrar la página se pierde esta consulta; guarda el PDF si deseas conservarla.</p><p>Las decisiones clínicas y la atención corresponden al médico. NutriTech no realiza una notificación oficial al MSPAS.</p><button className="portal-primary" onClick={() => setInfo(false)}>Ir a la evaluación</button></section>}
    {view === 'growth' && user && canCapture && <section className="portal-card"><Growth onSessionExpired={onSessionExpired} canHistory={user.permisos.includes('ninos.buscar')} /></section>}
    {error && <p role="alert" className="portal-error">{error}</p>}
    </main><footer className="portal-footer"><p><strong>NUTRITECH</strong><span>Seguimiento nutricional infantil</span></p><p>Salud <b>·</b> Prevención <b>·</b> Desarrollo</p></footer>
  </div></div>
}
