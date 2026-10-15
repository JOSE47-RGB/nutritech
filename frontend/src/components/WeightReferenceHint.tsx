import { useId } from 'react'
import { dateLabel, growthSource, today, useGrowthResource, weightLabel } from './growth-data'
import type { WeightReference } from './growth-data'
import { compareReferenceWeight, referenceAge } from './weight-reference'
import './weight-reference.css'

type Props = {
  publicMode?: boolean
  compact?: boolean
  birth: string
  measured: string
  sex?: string
  weight?: string
  edema?: string
  onSessionExpired: () => void
}

export function WeightReferenceHint({
  birth, measured, sex, weight = '', edema = 'DESCONOCIDO', onSessionExpired, compact = false, publicMode = false,
}: Props) {
  const id = useId()
  const days = referenceAge(birth, measured, today())
  const complete = Boolean(birth && measured && (sex === 'M' || sex === 'F'))
  const supported = complete && days !== null && days <= 1826
  const url = supported
    ? `/api/${publicMode ? 'publico' : 'mi-portal'}/crecimiento/referencia?${new URLSearchParams({ sexo: sex!, edad_dias: String(days) })}`
    : null
  const result = useGrowthResource<{
    edad_dias: number
    sexo: string
    referencia: WeightReference
  }>(url, onSessionExpired, 300)
  // Never reuse the previous child's reference after dates or sex change.
  const reference = result.data?.edad_dias === days && result.data.sexo === sex
    ? result.data.referencia
    : null
  const comparison = reference ? compareReferenceWeight(weight, reference) : null
  const needsReview = comparison && (comparison.position !== 'within' || edema === 'SI')

  return <section className={`weight-hint${compact ? ' weight-hint-compact' : ''}`} aria-labelledby={id}>
    <div className="weight-hint-heading">
      <span aria-hidden="true" className="weight-hint-icon">kg</span>
      <div><h4 id={id}>Peso de referencia para su edad</h4>{!compact && <p>Una guía mientras completas las medidas.</p>}</div>
    </div>
    {!complete ? <p className="weight-hint-notice">Completa nacimiento, fecha de medición y sexo para ver la referencia.</p>
      : days === null ? <p className="weight-hint-notice" role="status">Revisa las fechas: la medición debe ser posterior o igual al nacimiento y no puede estar en el futuro.</p>
      : !supported ? <p className="weight-hint-notice" role="status">La referencia por edad está disponible hasta 1826 días. No hay un valor disponible para esta edad.</p>
      : result.error ? <div className="weight-hint-notice" role="status"><p>No se pudo consultar la referencia. El peso que escribiste se conserva.</p><p>{result.error}</p><button type="button" onClick={result.retry}>Volver a consultar</button></div>
      : !reference ? <p className="weight-hint-notice" role="status">Consultando la referencia OMS para esta edad…</p>
      : compact ? <>
        <div className="weight-hint-inline"><span>Valor central <strong>{weightLabel(reference.mediana_kg)}</strong></span><span>Franja de referencia <strong>{weightLabel(reference.menos2_kg)} – {weightLabel(reference.mas2_kg)}</strong></span></div>
        <p className="weight-hint-brief">Es una guía por edad y sexo, no un peso obligatorio.</p>
        {comparison && <p className={`weight-hint-live${needsReview ? ' review' : ''}`} role="status" aria-live="polite" aria-atomic="true">{edema === 'SI' ? 'Se indicó hinchazón: el peso necesita valoración profesional.' : comparison.position === 'within' ? 'El peso ingresado está dentro de esta franja.' : `El peso ingresado está ${comparison.position === 'below' ? 'por debajo' : 'por encima'} de esta franja. Confirma las medidas y completa la evaluación.`}</p>}
        <details className="weight-hint-details"><summary>Entender esta referencia</summary><p>{days} días · {sex === 'M' ? 'Niño' : 'Niña'} · Medición del {dateLabel(measured)}. La franja va de −2 a +2 desviaciones estándar de la OMS.</p><p>Pesar menos que el valor central no significa automáticamente tener bajo peso. Esta comparación por edad no determina desnutrición, sobrepeso u obesidad: completa la talla y la revisión del personal de salud.</p><a href={growthSource} target="_blank" rel="noopener noreferrer">Consultar las referencias de la OMS</a></details>
      </> : <>
        <p className="weight-hint-context">{days} {days === 1 ? 'día' : 'días'} · {sex === 'M' ? 'Niño' : 'Niña'} · Medición del {dateLabel(measured)}</p>
        <div className="weight-hint-values">
          <div><span>Valor central de referencia</span><strong>{weightLabel(reference.mediana_kg)}</strong><small>No es un peso obligatorio ni una meta.</small></div>
          <div><span>Franja de referencia para su edad</span><strong>{weightLabel(reference.menos2_kg)} – {weightLabel(reference.mas2_kg)}</strong><small>El peso real puede diferir del valor central.</small></div>
        </div>
        {comparison ? <div className={`weight-hint-comparison${needsReview ? ' review' : ''}`} role="status" aria-live="polite" aria-atomic="true">
          <strong>Peso ingresado: {weightLabel(comparison.weight)}</strong>
          {edema === 'SI' ? <p>Se indicó hinchazón en ambos pies. El peso necesita valoración del personal de salud antes de interpretarse.</p>
            : <><p>{comparison.position === 'below' ? 'Está por debajo de la franja de referencia para esta edad. Confirma el peso y las fechas al completar la evaluación.'
              : comparison.position === 'above' ? 'Está por encima de la franja de referencia para esta edad. Confirma el peso y las fechas al completar la evaluación.'
              : 'Está dentro de la franja de referencia para esta edad.'}</p>
              {comparison.position === 'within' && comparison.belowMiddle && <p>Pesar menos que el valor central no significa automáticamente tener bajo peso.</p>}
              <small>Completa la talla y la revisión del personal de salud para interpretar el crecimiento. Esta comparación por edad no determina desnutrición, sobrepeso u obesidad.</small></>}
        </div> : <p className="weight-hint-notice">Escribe el peso real tomado con la báscula, en kilogramos. No se rellena con la referencia.</p>}
        <details className="weight-hint-details"><summary>¿Cómo se obtiene esta referencia?</summary><p>Se usan la edad exacta en la fecha de medición y el sexo. El valor central es la mediana OMS y la franja corresponde a −2 y +2 desviaciones estándar. Los valores se muestran con dos decimales; la comparación utiliza su precisión completa.</p><a href={growthSource} target="_blank" rel="noopener noreferrer">Consultar las referencias de la OMS</a></details>
      </>}
  </section>
}
