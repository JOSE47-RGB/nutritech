import { useEffect, useState } from 'react'
import { ApiError, readResponse } from './ninos-api'
type Data = {
  configurado: boolean
  ejecutando: boolean
  datos: {
    id: string
    estado: string
    iniciado_en: string
    verificado_en: string | null
    tamano_bytes: string | null
    detalle_error: string | null
  }[]
}
export function Backups({
  onSessionExpired,
}: {
  onSessionExpired: () => void
}) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    fetch('/api/admin/respaldos')
      .then(readResponse<Data>)
      .then((r) => {
        if (active) setData(r)
      })
      .catch((e: unknown) => {
        if (!active) return
        if (e instanceof ApiError && e.status === 401) onSessionExpired()
        else setError(e instanceof Error ? e.message : 'No se pudo cargar.')
      })
    return () => {
      active = false
    }
  }, [revision, onSessionExpired])
  async function create() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const r = await readResponse<{ mensaje: string }>(
        await fetch('/api/admin/respaldos', {
          method: 'POST',
          headers: { 'X-NutriTech-Request': '1' },
        }),
      )
      setMessage(r.mensaje)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onSessionExpired()
      else
        setError(e instanceof Error ? e.message : 'No se completó el respaldo.')
    } finally {
      setBusy(false)
      setRevision((v) => v + 1)
    }
  }
  return (
    <section>
      <h1 className="text-3xl font-semibold">Respaldos</h1>
      <p className="mt-3">
        Copia cifrada de la base de datos, guardada en el servidor. La
        verificación comprueba la integridad del archivo; no confirma una
        restauración de prueba.
      </p>
      <div className="my-4 flex flex-wrap gap-3">
        <button
          className="rounded bg-institucional px-4 py-2 text-white disabled:opacity-50"
          disabled={busy || !data?.configurado || data.ejecutando}
          onClick={() => void create()}
        >
          {busy ? 'Creando respaldo…' : 'Crear respaldo cifrado'}
        </button>
        <button
          className="rounded border px-4 py-2"
          disabled={busy}
          onClick={() => {
            setError('')
            setRevision((v) => v + 1)
          }}
        >
          Actualizar registro
        </button>
      </div>
      {busy && (
        <p role="status">
          La operación puede tardar hasta dos minutos. Espera antes de volver a
          intentarlo.
        </p>
      )}
      {error && (
        <p role="alert" className="text-alerta">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-salud">
          {message}
        </p>
      )}
      {data && !data.configurado && (
        <p>Falta configurar la clave de cifrado del servidor.</p>
      )}
      {!data && !error && <p role="status">Consultando respaldos…</p>}
      <p className="my-3 text-sm text-secundario">
        Últimos 50 registros. Guarda también una copia externa y conserva la
        clave de cifrado por separado.
      </p>
      {data?.datos.length === 0 && <p>Todavía no hay respaldos registrados.</p>}
      <div className="space-y-3">
        {data?.datos.map((row) => (
          <article key={row.id} className="rounded border p-4">
            <h2 className="font-semibold">
              Respaldo {row.id} ·{' '}
              {row.estado === 'VERIFICADO'
                ? 'Integridad verificada'
                : row.estado}
            </h2>
            <p>
              {new Date(row.iniciado_en).toLocaleString('es-GT', {
                timeZone: 'America/Guatemala',
              })}{' '}
              (Guatemala)
            </p>
            <p>
              {row.tamano_bytes
                ? `${Number(row.tamano_bytes).toLocaleString('es-GT')} bytes`
                : 'Tamaño no disponible'}
            </p>
            {row.detalle_error && (
              <p className="text-alerta">{row.detalle_error}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
