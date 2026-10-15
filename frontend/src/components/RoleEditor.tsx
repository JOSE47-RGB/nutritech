import { useEffect, useState } from 'react'
import { ApiError, readResponse } from './ninos-api'
type Catalog = {
  permisos: { codigo: string; descripcion: string }[]
  roles: {
    codigo: string
    nombre: string
    activo: boolean
    permisos: string[]
    revision: string
  }[]
}
export function RoleEditor({
  onSessionExpired,
}: {
  onSessionExpired: () => void
}) {
  const [data, setData] = useState<Catalog | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    fetch('/api/admin/roles')
      .then(readResponse<Catalog>)
      .then((r) => {
        if (active) setData(r)
      })
      .catch((e: unknown) => {
        if (!active) return
        if (e instanceof ApiError && e.status === 401) onSessionExpired()
        else
          setError(
            e instanceof Error ? e.message : 'No se pudieron cargar los roles.',
          )
      })
    return () => {
      active = false
    }
  }, [revision, onSessionExpired])
  async function save(role: Catalog['roles'][number], form: HTMLFormElement) {
    setBusy(true)
    setError('')
    setMessage('')
    const f = new FormData(form)
    try {
      const r = await readResponse<{ mensaje: string }>(
        await fetch(`/api/admin/roles/${role.codigo}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-NutriTech-Request': '1',
          },
          body: JSON.stringify({
            permisos: f.getAll('permisos'),
            motivo: f.get('motivo'),
            revision: role.revision,
          }),
        }),
      )
      setMessage(r.mensaje)
      setRevision((v) => v + 1)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onSessionExpired()
      else setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section>
      <h1 className="text-3xl font-semibold">Roles y permisos</h1>
      <p className="mt-3">
        Los cambios afectan a todas las cuentas con ese rol y cierran sus
        sesiones. Las denegaciones particulares siguen prevaleciendo. El rol
        administrador y los roles de tu propia cuenta están protegidos.
      </p>
      <button
        className="mt-3 rounded border px-3 py-2"
        disabled={busy}
        onClick={() => {
          setError('')
          setRevision((v) => v + 1)
        }}
      >
        Actualizar roles
      </button>
      {error && (
        <p role="alert" className="mt-3 text-alerta">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-salud">
          {message}
        </p>
      )}
      {!data && !error && <p role="status">Cargando…</p>}
      <div className="mt-4 space-y-4">
        {data?.roles.map((role) => (
          <details
            key={`${role.codigo}-${role.revision}`}
            className="rounded border p-4"
          >
            <summary className="cursor-pointer font-semibold">
              {role.nombre} · {role.permisos.length} permisos{' '}
              {role.activo ? '' : '· Inactivo'}
            </summary>
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault()
                void save(role, e.currentTarget)
              }}
            >
              <fieldset
                disabled={
                  busy || role.codigo === 'ADMINISTRADOR' || !role.activo
                }
              >
                <legend className="sr-only">Permisos de {role.nombre}</legend>
                {data.permisos.map((p) => (
                  <label className="my-3 flex items-start gap-3" key={p.codigo}>
                    <input
                      type="checkbox"
                      name="permisos"
                      value={p.codigo}
                      defaultChecked={role.permisos.includes(p.codigo)}
                    />
                    <span>
                      {p.descripcion}
                      <span className="block text-sm text-secundario">
                        {p.codigo}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {role.codigo !== 'ADMINISTRADOR' && role.activo && (
                <>
                  <label className="block">
                    Motivo
                    <input
                      disabled={busy}
                      required
                      name="motivo"
                      minLength={5}
                      maxLength={255}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <button
                    disabled={busy}
                    className="mt-3 rounded bg-institucional px-4 py-2 text-white disabled:opacity-50"
                  >
                    Guardar permisos
                  </button>
                </>
              )}
            </form>
          </details>
        ))}
      </div>
    </section>
  )
}
