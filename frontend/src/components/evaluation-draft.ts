export type EvaluationDraft = {
  peso: string
  talla: string
  tipo: string
  edema: string
  lugar: string
  observaciones: string
}

export function newEvaluationDraft(initial?: Partial<EvaluationDraft>): EvaluationDraft {
  return { peso: '', talla: '', tipo: '', edema: 'DESCONOCIDO', lugar: 'CLINICA', observaciones: '', ...initial }
}

// El formulario guarda los pasos en memoria; el envío no depende de campos ocultos/deshabilitados.
export function evaluationPayload(draft: EvaluationDraft, childCode: string, center: string, date: string) {
  const weight = Number(draft.peso)
  const height = Number(draft.talla)
  const precise = (value: number) => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
  if (!draft.peso.trim() || !precise(weight) || weight < 0.3 || weight > 100) throw Error('Revisa el peso: usa kilogramos y hasta dos decimales.')
  if (!draft.talla.trim() || !precise(height) || height < 30 || height > 150) throw Error('Revisa la longitud/talla: usa centímetros y hasta dos decimales.')
  if (!['LONGITUD_ACOSTADO', 'TALLA_DE_PIE'].includes(draft.tipo)) throw Error('Selecciona cómo se midió al niño.')
  if (!['NO', 'SI', 'DESCONOCIDO'].includes(draft.edema)) throw Error('Indica si se ha revisado la hinchazón en ambos pies.')
  if (!['CLINICA', 'VISITA_DOMICILIAR', 'JORNADA_COMUNITARIA', 'OTRO'].includes(draft.lugar)) throw Error('Selecciona el lugar de evaluación.')
  if (draft.observaciones.trim().length > 2000) throw Error('Las observaciones pueden tener hasta 2000 caracteres.')
  if (!childCode || !center || !date || !Number.isFinite(new Date(date).getTime())) throw Error('Selecciona al niño, el centro y la fecha de medición.')
  return {
    nino_codigo: childCode, centro_salud_id: center, evaluado_en: new Date(date).toISOString(),
    peso_kg: weight, talla_cm: height, tipo_medicion: draft.tipo, edema: draft.edema,
    lugar_evaluacion: draft.lugar, observaciones: draft.observaciones.trim() || undefined,
  }
}
