import { UserPortal } from './components/UserPortal'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import type { Profile } from './types'
import { Workspace } from './components/Workspace'

const buttonStyle = 'rounded-lg bg-institucional px-5 py-3 text-base font-semibold text-white transition hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-institucional disabled:cursor-wait disabled:opacity-60'
const inputStyle = 'mt-2 w-full rounded-lg border border-secundario/40 bg-white px-4 py-3 text-texto outline-none focus:border-institucional focus:ring-2 focus:ring-institucional/20'

async function profile(signal?: AbortSignal): Promise<Profile | null> {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin', signal: signal ?? AbortSignal.timeout(8000) })
  if (response.status === 401) return null
  if (!response.ok) throw new Error('No se pudo consultar la sesión. Comprueba que el servidor esté disponible.')
  return response.json() as Promise<Profile>
}

function App() {
  const [route, setRoute] = useState(() => window.location.hash)
  const [portalPreview, setPortalPreview] = useState(false)
  const [user, setUser] = useState<Profile | null>(null)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [connection, setConnection] = useState('')
  const [connectionBusy, setConnectionBusy] = useState(false)

  useEffect(() => {
    if (!user && route === '#ingresar') document.title = 'NutriTech | Iniciar sesión'
  }, [user, route])

  useEffect(() => {
    const update = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  const openLogin = useCallback(() => { window.location.hash = 'ingresar' }, [])
  const openPublic = useCallback(() => { window.location.hash = 'publico' }, [])

  const sessionExpired = useCallback(() => {
    setUser(null)
    setPortalPreview(false)
    setNotice('Tu sesión ya no está disponible. Ingresa nuevamente.')
    window.location.hash = 'ingresar'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    let active = true
    profile(controller.signal)
      .then((value) => { if (active) setUser(value) })
      .catch(() => { if (active) setError('No se pudo consultar la sesión. Comprueba la conexión e intenta ingresar.') })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [])

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => {
      setUser(null)
    setPortalPreview(false)
      setNotice('Tu sesión venció. Ingresa nuevamente para continuar.')
      window.location.hash = 'ingresar'
    }, Math.max(0, new Date(user.expira_en).getTime() - Date.now()))
    return () => clearTimeout(timer)
  }, [user])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const fields = new FormData(event.currentTarget)
    const submittedCode = String(fields.get('codigo_acceso') ?? '').trim()
    const submittedPassword = String(fields.get('contrasena') ?? '')
    setCode(submittedCode)
    setBusy(true); setError(''); setNotice('')
    try {
      if (new TextEncoder().encode(submittedPassword).length > 72) throw new Error('La contraseña supera el máximo de 72 bytes.')
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-NutriTech-Request': '1' },
        body: JSON.stringify({ codigo_acceso: submittedCode, contrasena: submittedPassword }),
        signal: AbortSignal.timeout(15000),
      })
      if (response.status === 401) throw new Error('Código o contraseña incorrectos, o acceso no disponible. Si fallaste cinco veces, espera 15 minutos.')
      if (response.status === 429) throw new Error('Demasiados intentos. Espera un minuto antes de volver a intentar.')
      if (response.status >= 500) throw new Error('El servicio de acceso no está disponible. Comprueba que el backend de NutriTech esté encendido e inténtalo de nuevo. Este error no confirma que la contraseña sea incorrecta.')
      if (response.status === 403) throw new Error('Esta dirección no está autorizada para iniciar sesión. Abre NutriTech desde la dirección local configurada.')
      if (response.status === 400) throw new Error('Revisa el código de acceso y la contraseña.')
      if (!response.ok) throw new Error('No se pudo iniciar sesión. Intenta nuevamente en unos momentos.')
      const account = await profile()
      if (!account) throw new Error('No se pudo recuperar la sesión. Intenta ingresar nuevamente.')
      setUser(account)
      window.location.hash = 'inicio'
    } catch (err) {
      setError(err instanceof Error && err.name === 'Error' ? err.message : 'No se pudo conectar con el servidor. Intenta nuevamente.')
    } finally {
      setPassword(''); setBusy(false)
    }
  }

  async function logout() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'X-NutriTech-Request': '1' }, signal: AbortSignal.timeout(8000),
      })
      if (!response.ok && response.status !== 401) throw new Error('No se pudo cerrar la sesión. Intenta nuevamente.')
      setUser(null); setPortalPreview(false); setNotice('Cerraste sesión correctamente.')
      window.location.hash = 'publico'
    } catch {
      setError('No se pudo confirmar el cierre de sesión. Comprueba la conexión e intenta nuevamente.')
    } finally { setBusy(false) }
  }

  async function checkConnection() {
    setConnectionBusy(true); setConnection('Comprobando…')
    try {
      const response = await fetch('/api/', { signal: AbortSignal.timeout(5000) })
      if (!response.ok || await response.text() !== 'Hello World!') throw new Error()
      setConnection('Conexión correcta. El servidor de NutriTech responde.')
    } catch { setConnection('No se pudo conectar. Verifica que NestJS esté iniciado en el puerto 3017.') }
    finally { setConnectionBusy(false) }
  }

  const isNormal = user?.roles.length === 1 && user.roles[0].codigo === 'USUARIO_NORMAL'
  // La portada se puede usar sin sesión, incluso mientras se comprueba una cookie anterior.
  if ((!user && route !== '#ingresar') || route === '#publico') return <UserPortal busy={false} error="" onLogout={logout} onSessionExpired={openLogin} onLogin={openLogin} />
  if (!checking && user && (isNormal || portalPreview)) return <UserPortal user={user} busy={busy} error={error} onLogout={logout} onSessionExpired={sessionExpired} onBack={!isNormal ? () => setPortalPreview(false) : undefined} />

  if (!checking && user) return <Workspace user={user} busy={busy} error={error} onLogout={logout} onSessionExpired={sessionExpired} onPreview={user.roles.some(role => role.codigo === 'ADMINISTRADOR') ? () => setPortalPreview(true) : undefined} />

  return (
    <div className="min-h-screen">
      <header className="border-b border-institucional/15 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <span className="text-2xl font-bold tracking-tight text-institucional">NutriTech<span className="text-salud">.</span></span>
          <button type="button" className="rounded-lg border border-institucional px-4 py-2 text-sm font-semibold text-institucional" onClick={openPublic}>Volver a la consulta pública</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        {checking ? <p role="status">Consultando tu sesión…</p> : user ? (
          <>{user.roles.some(role => role.codigo === 'ADMINISTRADOR') && <button className="mb-4 rounded-lg border border-institucional px-4 py-2 text-institucional" onClick={() => setPortalPreview(true)}>Ver vista de Usuario normal</button>}<Workspace user={user} busy={busy} error={error} onLogout={logout} onSessionExpired={sessionExpired} /></>
        ) : (
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <section className="max-w-lg">
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-institucional">NutriTech</p>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Seguimiento infantil,<br />con información organizada.</h1>
              <p className="mt-6 text-lg leading-relaxed text-secundario">Accede con tu cuenta institucional para continuar.</p>
              <div className="mt-8 h-1 w-20 rounded-full bg-salud" />
            </section>
            <section aria-labelledby="login-title" className="rounded-2xl border border-institucional/15 bg-white p-6 shadow-sm sm:p-10">
              <h2 id="login-title" className="text-2xl font-semibold">Iniciar sesión</h2>
              <p className="mt-2 text-base text-secundario">Introduce tus datos de acceso a NutriTech.</p>
              {notice && <p role="status" className="mt-5 rounded-lg border-l-4 border-institucional bg-azul-claro p-3">{notice}</p>}
              <form onSubmit={login} className="mt-7 space-y-5">
                <div><label htmlFor="codigo" className="text-sm font-semibold">Código de acceso</label>
                  <input id="codigo" name="codigo_acceso" autoComplete="username" required minLength={3} maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} className={inputStyle} disabled={busy} />
                </div>
                <div><label htmlFor="password" className="text-sm font-semibold">Contraseña</label>
                  <input id="password" name="contrasena" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} className={inputStyle} disabled={busy} />
                  <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-secundario"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} className="h-4 w-4 accent-institucional" />Mostrar contraseña</label>
                </div>
                {error && <p role="alert" className="rounded-lg border-l-4 border-alerta bg-fondo p-3 text-base text-texto">{error}</p>}
                <button type="submit" disabled={busy} className={`${buttonStyle} w-full`}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
              </form>
              <p className="mt-6 text-sm leading-relaxed text-secundario">Si no tienes una cuenta, comunícate con el administrador del sistema.</p>
            </section>
          </div>
        )}
        <details className="mx-auto mt-10 max-w-2xl text-sm text-secundario">
          <summary className="w-fit cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-institucional">Comprobar conexión con el servidor</summary>
          <button type="button" disabled={connectionBusy} onClick={checkConnection} className="mt-4 rounded border border-institucional px-4 py-2 font-medium text-institucional disabled:opacity-60">{connectionBusy ? 'Comprobando…' : 'Comprobar conexión'}</button>
          <p role="status" className="mt-3">{connection}</p>
        </details>
      </main>
    </div>
  )
}

export default App
