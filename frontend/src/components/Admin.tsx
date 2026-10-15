import { useEffect, useState } from 'react'
import { ApiError, readResponse } from './ninos-api'
const input = 'w-full rounded border border-institucional/30 p-2'
const button =
  'rounded border border-institucional px-3 py-2 text-institucional disabled:opacity-50'
type Row = {
  codigo_publico: string
  codigo_acceso: string
  nombres: string
  apellidos: string
  estado: string
  roles: { id: number; nombre: string }[]
  revision: string
}
type Role = { id: number; nombre: string; activo: boolean }
type Page<T> = { datos: T[]; pagina: number; paginas: number; total: number }
async function adminRequest<T>(url: string, body?: unknown): Promise<T> {
  return readResponse<T>(
    await fetch(
      `/api${url}`,
      body === undefined
        ? { credentials: 'same-origin' }
        : {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json',
              'X-NutriTech-Request': '1',
            },
            body: JSON.stringify(body),
          },
    ),
  )
}
function Pager({
  page,
  total,
  change,
}: {
  page: number
  total: number
  change: (p: number) => void
}) {
  return (
    <div className="mt-4 flex gap-4">
      <button
        className={button}
        disabled={page <= 1}
        onClick={() => change(page - 1)}
      >
        Anterior
      </button>
      <span>
        Página {page} de {total}
      </span>
      <button
        className={button}
        disabled={page >= total}
        onClick={() => change(page + 1)}
      >
        Siguiente
      </button>
    </div>
  )
}
export function Users({
  permissions,
  onSessionExpired,
}: {
  permissions: string[]
  onSessionExpired: () => void
}) {
  const [data, setData] = useState<Page<Row> | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Row | 'new' | null>(null)
  const [reset, setReset] = useState<Row | null>(null)
  const manage =
    permissions.includes('usuarios.gestionar') &&
    permissions.includes('roles.gestionar')
  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 401) onSessionExpired()
    else
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar la operación.',
      )
  }
  useEffect(() => {
    let active = true
    Promise.all([
      adminRequest<Page<Row>>(
        `/admin/usuarios?pagina=${page}&buscar=${encodeURIComponent(query)}`,
      ),
      manage ? adminRequest<Role[]>('/seguridad/roles') : Promise.resolve([]),
    ])
      .then(([rows, catalog]) => {
        if (active) {
          setData(rows)
          setRoles(catalog.filter((r) => r.activo))
        }
      })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof ApiError && err.status === 401) onSessionExpired()
        else setError(err instanceof Error ? err.message : 'No se pudo cargar.')
      })
    return () => {
      active = false
    }
  }, [page, query, revision, manage, onSessionExpired])
  function refresh() {
    setData(null)
    setError('')
    setRevision((v) => v + 1)
  }
  async function save(form: HTMLFormElement) {
    const values = new FormData(form)
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (reset) {
        await adminRequest(
          `/admin/usuarios/${reset.codigo_publico}/contrasena`,
          { contrasena: values.get('contrasena') },
        )
        setReset(null)
      } else {
        const common = {
          nombres: values.get('nombres'),
          apellidos: values.get('apellidos'),
          roles: values.getAll('roles').map(Number),
        }
        if (selected === 'new')
          await adminRequest('/admin/usuarios', {
            ...common,
            codigo_acceso: values.get('codigo_acceso'),
            contrasena: values.get('contrasena'),
          })
        else if (selected)
          await adminRequest(`/admin/usuarios/${selected.codigo_publico}`, {
            ...common,
            estado: values.get('estado'),
            motivo: values.get('motivo'),
            revision: selected.revision,
          })
        setSelected(null)
      }
      form.reset()
      setMessage(
        'Cambios guardados. Los cambios de acceso cierran las sesiones anteriores.',
      )
      refresh()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section>
      <h1 className="text-3xl font-semibold">Usuarios</h1>
      <p className="mt-3">
        Administra cuentas y asigna los roles definidos en Roles y permisos. Las
        contraseñas existentes no se pueden consultar.
      </p>
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
      <form
        className="my-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setQuery(search)
          refresh()
        }}
      >
        <input
          aria-label="Buscar usuario"
          maxLength={80}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={input}
          placeholder="Código, nombres o apellidos"
        />
        <button className={button}>Buscar</button>
      </form>
      {manage && (
        <button
          disabled={busy}
          className={button}
          onClick={() => {
            setSelected('new')
            setReset(null)
            setError('')
          }}
        >
          Crear usuario
        </button>
      )}
      {(selected || reset) && (
        <form
          key={
            reset?.codigo_publico ??
            (selected === 'new' ? 'new' : selected?.codigo_publico)
          }
          className="my-5 space-y-3 rounded border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save(e.currentTarget)
          }}
        >
          <h2 className="text-xl font-semibold">
            {reset
              ? `Restablecer contraseña: ${reset.codigo_acceso}`
              : selected === 'new'
                ? 'Nueva cuenta'
                : 'Editar cuenta'}
          </h2>
          {!reset && (
            <>
              <label className="block">
                Nombres
                <input
                  name="nombres"
                  required
                  maxLength={120}
                  defaultValue={
                    selected && selected !== 'new' ? selected.nombres : ''
                  }
                  className={input}
                />
              </label>
              <label className="block">
                Apellidos
                <input
                  name="apellidos"
                  required
                  maxLength={120}
                  defaultValue={
                    selected && selected !== 'new' ? selected.apellidos : ''
                  }
                  className={input}
                />
              </label>
              {selected === 'new' ? (
                <label className="block">
                  Código de acceso
                  <input
                    name="codigo_acceso"
                    required
                    pattern="[A-Za-z0-9_.\-]{3,40}"
                    className={input}
                    autoComplete="off"
                  />
                </label>
              ) : (
                <>
                  <label className="block">
                    Estado
                    <select
                      name="estado"
                      defaultValue={selected?.estado}
                      className={input}
                    >
                      <option>ACTIVO</option>
                      <option>BLOQUEADO</option>
                      <option>INACTIVO</option>
                    </select>
                  </label>
                  <label className="block">
                    Motivo del cambio
                    <input
                      name="motivo"
                      required
                      minLength={5}
                      maxLength={255}
                      className={input}
                    />
                  </label>
                </>
              )}
              <fieldset>
                <legend>Roles (selecciona al menos uno)</legend>
                {roles.map((r) => (
                  <label key={r.id} className="mr-4 inline-flex gap-2">
                    <input
                      type="checkbox"
                      name="roles"
                      value={r.id}
                      defaultChecked={
                        selected && selected !== 'new'
                          ? selected.roles.some((x) => x.id === r.id)
                          : false
                      }
                    />
                    {r.nombre}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {(reset || selected === 'new') && (
            <label className="block">
              Nueva contraseña (mínimo 12 caracteres)
              <input
                name="contrasena"
                type="password"
                minLength={12}
                maxLength={72}
                required
                autoComplete="new-password"
                className={input}
              />
            </label>
          )}
          <div className="flex gap-3">
            <button disabled={busy} className={button}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              disabled={busy}
              className={button}
              onClick={() => {
                setSelected(null)
                setReset(null)
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {!data && !error && <p role="status">Cargando usuarios…</p>}
      {data && (
        <>
          <p className="mt-4">{data.total} cuentas</p>
          <div className="mt-3 space-y-3">
            {data.datos.map((row) => (
              <article className="rounded border p-4" key={row.codigo_publico}>
                <h2 className="font-semibold">
                  {row.nombres} {row.apellidos} · {row.codigo_acceso}
                </h2>
                <p>
                  {row.estado} · {row.roles.map((r) => r.nombre).join(', ')}
                </p>
                {manage && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() => {
                        setSelected(row)
                        setReset(null)
                        setError('')
                      }}
                    >
                      Editar y asignar roles
                    </button>
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() => {
                        setReset(row)
                        setSelected(null)
                        setError('')
                      }}
                    >
                      Restablecer contraseña
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
          <Pager
            page={page}
            total={data.paginas}
            change={(p) => {
              setPage(p)
              refresh()
            }}
          />
        </>
      )}
    </section>
  )
}
type AuditRow = {
  id: string
  accion: string
  entidad: string
  entidad_id: string | null
  ocurrido_en: string
  usuarios: { codigo_acceso: string } | null
}
export function Audit({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [data, setData] = useState<Page<AuditRow> | null>(null)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    adminRequest<Page<AuditRow>>(
      `/admin/auditoria?pagina=${page}&buscar=${encodeURIComponent(query)}`,
    )
      .then((r) => {
        if (active) setData(r)
      })
      .catch((e: unknown) => {
        if (!active) return
        if (e instanceof ApiError && e.status === 401) onSessionExpired()
        else
          setError(
            e instanceof Error ? e.message : 'No se pudo cargar la auditoría.',
          )
      })
    return () => {
      active = false
    }
  }, [page, query, revision, onSessionExpired])
  const reload = () => {
    setData(null)
    setError('')
    setRevision((v) => v + 1)
  }
  return (
    <section>
      <h1 className="text-3xl font-semibold">Auditoría</h1>
      <p className="mt-3">
        Operaciones registradas, de la más reciente a la más antigua. No muestra
        contraseñas ni el contenido clínico de los cambios.
      </p>
      <form
        className="my-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setQuery(search)
          reload()
        }}
      >
        <input
          className={input}
          aria-label="Filtrar por entidad"
          placeholder="Entidad, por ejemplo usuarios"
          maxLength={80}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={button}>Consultar</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Cargando…</p>}
      {data && (
        <>
          <p>{data.total} operaciones</p>
          <div className="mt-3 space-y-3">
            {data.datos.map((row) => (
              <article key={row.id} className="rounded border p-3">
                <h2 className="font-semibold">
                  {row.accion} · {row.entidad}
                </h2>
                <p>
                  {row.usuarios?.codigo_acceso ?? 'Sistema'} ·{' '}
                  {new Date(row.ocurrido_en).toLocaleString('es-GT', {
                    timeZone: 'America/Guatemala',
                  })}{' '}
                  (Guatemala)
                </p>
                <p className="break-all text-sm">
                  Registro: {row.entidad_id ?? '—'}
                </p>
              </article>
            ))}
          </div>
          <Pager
            page={page}
            total={data.paginas}
            change={(p) => {
              setPage(p)
              reload()
            }}
          />
        </>
      )}
    </section>
  )
}
type MenuRow = {
  codigo: string
  nombre: string
  ruta: string | null
  orden: number
  visible: boolean
  activo: boolean
  revision: string
  modulos_menu: { nombre: string }
}
export function Menus({
  canEdit,
  onSessionExpired,
}: {
  canEdit: boolean
  onSessionExpired: () => void
}) {
  const [rows, setRows] = useState<MenuRow[]>([])
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    adminRequest<MenuRow[]>('/admin/menus')
      .then((r) => {
        if (active) setRows(r)
      })
      .catch((e: unknown) => {
        if (!active) return
        if (e instanceof ApiError && e.status === 401) onSessionExpired()
        else setError(e instanceof Error ? e.message : 'No se pudo cargar.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [revision, onSessionExpired])
  async function save(row: MenuRow, form: HTMLFormElement) {
    setBusy(true)
    setError('')
    setMessage('')
    const f = new FormData(form)
    try {
      const r = await adminRequest<{ mensaje: string }>(
        `/admin/menus/${row.codigo}`,
        {
          nombre: f.get('nombre'),
          orden: Number(f.get('orden')),
          activo: f.has('activo'),
          visible: f.has('visible'),
          revision: row.revision,
        },
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
      <h1 className="text-3xl font-semibold">Menús del sistema</h1>
      <p className="mt-3">
        Personaliza nombres, orden y visibilidad de las pantallas existentes.
        Ocultar una opción no cambia los permisos de acceso.
      </p>
      <button
        className={`${button} mt-3`}
        onClick={() => {
          setError('')
          setLoading(true)
          setRevision((v) => v + 1)
        }}
      >
        Actualizar opciones
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
      {loading && <p role="status">Cargando…</p>}
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <form
            key={`${row.codigo}-${row.revision}`}
            className="space-y-2 rounded border p-4"
            onSubmit={(e) => {
              e.preventDefault()
              void save(row, e.currentTarget)
            }}
          >
            <h2 className="font-semibold">
              {row.modulos_menu.nombre} · {row.codigo}
            </h2>
            <p className="break-all text-sm">{row.ruta}</p>
            <label className="block">
              Nombre
              <input
                disabled={!canEdit || busy}
                className={input}
                name="nombre"
                defaultValue={row.nombre}
                required
                maxLength={120}
              />
            </label>
            <label className="block">
              Orden
              <input
                disabled={!canEdit || busy}
                className={input}
                name="orden"
                type="number"
                min={0}
                max={65535}
                defaultValue={row.orden}
                required
              />
            </label>
            <label className="mr-4">
              <input
                disabled={!canEdit || busy}
                type="checkbox"
                name="visible"
                defaultChecked={row.visible}
              />{' '}
              Visible
            </label>
            <label>
              <input
                disabled={!canEdit || busy}
                type="checkbox"
                name="activo"
                defaultChecked={row.activo}
              />{' '}
              Activa
            </label>
            {canEdit && (
              <button className={`${button} ml-4`} disabled={busy}>
                Guardar opción
              </button>
            )}
          </form>
        ))}
      </div>
    </section>
  )
}
