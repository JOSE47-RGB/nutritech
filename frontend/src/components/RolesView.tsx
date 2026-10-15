import { useEffect, useState } from 'react'

interface Role {
  id: number
  nombre: string
  descripcion: string | null
  activo: boolean
  permisos: { codigo: string; modulo: string; descripcion: string }[]
}

export function RolesView({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/seguridad/roles', { signal: controller.signal, credentials: 'same-origin' })
        if (!active) return
        if (response.status === 401) { onSessionExpired(); return }
        if (response.status === 403) throw new Error('No tienes permiso para consultar los roles. Actualiza tu menú para ver los accesos vigentes.')
        if (!response.ok) throw new Error('No se pudieron consultar los roles. Usa «Actualizar menú» para reintentar.')
        const data = await response.json() as Role[]
        if (active) setRoles(data)
      } catch (err) {
        if (active) setError(err instanceof Error && err.name === 'Error' ? err.message : 'No se pudo conectar con el servidor. Usa «Actualizar menú» para reintentar.')
      } finally { clearTimeout(timeout); if (active) setLoading(false) }
    }
    void load()
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [onSessionExpired])

  return (
    <section aria-labelledby="roles-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="roles-title" className="text-2xl font-semibold sm:text-3xl">Roles y permisos</h1>
        <span className="rounded-full bg-azul-claro px-3 py-1 text-sm font-medium text-institucional">Solo consulta</span>
      </div>
      <p className="mt-3 text-base leading-relaxed text-secundario">Consulta las funciones asignadas a cada rol. Los permisos particulares de un usuario pueden ampliar o restringir estos accesos.</p>
      {loading && <p role="status" className="mt-6">Cargando roles…</p>}
      {error && <p role="alert" className="mt-6 rounded-lg border-l-4 border-alerta bg-fondo p-4">{error}</p>}
      {!loading && !error && roles.length === 0 && <p className="mt-6">No hay roles registrados.</p>}
      <div className="mt-7 space-y-4">
        {roles.map((role) => (
          <details key={role.id} className="rounded-xl border border-institucional/15 bg-white p-5">
            <summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-institucional">
              <span className="ml-2 text-lg font-semibold">{role.nombre}</span>
              <span className="ml-3 text-sm text-secundario">{role.activo ? `${role.permisos.length} permisos activos` : 'Rol inactivo'}</span>
            </summary>
            <p className="mt-3 text-base text-secundario">{role.descripcion}</p>
            {!role.activo && <p className="mt-3 border-l-4 border-advertencia bg-fondo p-3">Este rol está inactivo y no concede permisos.</p>}
            <ul className="mt-5 divide-y divide-institucional/10">
              {role.permisos.map((permission) => <li key={permission.codigo} className="py-3">
                <p className="text-base">{permission.descripcion}</p>
                <code className="mt-1 block break-all text-sm text-institucional">{permission.codigo}</code>
              </li>)}
            </ul>
            {!role.permisos.length && <p className="mt-3 text-secundario">Sin permisos activos asignados.</p>}
          </details>
        ))}
      </div>
    </section>
  )
}
