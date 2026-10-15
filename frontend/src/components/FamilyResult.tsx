import { familyPresentation, type FamilyGuide } from './family-guide'
export type { FamilyGuide } from './family-guide'

export function FamilyResult({ guide, onCorrect }: { guide?: FamilyGuide; onCorrect?: () => void }) {
  if (!guide) return <p className="portal-info">Preparando la explicación del resultado. Si es un resultado anterior, vuelve a calcular.</p>
  const { attention, measurements, pending, title, message, edema, edemaMessage } = familyPresentation(guide)
  const review = guide.revision_medidas
  const comparisons = guide.comparaciones?.filter(item => !item.resultado.includes('Todavía no')) ?? []
  return <section className="family-summary" aria-label="Resultado y alertas">
    <div className={`family-alert ${attention ? 'attention' : 'clear'}`} role="status">
      <span className="family-alert-icon" aria-hidden="true">{attention ? '!' : '✓'}</span>
      <div className="family-alert-content">
        <p className="family-label">{attention ? 'Alerta de esta evaluación' : 'Resultado de esta evaluación'}</p>
        <h3>{title}</h3>
        {review && <p>{review.avisos[0]?.detalle}</p>}
        <h4 className="mt-4 font-semibold">¿Qué hacemos ahora?</h4><p>{message}</p>
        {review && <div className="family-confirmed"><h4>¿La medida se repitió y es correcta?</h4><p>{review.si_se_confirma}</p></div>}
        {onCorrect && <button type="button" className="portal-primary" onClick={onCorrect}>Revisar los datos ingresados</button>}
      </div>
    </div>
    {review && <div className="family-measurement-context">
      <p><strong>Cada niño puede tener un tamaño diferente.</strong> {review.explicacion}</p>
      {review.avisos.length > 1 && <details className="family-more"><summary>Ver otras comprobaciones ({review.avisos.length - 1})</summary>{review.avisos.slice(1).map(issue => <div key={issue.codigo}><h4 className="mt-3 font-semibold">{issue.titulo}</h4><p>{issue.detalle}</p></div>)}</details>}
    </div>}
    {!pending && !measurements && comparisons.length > 0 && <div className="family-comparisons">{comparisons.map(item => <article key={item.indicador}><h4>{item.pregunta}</h4><strong>{item.resultado}</strong><p className="mt-2 text-sm">{item.descripcion}</p></article>)}</div>}
    {edemaMessage && <div className="my-4 rounded-xl bg-azul-claro p-4"><h4 className="font-semibold">{edema === 'SI' ? 'Hinchazón indicada en esta consulta' : 'Revisión pendiente: hinchazón en ambos pies'}</h4><p className="mt-2">{edemaMessage}</p></div>}
    <p className="family-caption">Orientación de apoyo. La decisión médica corresponde al profesional de salud.</p>
    <details className="family-more"><summary>Entender el resultado y sus posibles causas</summary><p>{guide.factores}</p><p>{guide.peso_referencia}</p>{guide.hallazgos.map(h => <p key={h.indicador}><strong>{h.titulo}:</strong> {h.sugerencia}</p>)}<p>{guide.nota}</p><a href={guide.fuente.url} target="_blank" rel="noopener noreferrer">OMS: información sobre nutrición</a>{guide.fuente_crecimiento && <a href={guide.fuente_crecimiento.url} target="_blank" rel="noopener noreferrer">OMS: referencias de crecimiento</a>}{review && <a href={review.fuente.url} target="_blank" rel="noopener noreferrer">OMS: cómo comprobar medidas extremas</a>}</details>
  </section>
}
