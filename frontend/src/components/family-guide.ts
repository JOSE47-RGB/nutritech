export type FamilyGuide = {
  version?: string
  estado_edema?: string
  revision_medidas?: {
    avisos: { codigo: string; titulo: string; detalle: string }[]
    explicacion: string
    comprobar: string
    si_se_confirma: string
    fuente: { titulo: string; url: string }
  } | null
  comparaciones?: { indicador: string; pregunta: string; descripcion: string; resultado: string; explicacion: string }[]
  aviso_medidas?: string | null
  peso_referencia?: string
  fuente_crecimiento?: { titulo: string; url: string }
  titulo: string
  siguiente_paso: string
  factores: string
  nota: string
  hallazgos: { indicador: string; titulo: string; sugerencia: string }[]
  pendientes: { indicador: string; mensaje: string }[]
  fuente_exceso_peso?: { titulo: string; url: string }
  fuente: { titulo: string; url: string }
}

export function familyPresentation(guide: FamilyGuide) {
  // Las copias anteriores no incluían el estado explícito. Solo reconocer sus títulos conocidos.
  const edema = guide.estado_edema ?? (guide.titulo.startsWith('Falta revisar la hinchazón') ? 'DESCONOCIDO' : guide.titulo.startsWith('Necesita valoración médica por hinchazón') ? 'SI' : undefined)
  const measurements = Boolean(guide.aviso_medidas || guide.revision_medidas)
  const legacyReview = measurements && !guide.revision_medidas && edema !== 'SI'
  return {
    edema,
    measurements,
    pending: guide.pendientes.length > 0,
    attention: measurements || guide.pendientes.length > 0 || guide.hallazgos.length > 0,
    title: legacyReview ? 'Hay medidas que necesitan confirmación' : guide.titulo,
    message: legacyReview ? 'Una medida fuera de la referencia puede ser real. Revisa las unidades y pide al personal de salud que repita la medición. Si se confirma, conserva el valor para su valoración.' : guide.siguiente_paso,
    edemaMessage: edema === 'DESCONOCIDO'
      ? 'No se ha indicado si el personal de salud revisó la hinchazón en ambos pies. Esto no significa que el niño la tenga. Esa revisión sigue pendiente antes de interpretar su peso.'
      : edema === 'SI'
        ? 'Se indicó hinchazón en ambos pies (edema). Puede aumentar el peso por acumulación de líquido. El niño necesita valoración médica; esta consulta no determina la causa.'
        : null,
  }
}

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

export function familyReportHtml(guide?: FamilyGuide) {
  if (!guide) return ''
  const status = familyPresentation(guide)
  const review = guide.revision_medidas
  return `<section class="notice"><h2>${escape(status.title)}</h2><p>${escape(status.message)}</p></section>${review ? `${review.avisos.map(issue => `<article><h3>${escape(issue.titulo)}</h3><p>${escape(issue.detalle)}</p></article>`).join('')}<p>${escape(review.explicacion)}</p><h3>Si la medida se confirma</h3><p>${escape(review.si_se_confirma)}</p><small>${escape(review.fuente.titulo)} · ${escape(review.fuente.url)}</small>` : ''}${status.edemaMessage ? `<p class="notice">${escape(status.edemaMessage)}</p>` : ''}${!status.measurements && !status.pending ? guide.comparaciones?.map(item => `<article><h3>${escape(item.pregunta)}</h3><strong>${escape(item.resultado)}</strong></article>`).join('') ?? '' : ''}<h3>¿Qué puede influir en el crecimiento?</h3><p>${escape(guide.factores)}</p><p>${escape(guide.nota)}</p>`
}
