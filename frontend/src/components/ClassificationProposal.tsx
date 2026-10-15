import { useEffect, useState } from "react";
import { ApiError, readResponse } from "./ninos-api";
type Rule = {
  codigo: string;
  indicador: string;
  etiqueta: string;
  z_min: number | null;
  z_max: number | null;
  incluye_min: boolean;
  incluye_max: boolean;
};
type Proposal = {
  protocolo: { consolidacion: { version: string; rol_sistema: string; fuentes: { id: string; titulo: string; url: string; alcance: string }[]; decisiones: { tema: string; acuerdo: string; estado: string }[]; limitaciones: string[] }; casos: { codigo: string; caso: string; comportamiento: string; pendiente: string }[] };
  version: string;
  estado: string;
  fuentes: { titulo: string; url: string }[];
  pendientes: string[];
  reglas: Rule[];
  revision_tecnica: { reglas: number; indicadores: number; huecos: number; solapamientos: number };
};
const names: Record<string, string> = {
  P_E: "Peso para la edad",
  T_E: "Longitud/talla para la edad",
  P_T: "Peso para longitud/talla",
  IMC_E: "IMC para la edad",
};
function interval(row: Rule) {
  return [
    row.z_min === null ? null : `${row.z_min} ${row.incluye_min ? "≤" : "<"}`,
    "z",
    row.z_max === null ? null : `${row.incluye_max ? "≤" : "<"} ${row.z_max}`,
  ]
    .filter(Boolean)
    .join(" ");
}
export function ClassificationProposal({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Proposal | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!attempt) return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetch("/api/patrones/propuesta-clasificacion", {
      signal: controller.signal,
      credentials: "same-origin",
    })
      .then(readResponse<Proposal>)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) onSessionExpired();
        else
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudo consultar la propuesta. Vuelve a intentar.",
          );
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt, onSessionExpired]);
  return (
    <section
      className="mt-5 rounded-xl border border-institucional/20 p-4"
      aria-labelledby="classification-proposal-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="classification-proposal-title"
          className="text-lg font-semibold"
        >
          Propuesta de reglas de clasificación
        </h2>
        <span className="rounded bg-fondo px-3 py-1 text-sm">
          Borrador · Sin activar
        </span>
      </div>
      <p className="mt-2 text-sm text-secundario">
        Revisa los intervalos propuestos para menores de 5 años, dentro de la
        cobertura del patrón OMS-2006. El cálculo provisional muestra orientación basada en estos intervalos;
        las reglas permanecen inactivas en el catálogo. Consultar la propuesta no guarda datos. Al guardar una orientación desde una evaluación se conserva una copia y se generan los avisos de seguimiento correspondientes.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setLoading(true);
          setError("");
          setData(null);
          setAttempt((old) => old + 1);
        }}
        className="mt-3 rounded-lg border border-institucional px-3 py-2 font-semibold text-institucional disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-institucional"
      >
        {loading
          ? "Cargando propuesta…"
          : data
            ? "Actualizar propuesta"
            : "Revisar propuesta"}
      </button>
      {loading && (
        <p role="status" className="mt-3 text-sm">
          Consultando las reglas propuestas…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 border-l-4 border-alerta bg-fondo p-3">
          {error}
        </p>
      )}
      {data && (
        <div className="mt-4">
          <p className="text-sm text-secundario">
            Versión: {data.version} · {data.reglas.length} reglas · {data.revision_tecnica.huecos} huecos · {data.revision_tecnica.solapamientos} solapamientos
          </p>
          <p className="mt-3 rounded-lg bg-azul-claro p-3 text-sm">
            Los símbolos ≤ incluyen el límite; los símbolos &lt; lo excluyen.
            Por ejemplo, −3 pertenece a la categoría no severa y +3 todavía
            pertenece a sobrepeso en P_T e IMC_E.
          </p>
          <div className="mt-4 space-y-3">
            {Object.entries(names).map(([key, name]) => (
              <details
                key={key}
                className="rounded-lg border border-institucional/15 p-3"
              >
                <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-institucional">
                  {name} ({key})
                </summary>
                <div
                  className="mt-3 overflow-x-auto"
                  tabIndex={0}
                  role="region"
                  aria-label={`Reglas propuestas de ${name}`}
                >
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Intervalos del borrador para {name}
                    </caption>
                    <thead className="bg-fondo">
                      <tr>
                        <th scope="col" className="p-3">
                          Intervalo
                        </th>
                        <th scope="col" className="p-3">
                          Etiqueta propuesta
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-institucional/10">
                      {data.reglas
                        .filter((r) => r.indicador === key)
                        .map((row) => (
                          <tr key={row.codigo}>
                            <td className="whitespace-nowrap p-3 font-medium">
                              {interval(row)}
                            </td>
                            <td className="p-3">{row.etiqueta}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {key === "P_E" && (
                  <p className="mt-3 text-sm text-secundario">
                    P_E no clasifica sobrepeso ni obesidad.
                  </p>
                )}
                {key === "T_E" && (
                  <p className="mt-3 text-sm text-secundario">
                    La talla baja puede coexistir con exceso de peso. Este
                    indicador no resume todo el estado nutricional.
                  </p>
                )}
              </details>
            ))}
          </div>
          <h3 className="mt-5 font-semibold">Consolidación OMS y MSPAS Guatemala</h3>
          <p className="mt-2 text-sm">{data.protocolo.consolidacion.rol_sistema} La decisión final corresponde al médico.</p>
          <p className="mt-1 text-xs text-secundario">{data.protocolo.consolidacion.version} · Consolidación documental</p>
          <div className="mt-3 space-y-2">{data.protocolo.consolidacion.decisiones.map(item => <details key={item.tema} className="rounded-lg border border-institucional/15 p-3"><summary className="cursor-pointer font-semibold">{item.tema}</summary><p className="mt-2 text-sm">{item.acuerdo}</p></details>)}</div>
          <ul className="mt-3 space-y-2 text-sm">{data.protocolo.consolidacion.fuentes.map(source => <li key={source.id}><a className="text-institucional underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.titulo}</a><p>{source.alcance}</p></li>)}</ul>
          <p className="mt-3 font-semibold">Alcance pendiente de implementar</p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{data.protocolo.consolidacion.limitaciones.map(item => <li key={item}>{item}</li>)}</ul>
          <h3 className="mt-5 font-semibold">Revisión de casos especiales</h3>
          <p className="mt-2 text-sm text-secundario">Comportamiento técnico documentado. Base documental OMS y MSPAS Guatemala. El médico toma la decisión clínica final.</p>
          <div className="mt-3 space-y-3">
            {data.protocolo.casos.map((item) => <details key={item.codigo} className="rounded-lg border border-institucional/15 p-3">
              <summary className="cursor-pointer font-semibold">{item.caso}</summary>
              <p className="mt-2 text-sm">{item.comportamiento}</p>
              <p className="mt-2 text-sm text-secundario">Pendiente: {item.pendiente}</p>
            </details>)}
          </div>
          <h3 className="mt-5 font-semibold">Pendiente antes de activar</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            {data.pendientes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 className="mt-5 font-semibold">Fuentes de la propuesta</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {data.fuentes.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-institucional underline"
                >
                  {source.titulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
