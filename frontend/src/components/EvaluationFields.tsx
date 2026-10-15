import { useId } from 'react'

export function EvaluationSteps({ current, labels }: { current: number; labels: readonly string[] }) {
  return <ol className="guide-progress" aria-label="Progreso de la evaluación">{labels.map((label, index) => <li key={label} aria-current={current === index ? 'step' : undefined} className={index === current ? 'current' : index < current ? 'complete' : ''}><span aria-hidden="true">{index < current ? '✓' : index + 1}</span>{label}</li>)}</ol>
}

export function MeasurementFields({ weight, height, method, methodName = 'metodo' }: { weight?: string; height?: string; method?: string; methodName?: 'metodo' | 'tipo' }) {
  const id = useId()
  return <div className="quick-fields measurement-fields">
    <label>Peso (kg)<input name="peso" aria-label="Peso (kg)" aria-describedby={`${id}-weight`} defaultValue={weight} type="number" inputMode="decimal" min="0.3" max="100" step="0.01" placeholder="Ej. 12.5" required /><small id={`${id}-weight`} className="field-help">Escribe el peso de la báscula en kilogramos.</small></label>
    <label>Longitud/talla (cm)<input name="talla" aria-label="Longitud/talla (cm)" aria-describedby={`${id}-height`} defaultValue={height} type="number" inputMode="decimal" min="30" max="150" step="0.01" placeholder="Ej. 85" required /><small id={`${id}-height`} className="field-help">Centímetros, no metros. Ejemplo: 85 cm.</small></label>
    <label>¿Cómo se midió?<select name={methodName} required defaultValue={method || ''}><option value="" disabled>Selecciona</option><option value="LONGITUD_ACOSTADO">Acostado (longitud)</option><option value="TALLA_DE_PIE">De pie (talla)</option></select></label>
  </div>
}
