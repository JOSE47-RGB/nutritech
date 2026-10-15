import { useEffect, useState } from 'react'
import { ApiError, readResponse } from './ninos-api'

export type GrowthChild = {
  codigo_publico: string
  codigo_expediente: string
  primer_nombre: string
  segundo_nombre: string | null
  primer_apellido: string
  segundo_apellido: string | null
  fecha_nacimiento: string
  sexo_biologico: 'M' | 'F'
}
export type WeightReference = {
  mediana_kg: number
  menos2_kg: number
  mas2_kg: number
}
export type GrowthMeasurement = {
  codigo: string
  evaluado_en: string
  fecha: string
  edad_dias: number
  peso_kg: number
  talla_cm: number
  edema: string
  aviso: string | null
  referencia: WeightReference | null
}
export type GrowthPoint = {
  periodo: string
  cantidad: number
  ultima: GrowthMeasurement
}
export type GrowthHistory = {
  nino: GrowthChild
  alcance: string
  total: number
  mediciones: GrowthMeasurement[]
  puntos: GrowthPoint[]
  fuente: { titulo: string; url: string }
  aviso_referencia: string | null
  agrupacion: string
}

export const childName = (child: GrowthChild) =>
  [
    child.primer_nombre,
    child.segundo_nombre,
    child.primer_apellido,
    child.segundo_apellido,
  ]
    .filter(Boolean)
    .join(' ')
export const weightLabel = (value: number) =>
  `${value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`
export const dateLabel = (value: string) => value.split('-').reverse().join('/')
export const timeLabel = (value: string) =>
  new Date(value).toLocaleString('es-GT', { timeZone: 'America/Guatemala' })
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
export const growthSource =
  'https://www.who.int/tools/child-growth-standards/standards/weight-for-age'

// Never expose a late response for a different child or date range.
export function useGrowthResource<T>(
  url: string | null,
  onSessionExpired: () => void,
  delay = 0,
) {
  const [revision, setRevision] = useState(0)
  const key = `${url ?? ''}|${revision}`
  const [response, setResponse] = useState<{
    key: string
    data?: T
    error?: string
  } | null>(null)
  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetch(url, { signal: controller.signal })
        .then(readResponse<T>)
        .then((data) => {
          if (!controller.signal.aborted) setResponse({ key, data })
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          if (error instanceof ApiError && error.status === 401)
            onSessionExpired()
          else
            setResponse({
              key,
              error:
                error instanceof Error
                  ? error.message
                  : 'No se pudo cargar la información. Intenta de nuevo.',
            })
        })
    }, delay)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [url, key, delay, onSessionExpired])
  const current = url && response?.key === key ? response : null
  return {
    data: current?.data,
    error: current?.error,
    loading: Boolean(url && !current),
    retry: () => setRevision((value) => value + 1),
    key,
  }
}
