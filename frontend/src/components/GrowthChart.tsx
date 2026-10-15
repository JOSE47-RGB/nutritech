import { useEffect, useId, useRef, useState } from 'react'
import type { GrowthMeasurement, GrowthPoint } from './growth-data'
import { dateLabel, timeLabel, weightLabel } from './growth-data'

export function GrowthChart({
  points,
  selected,
  showReference,
  onSelect,
}: {
  points: GrowthPoint[]
  selected: GrowthMeasurement
  showReference: boolean
  onSelect: (code: string) => void
}) {
  const title = useId()
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<string | null>(null)
  useEffect(() => {
    const node = container.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(260, Math.round(entry.contentRect.width))),
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  if (!points.length) return null
  const extra = !points.some((point) => point.ultima.codigo === selected.codigo)
  const plotted = [
    ...points.map((point) => point.ultima),
    ...(extra ? [selected] : []),
  ]
  const height = 290,
    left = 44,
    right = 20,
    top = 34,
    bottom = 44
  const max =
    Math.max(
      1,
      ...plotted.flatMap((m) => [
        m.peso_kg,
        ...(showReference && m.referencia ? [m.referencia.mas2_kg] : []),
      ]),
    ) * 1.16
  const timestamps = plotted.map((m) => Date.parse(m.evaluado_en))
  const first = Math.min(...timestamps),
    last = Math.max(...timestamps)
  const x = (m: GrowthMeasurement) =>
    first === last
      ? (width + left - right) / 2
      : left +
        ((Date.parse(m.evaluado_en) - first) / (last - first)) *
          (width - left - right)
  const y = (value: number) =>
    height - bottom - (value / max) * (height - top - bottom)
  const active = plotted.find((m) => m.codigo === hover) ?? selected
  const tipWidth = Math.min(204, width - 8)
  const tipLeft = Math.max(
    4,
    Math.min(width - tipWidth - 4, x(active) - tipWidth / 2),
  )
  const tipTop =
    y(active.peso_kg) < 102 ? y(active.peso_kg) + 18 : y(active.peso_kg) - 90
  const labelIndexes: number[] = []
  points.forEach((point, index) => {
    const previous = labelIndexes.at(-1)
    if (
      previous === undefined ||
      x(point.ultima) - x(points[previous].ultima) > (width < 450 ? 90 : 105)
    )
      labelIndexes.push(index)
  })
  const periodLabel = (period: string) => {
    if (period.length === 4) return period
    const date = new Date(
      `${period.length === 7 ? `${period}-01` : period}T12:00:00Z`,
    )
    return new Intl.DateTimeFormat(
      'es-GT',
      period.length === 7
        ? { month: 'short', year: '2-digit', timeZone: 'UTC' }
        : { day: 'numeric', month: 'short', timeZone: 'UTC' },
    ).format(date)
  }
  return (
    <div className="growth-chart-stage" ref={container}>
      <svg
        className="growth-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-labelledby={title}
      >
        <title id={title}>
          Peso a lo largo del tiempo. Selecciona una medición. También puedes
          usar los botones anterior y siguiente o la tabla.
        </title>
        {[0, 1, 2, 3, 4].map((n) => {
          const value = (max * n) / 4
          return (
            <g key={n}>
              <line
                x1={left}
                x2={width - right}
                y1={y(value)}
                y2={y(value)}
                stroke="#d9e5ef"
              />
              <text
                x={left - 7}
                y={y(value) + 4}
                textAnchor="end"
                fontSize="12"
                fill="#52616d"
              >
                {value.toFixed(1)}
              </text>
            </g>
          )
        })}
        <text x="4" y="19" fontSize="12" fill="#52616d">
          kg
        </text>
        {showReference &&
          points.slice(1).map((point, i) => {
            const before = points[i].ultima,
              after = point.ultima,
              a = before.referencia,
              b = after.referencia
            return a && b ? (
              <polygon
                key={point.periodo}
                points={`${x(before)},${y(a.menos2_kg)} ${x(before)},${y(a.mas2_kg)} ${x(after)},${y(b.mas2_kg)} ${x(after)},${y(b.menos2_kg)}`}
                fill="#E8F5EF"
              />
            ) : null
          })}
        {showReference &&
          points.map((point, i) => {
            const current = point.ultima,
              r = current.referencia,
              before = points[i - 1]?.ultima
            return r ? (
              <g key={point.periodo}>
                <line
                  x1={x(current)}
                  x2={x(current)}
                  y1={y(r.menos2_kg)}
                  y2={y(r.mas2_kg)}
                  stroke="#2E8B70"
                  strokeOpacity=".5"
                  strokeWidth={points.length === 1 ? 12 : 2}
                />
                <circle
                  cx={x(current)}
                  cy={y(r.mediana_kg)}
                  r="3"
                  fill="#2E8B70"
                />
                {before?.referencia && (
                  <line
                    x1={x(before)}
                    x2={x(current)}
                    y1={y(before.referencia.mediana_kg)}
                    y2={y(r.mediana_kg)}
                    stroke="#2E8B70"
                    strokeDasharray="5 5"
                  />
                )}
              </g>
            ) : null
          })}
        {points
          .slice(1)
          .map((point, i) =>
            !point.ultima.aviso && !points[i].ultima.aviso ? (
              <line
                key={point.periodo}
                x1={x(points[i].ultima)}
                x2={x(point.ultima)}
                y1={y(points[i].ultima.peso_kg)}
                y2={y(point.ultima.peso_kg)}
                stroke="#2563A6"
                strokeWidth="2.5"
              />
            ) : null,
          )}
        <line
          x1={x(selected)}
          x2={x(selected)}
          y1={top}
          y2={height - bottom}
          stroke="#2563A6"
          strokeDasharray="3 5"
          strokeOpacity=".35"
        />
        {plotted.map((m) => (
          <g key={m.codigo}>
            <circle
              cx={x(m)}
              cy={y(m.peso_kg)}
              r={selected.codigo === m.codigo ? 11 : 7}
              fill={m.aviso ? '#E89532' : '#2563A6'}
              stroke="white"
              strokeWidth="3"
            />
            {m.aviso && (
              <text
                x={x(m)}
                y={y(m.peso_kg) + 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="#603900"
                pointerEvents="none"
              >
                !
              </text>
            )}
            <circle
              className="growth-hit-point"
              cx={x(m)}
              cy={y(m.peso_kg)}
              r="22"
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-pressed={selected.codigo === m.codigo}
              aria-label={`${timeLabel(m.evaluado_en)}: ${weightLabel(m.peso_kg)}${m.aviso ? '; requiere revisión' : ''}`}
              onMouseEnter={() => setHover(m.codigo)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(m.codigo)}
              onBlur={() => setHover(null)}
              onClick={() => {
                onSelect(m.codigo)
                setHover(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(m.codigo)
                }
              }}
            >
              <title>
                {timeLabel(m.evaluado_en)} · {weightLabel(m.peso_kg)}
              </title>
            </circle>
          </g>
        ))}
        {labelIndexes.map((i) => (
          <text
            key={points[i].periodo}
            x={x(points[i].ultima)}
            y={height - bottom + 28}
            textAnchor={
              points.length === 1
                ? 'middle'
                : i === 0
                  ? 'start'
                  : i === points.length - 1
                    ? 'end'
                    : 'middle'
            }
            fontSize="12"
            fill="#52616d"
          >
            {periodLabel(points[i].periodo)}
          </text>
        ))}
      </svg>
      <div
        className={`growth-tooltip${active.aviso ? ' has-warning' : ''}`}
        style={{ width: tipWidth, left: tipLeft, top: tipTop }}
        aria-hidden="true"
      >
        <span>{dateLabel(active.fecha)}</span>
        <strong>{weightLabel(active.peso_kg)}</strong>
        <small>
          {active.aviso
            ? 'Dato por revisar'
            : hover
              ? 'Selecciona para ver el detalle'
              : 'Medición seleccionada'}
        </small>
      </div>
    </div>
  )
}
