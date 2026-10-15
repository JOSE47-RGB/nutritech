import { useRef, useState } from 'react'
import { ValidatedForm } from './ValidatedForm'
import { TaskIcon } from './TaskIcon'
import { GrowthChart } from './GrowthChart'
import {
  childName,
  dateLabel,
  growthSource,
  timeLabel,
  today,
  useGrowthResource,
  weightLabel,
} from './growth-data'
import type { GrowthChild, GrowthHistory, WeightReference } from './growth-data'
import './growth.css'

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="growth-empty" role="alert">
      <TaskIcon name="alert" />
      <div>
        <strong>No pudimos cargar esta información</strong>
        <p>{message}</p>
        <button type="button" className="consult-secondary" onClick={retry}>
          Volver a intentar
        </button>
      </div>
    </div>
  )
}
function Loading({ children }: { children: string }) {
  return (
    <p className="growth-loading" role="status">
      <span className="growth-spinner" aria-hidden="true" />
      {children}
    </p>
  )
}
function ReferenceCards({
  reference,
  days,
}: {
  reference: WeightReference
  days: number
}) {
  return (
    <div className="growth-reference">
      <article>
        <span>Punto central de la referencia</span>
        <strong>{weightLabel(reference.mediana_kg)}</strong>
        <small>
          Para esta edad: {days} {days === 1 ? 'día' : 'días'}.
        </small>
      </article>
      <article>
        <span>Franja de comparación OMS</span>
        <strong>
          {weightLabel(reference.menos2_kg)} <span>a</span>{' '}
          {weightLabel(reference.mas2_kg)}
        </strong>
        <small>Sirve para comparar los registros.</small>
      </article>
      <p>
        No es un peso que el niño deba alcanzar. Su talla y la evaluación del
        personal de salud completan la valoración.
      </p>
      <details>
        <summary>¿Cómo se obtiene esta referencia?</summary>
        <p>
          Se usa la edad exacta y el sexo registrado. El punto central es la
          mediana; la franja va de −2 a +2 desviaciones estándar de la
          referencia OMS de peso para la edad. Estar dentro de esta franja no
          confirma por sí solo un estado nutricional normal.
        </p>
        <a href={growthSource} target="_blank" rel="noopener noreferrer">
          Consultar la referencia OMS
        </a>
      </details>
    </div>
  )
}
function ReferenceLookup({
  base,
  onSessionExpired,
}: {
  base: string
  onSessionExpired: () => void
}) {
  const [birth, setBirth] = useState('')
  const [date, setDate] = useState(today)
  const [sex, setSex] = useState('')
  const days = (Date.parse(date) - Date.parse(birth)) / 86400000
  const invalid = Boolean(
    birth &&
    date &&
    (!Number.isInteger(days) || days < 0 || days > 1826 || date > today()),
  )
  const url =
    birth && date && sex && !invalid
      ? `${base}/referencia?${new URLSearchParams({ edad_dias: String(days), sexo: sex })}`
      : null
  const result = useGrowthResource<{
    referencia: WeightReference
    edad_dias: number
  }>(url, onSessionExpired, 350)
  return (
    <section className="growth-lookup">
      <h2>Compara según la edad</h2>
      <p className="growth-muted">
        Completa estos tres datos. La referencia aparece automáticamente, sin
        guardar un expediente.
      </p>
      <div className="growth-fields">
        <label>
          Fecha de nacimiento
          <input
            type="date"
            name="birth"
            value={birth}
            max={date || today()}
            onInput={(event) => setBirth(event.currentTarget.value)}
            onChange={(event) => setBirth(event.target.value)}
          />
        </label>
        <label>
          Fecha de consulta
          <input
            type="date"
            name="date"
            value={date}
            min={birth}
            max={today()}
            onInput={(event) => setDate(event.currentTarget.value)}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Sexo registrado
          <select value={sex} onChange={(event) => setSex(event.target.value)}>
            <option value="">Selecciona</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
          </select>
        </label>
      </div>
      {invalid ? (
        <p className="growth-warning" role="alert">
          Revisa las fechas: la consulta debe ser desde el nacimiento hasta 1826
          días de edad, sin fechas futuras.
        </p>
      ) : result.error ? (
        <LoadError message={result.error} retry={result.retry} />
      ) : result.loading ? (
        <Loading>Buscando la referencia para esta edad…</Loading>
      ) : result.data ? (
        <div className="growth-reveal">
          <p className="growth-result-label" role="status">
            Referencia para {sex === 'M' ? 'niño' : 'niña'} de{' '}
            {result.data.edad_dias} días
          </p>
          <ReferenceCards
            reference={result.data.referencia}
            days={result.data.edad_dias}
          />
        </div>
      ) : (
        <div className="growth-empty">
          <TaskIcon name="measure" />
          <div>
            <strong>Aquí aparecerá la referencia</strong>
            <p>Elige las fechas y el sexo para consultar.</p>
          </div>
        </div>
      )}
    </section>
  )
}

function HistoryResult({
  data,
  onDaily,
  onClearDates,
  filtered,
}: {
  data: GrowthHistory
  onDaily: () => void
  onClearDates: () => void
  filtered: boolean
}) {
  const [selected, setSelected] = useState(
    data.puntos.at(-1)?.ultima.codigo ?? '',
  )
  const [page, setPage] = useState(0)
  const [showReference, setShowReference] = useState(true)
  const detail = useRef<HTMLElement>(null)
  const records = useRef<HTMLDetailsElement>(null)
  const selectedIndex = data.mediciones.findIndex((m) => m.codigo === selected)
  const point = data.mediciones[selectedIndex]
  const chunk = [...data.mediciones].reverse().slice(page * 15, (page + 1) * 15)
  const countName =
    data.agrupacion === 'dia'
      ? 'día'
      : data.agrupacion === 'mes'
        ? 'mes'
        : 'año'
  const warnings = data.mediciones.filter((m) => m.aviso)
  const grouped = data.puntos.find((p) => p.ultima.codigo === selected)
  if (!data.total || !point)
    return (
      <div className="growth-empty">
        <TaskIcon name="history" />
        <div>
          <strong>
            {filtered
              ? 'No hay mediciones en estas fechas'
              : 'Su historia de crecimiento empieza con una medición'}
          </strong>
          <p>
            {filtered
              ? 'Elige otras fechas o consulta todo el historial.'
              : 'Las evaluaciones guardadas aparecerán aquí. Las consultas sin registro no crean historial.'}
          </p>
          {filtered && (
            <button className="consult-secondary" onClick={onClearDates}>
              Ver todo el historial
            </button>
          )}
        </div>
      </div>
    )
  function openRecords() {
    if (records.current) {
      records.current.open = true
      records.current.scrollIntoView({ block: 'nearest' })
      records.current.querySelector('summary')?.focus()
    }
  }
  return (
    <div className="growth-reveal">
      <div className="growth-summary" aria-label="Resumen del período">
        <div>
          <TaskIcon name="history" />
          <span>
            <strong>{data.total}</strong>{' '}
            {data.total === 1 ? 'medición guardada' : 'mediciones guardadas'}
          </span>
        </div>
        <div>
          <TaskIcon name="measure" />
          <span>
            <strong>{data.puntos.length}</strong>{' '}
            {data.puntos.length === 1
              ? 'punto en la gráfica'
              : 'puntos en la gráfica'}
          </span>
        </div>
        {warnings.length > 0 && (
          <button
            className="growth-warning-count"
            onClick={() => setSelected(warnings.at(-1)!.codigo)}
          >
            <TaskIcon name="alert" />
            <span>
              <strong>{warnings.length}</strong>{' '}
              {warnings.length === 1 ? 'dato por revisar' : 'datos por revisar'}{' '}
              <span aria-hidden="true">→</span>
            </span>
          </button>
        )}
      </div>
      {data.aviso_referencia && (
        <p role="alert" className="growth-warning">
          {data.aviso_referencia} Puedes consultar las medidas guardadas.
        </p>
      )}
      {data.total > data.puntos.length && (
        <div className="growth-group-hint">
          <TaskIcon name="help" />
          <p>
            Hay {data.total} mediciones, pero se muestra la última de cada{' '}
            {countName}.{' '}
            {data.puntos.length === 1 && 'Por eso ves un solo punto.'}
          </p>
          <button
            className="growth-link"
            onClick={data.agrupacion !== 'dia' ? onDaily : openRecords}
          >
            {data.agrupacion !== 'dia' ? 'Ver por día' : 'Ver cada medición'}
          </button>
        </div>
      )}
      {data.total === 1 && (
        <p className="growth-group-hint">
          Este es su primer registro en el período. Al guardar otra medición
          podrás ver cómo cambia su peso.
        </p>
      )}
      <div className="growth-explorer">
        <section className="growth-chart-card" aria-label="Gráfica de peso">
          <div className="growth-chart-heading">
            <div>
              <h2>Su peso en el tiempo</h2>
              <p>Toca un punto para ver esa visita.</p>
            </div>
            <label className="growth-toggle">
              <input
                type="checkbox"
                checked={showReference}
                onChange={(event) => setShowReference(event.target.checked)}
              />
              Ver referencia OMS
            </label>
          </div>
          <div className="growth-legend">
            <span>
              <i className="blue" />
              Peso guardado
            </span>
            {warnings.length > 0 && (
              <span>
                <i className="orange">!</i>Dato por revisar
              </span>
            )}
            {showReference && (
              <span>
                <i className="green" />
                Referencia por edad
              </span>
            )}
          </div>
          <GrowthChart
            points={data.puntos}
            selected={point}
            showReference={showReference}
            onSelect={setSelected}
          />
          <details className="growth-chart-help">
            <summary>¿Cómo leo esta gráfica?</summary>
            <p>
              De izquierda a derecha avanzan las fechas; de abajo hacia arriba
              aumenta el peso. Se muestra la última medición de cada {countName}
              . Las líneas solo unen registros, no son mediciones de los días
              intermedios.
            </p>
            <p>
              Un punto naranja pide revisar el dato antes de interpretarlo; no
              significa un diagnóstico. La franja verde es una comparación por
              edad y sexo, no una meta de peso.
            </p>
            <p>
              No se unen los puntos que requieren revisión. La tabla conserva
              cada medición individual.
            </p>
          </details>
        </section>
        <section
          className="growth-detail"
          ref={detail}
          tabIndex={-1}
          aria-label="Detalle de la medición"
        >
          <p className="growth-result-label">La visita seleccionada</p>
          <div className="growth-visit-nav">
            <button
              aria-label="Medición anterior"
              disabled={selectedIndex <= 0}
              onClick={() =>
                setSelected(data.mediciones[selectedIndex - 1].codigo)
              }
            >
              ←
            </button>
            <label>
              <span className="growth-sr-only">Elegir una medición</span>
              <select
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                {data.mediciones.map((m, i) => (
                  <option key={m.codigo} value={m.codigo}>
                    {i + 1}. {timeLabel(m.evaluado_en)}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label="Medición siguiente"
              disabled={selectedIndex >= data.mediciones.length - 1}
              onClick={() =>
                setSelected(data.mediciones[selectedIndex + 1].codigo)
              }
            >
              →
            </button>
          </div>
          <div
            className="growth-visit-result"
            aria-live="polite"
            aria-atomic="true"
          >
            <h3>{dateLabel(point.fecha)}</h3>
            <p className="growth-age">
              {point.edad_dias} días de edad · Medición {selectedIndex + 1} de{' '}
              {data.total}
            </p>
            <div className="growth-vitals">
              <div>
                <span>Peso guardado</span>
                <strong>{weightLabel(point.peso_kg)}</strong>
              </div>
              <div>
                <span>Longitud / talla</span>
                <strong>{point.talla_cm.toLocaleString('es-GT')} cm</strong>
              </div>
            </div>
            {point.aviso ? (
              <div className="growth-warning">
                <div className="growth-callout-title">
                  <TaskIcon name="alert" />
                  <strong>Antes de interpretar este peso</strong>
                </div>
                <p>{point.aviso}</p>
                <small>
                  El registro se conserva tal como se guardó. Pide al personal
                  de salud que lo revise.
                </small>
              </div>
            ) : (
              <p className="growth-visit-note">
                <TaskIcon name="help" />
                <span>
                  Esta gráfica permite seguir sus medidas. Consulta la
                  evaluación nutricional para conocer su resultado.
                </span>
              </p>
            )}
          </div>
          {grouped && grouped.cantidad > 1 && (
            <p className="growth-muted growth-group-detail">
              Es la última de {grouped.cantidad} mediciones en este {countName}.
            </p>
          )}
          {!grouped && (
            <p className="growth-muted growth-group-detail">
              Mostrando una medición individual del historial; los demás puntos
              conservan la agrupación elegida.
            </p>
          )}
        </section>
      </div>
      {point.referencia && (
        <details className="growth-reference-panel">
          <summary>
            <TaskIcon name="measure" />
            <span>
              Comparar con la referencia de su edad{' '}
              <small>
                {point.edad_dias} días ·{' '}
                {data.nino.sexo_biologico === 'M' ? 'Niño' : 'Niña'}
              </small>
            </span>
            <span className="growth-chevron" aria-hidden="true">
              ⌄
            </span>
          </summary>
          {point.aviso && (
            <p className="growth-warning">
              Esta referencia no resuelve el aviso de la medición. Hace falta
              revisarla antes de comparar.
            </p>
          )}
          <ReferenceCards reference={point.referencia} days={point.edad_dias} />
        </details>
      )}
      <details className="growth-records" ref={records}>
        <summary>Ver las {data.total} mediciones en una tabla</summary>
        <div
          className="growth-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Tabla de mediciones, desplazable horizontalmente"
        >
          <table>
            <caption>
              Mediciones individuales · Hora de Guatemala. Selecciona una fecha
              para ver su detalle.
            </caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Edad</th>
                <th scope="col">Peso</th>
                <th scope="col">Talla</th>
                <th scope="col">Revisión</th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((m) => (
                <tr
                  key={m.codigo}
                  className={m.codigo === selected ? 'is-selected' : ''}
                >
                  <td>
                    <button
                      type="button"
                      className="growth-link"
                      aria-pressed={m.codigo === selected}
                      onClick={() => {
                        setSelected(m.codigo)
                        detail.current?.focus()
                        detail.current?.scrollIntoView({ block: 'nearest' })
                      }}
                    >
                      {timeLabel(m.evaluado_en)}
                    </button>
                  </td>
                  <td>{m.edad_dias} días</td>
                  <td>{weightLabel(m.peso_kg)}</td>
                  <td>{m.talla_cm} cm</td>
                  <td>
                    {m.aviso ? (
                      <span className="growth-table-warning">{m.aviso}</span>
                    ) : (
                      'Ver evaluación nutricional'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.total > 15 && (
          <div className="growth-paging">
            <button disabled={!page} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <span>
              Página {page + 1} de {Math.ceil(data.total / 15)}
            </span>
            <button
              disabled={(page + 1) * 15 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </button>
          </div>
        )}
      </details>
    </div>
  )
}

function ChildGrowth({
  child,
  base,
  onSessionExpired,
  onBack,
}: {
  child: GrowthChild
  base: string
  onSessionExpired: () => void
  onBack: () => void
}) {
  const [group, setGroup] = useState('dia')
  const [range, setRange] = useState({ desde: '', hasta: '' })
  const [draft, setDraft] = useState(range)
  const query = new URLSearchParams({
    agrupar: group,
    ...Object.fromEntries(Object.entries(range).filter(([, value]) => value)),
  })
  const result = useGrowthResource<GrowthHistory>(
    `${base}/ninos/${child.codigo_publico}?${query}`,
    onSessionExpired,
  )
  const filtered = Boolean(range.desde || range.hasta)
  const yearStart = `${today().slice(0, 4)}-01-01`
  function setDates(value: typeof range) {
    setRange(value)
    setDraft(value)
  }
  return (
    <>
      <div className="growth-child">
        <span className="growth-avatar" aria-hidden="true">
          {child.primer_nombre[0]}
          {child.primer_apellido[0]}
        </span>
        <div>
          <p className="growth-result-label">Estás viendo a</p>
          <h2>{childName(child)}</h2>
          <p>
            Nació el {dateLabel(child.fecha_nacimiento)} ·{' '}
            {child.sexo_biologico === 'M' ? 'Niño' : 'Niña'}
          </p>
          <details>
            <summary>Ver número de expediente</summary>
            <p>{child.codigo_expediente}</p>
          </details>
        </div>
        <button className="consult-secondary" onClick={onBack}>
          Cambiar de niño
        </button>
      </div>
      <div className="growth-controls">
        <div>
          <span className="growth-control-label">Organizar la gráfica por</span>
          <div
            className="growth-segment"
            role="group"
            aria-label="Agrupar mediciones"
          >
            {[
              ['dia', 'Día'],
              ['mes', 'Mes'],
              ['ano', 'Año'],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={group === value}
                onClick={() => setGroup(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="growth-control-label">Mostrar registros de</span>
          <div
            className="growth-range"
            role="group"
            aria-label="Período del historial"
          >
            <button
              aria-pressed={!filtered}
              onClick={() => setDates({ desde: '', hasta: '' })}
            >
              Todo el historial
            </button>
            <button
              aria-pressed={
                range.desde === yearStart && range.hasta === today()
              }
              onClick={() => setDates({ desde: yearStart, hasta: today() })}
            >
              Este año
            </button>
          </div>
        </div>
      </div>
      <details className="growth-date-filter">
        <summary>
          Elegir otras fechas{' '}
          {filtered && (
            <span>
              · {range.desde ? dateLabel(range.desde) : 'Inicio'} al{' '}
              {range.hasta ? dateLabel(range.hasta) : 'último registro'}
            </span>
          )}
        </summary>
        <ValidatedForm
          onSubmit={(event) => {
            event.preventDefault()
            const values = new FormData(event.currentTarget)
            setDates({
              desde: String(values.get('desde') ?? ''),
              hasta: String(values.get('hasta') ?? ''),
            })
          }}
        >
          <fieldset className="growth-fields growth-date-fields">
            <legend className="growth-sr-only">Filtrar por fechas</legend>
            <label>
              Desde
              <input
                name="desde"
                type="date"
                value={draft.desde}
                max={draft.hasta || today()}
                onInput={(event) => {
                  const value = event.currentTarget.value
                  setDraft((previous) => ({ ...previous, desde: value }))
                }}
                onChange={(event) =>
                  setDraft({ ...draft, desde: event.target.value })
                }
              />
            </label>
            <label>
              Hasta
              <input
                name="hasta"
                type="date"
                value={draft.hasta}
                min={draft.desde}
                max={today()}
                onInput={(event) => {
                  const value = event.currentTarget.value
                  setDraft((previous) => ({ ...previous, hasta: value }))
                }}
                onChange={(event) =>
                  setDraft({ ...draft, hasta: event.target.value })
                }
              />
            </label>
            <button className="portal-primary">Aplicar fechas</button>
          </fieldset>
        </ValidatedForm>
      </details>
      {result.error ? (
        <LoadError message={result.error} retry={result.retry} />
      ) : !result.data ? (
        <Loading>Cargando sus mediciones…</Loading>
      ) : (
        <HistoryResult
          key={result.key}
          data={result.data}
          filtered={filtered}
          onDaily={() => setGroup('dia')}
          onClearDates={() => setDates({ desde: '', hasta: '' })}
        />
      )}
    </>
  )
}

export function Growth({
  onSessionExpired,
  admin = false,
  canHistory = true,
  embedded = false,
}: {
  onSessionExpired: () => void
  admin?: boolean
  canHistory?: boolean
  embedded?: boolean
}) {
  const [mode, setMode] = useState<'history' | 'reference'>(
    canHistory ? 'history' : 'reference',
  )
  const [child, setChild] = useState<GrowthChild | null>(null)
  const [search, setSearch] = useState('')
  const base = admin ? '/api/crecimiento' : '/api/mi-portal/crecimiento'
  const result = useGrowthResource<GrowthChild[]>(
    canHistory && mode === 'history' && !child
      ? `${base}/ninos?${new URLSearchParams({ busqueda: search.trim() })}`
      : null,
    onSessionExpired,
    300,
  )
  return (
    <section className="growth-module">
      {!embedded && (
        <>
          <p className="portal-eyebrow">Cada visita cuenta</p>
          <h1>Acompaña su crecimiento</h1>
          <p className="growth-muted">
            Explora sus medidas y descubre qué datos necesitan atención.
          </p>
          <div
            className="growth-tabs"
            role="group"
            aria-label="Tipo de consulta"
          >
            {canHistory && (
              <button
                aria-pressed={mode === 'history'}
                onClick={() => setMode('history')}
              >
                <TaskIcon name="history" />
                <span>
                  <strong>Seguimiento de un niño</strong>
                  <small>Sus visitas y su gráfica</small>
                </span>
              </button>
            )}
            <button
              aria-pressed={mode === 'reference'}
              onClick={() => setMode('reference')}
            >
              <TaskIcon name="measure" />
              <span>
                <strong>Consultar por edad</strong>
                <small>Referencia OMS sin registro</small>
              </span>
            </button>
          </div>
        </>
      )}
      {mode === 'reference' ? (
        <ReferenceLookup base={base} onSessionExpired={onSessionExpired} />
      ) : (
        <>
          <ol className="growth-steps" aria-label="Pasos del seguimiento">
            <li aria-current={!child ? 'step' : undefined}>
              <span aria-hidden="true">{child ? '✓' : '1'}</span>Elige al niño
            </li>
            <li aria-current={child ? 'step' : undefined}>
              <span aria-hidden="true">2</span>Explora sus visitas
            </li>
          </ol>
          {child ? (
            <ChildGrowth
              key={child.codigo_publico}
              child={child}
              base={base}
              onBack={() => setChild(null)}
              onSessionExpired={onSessionExpired}
            />
          ) : (
            <>
              <h2>¿De quién vamos a ver el crecimiento?</h2>
              <p className="growth-muted">
                {admin
                  ? 'Selecciona un expediente para consultar sus mediciones.'
                  : 'Aquí están los niños que registraste o evaluaste. Verás las mediciones guardadas por tu cuenta.'}
              </p>
              <div className="growth-search">
                <label>
                  Buscar por nombre, apellido o expediente
                  <input
                    type="search"
                    value={search}
                    maxLength={80}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Escribe para buscar…"
                  />
                </label>
                {search && (
                  <button
                    className="consult-secondary"
                    onClick={() => setSearch('')}
                  >
                    Limpiar búsqueda
                  </button>
                )}
              </div>
              {result.error ? (
                <LoadError message={result.error} retry={result.retry} />
              ) : result.loading ? (
                <Loading>Buscando expedientes…</Loading>
              ) : (
                <>
                  <p className="growth-search-count" role="status">
                    {result.data?.length === 20
                      ? 'Se muestran hasta 20 niños. Escribe su nombre para acotar.'
                      : `${result.data?.length ?? 0} ${(result.data?.length ?? 0) === 1 ? 'niño disponible' : 'niños disponibles'}`}
                  </p>
                  <div className="growth-children">
                    {result.data?.map((row) => (
                      <button
                        key={row.codigo_publico}
                        onClick={() => setChild(row)}
                      >
                        <span className="growth-avatar" aria-hidden="true">
                          {row.primer_nombre[0]}
                          {row.primer_apellido[0]}
                        </span>
                        <span className="growth-child-card-text">
                          <strong>{childName(row)}</strong>
                          <span>
                            Nació el {dateLabel(row.fecha_nacimiento)}
                          </span>
                          <small>{row.codigo_expediente}</small>
                          <span className="growth-card-action">
                            Ver sus visitas <span aria-hidden="true">→</span>
                          </span>
                        </span>
                      </button>
                    ))}
                    {!result.data?.length && (
                      <div className="growth-empty">
                        <TaskIcon name="child" />
                        <div>
                          <strong>
                            {search
                              ? 'No encontramos a ese niño'
                              : 'Aún no hay expedientes para mostrar'}
                          </strong>
                          <p>
                            {search
                              ? 'Prueba con su primer nombre, primer apellido o número de expediente.'
                              : 'Al registrar al niño y guardar una evaluación podrás seguir aquí su crecimiento.'}
                          </p>
                          {search && (
                            <button
                              className="consult-secondary"
                              onClick={() => setSearch('')}
                            >
                              Mostrar todos
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
      <p className="growth-footnote">
        Para valorar su nutrición también hacen falta la talla y la evaluación
        del personal de salud. El peso para la edad por sí solo no diagnostica
        sobrepeso u obesidad.{' '}
        <a href={growthSource} target="_blank" rel="noopener noreferrer">
          Fuente: OMS
        </a>
      </p>
    </section>
  )
}
