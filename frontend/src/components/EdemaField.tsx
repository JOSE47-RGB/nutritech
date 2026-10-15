import { useId } from 'react'

export function EdemaField({ initial = 'DESCONOCIDO', className = '', onChange }: { initial?: string; className?: string; onChange?: (value: string) => void }) {
  const id = useId()
  return <div className={`rounded-xl bg-azul-claro p-4 ${className}`}>
    <label htmlFor={id} className="block font-semibold">¿El personal de salud revisó si tiene hinchazón en ambos pies?</label>
    <p id={`${id}-help`} className="my-2 text-sm">Si no se ha revisado, elige «Todavía no».</p>
    <select id={id} name="edema" required defaultValue={initial} onChange={event => onChange?.(event.target.value)} aria-describedby={`${id}-help ${id}-note`} className="mt-2 w-full rounded-lg border border-institucional/30 bg-white p-3">
      <option value="DESCONOCIDO">Todavía no se ha revisado / no lo sé</option>
      <option value="NO">Sí, lo revisaron y NO tiene hinchazón</option>
      <option value="SI">Sí, lo revisaron y SÍ tiene hinchazón</option>
    </select>
    <p id={`${id}-note`} className="mt-2 text-sm">No saberlo no significa que tenga desnutrición.</p>
    <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">¿Por qué se pregunta esto?</summary><p className="my-2">Esta hinchazón se llama edema: es líquido acumulado en los tejidos. Puede aumentar el peso y dar una impresión equivocada sobre el crecimiento. El personal de salud debe examinar al niño y determinar la causa de la hinchazón.</p><a className="underline" href="https://www.who.int/tools/elena/interventions/oedema-sam" target="_blank" rel="noopener noreferrer">Consultar la explicación de la OMS</a></details>
  </div>
}
