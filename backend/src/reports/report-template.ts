import { familyGuidance } from '../nutrition/family-guidance';
export interface ReportData {
  codigo: string;
  fecha: string;
  autor: string;
  paciente: string;
  expediente: string;
  evaluacion: string;
  estado_evaluacion: string;
  centro: string;
  orientacion: string;
  guardada: string;
  hash_orientacion: string;
  calculo: {
    guia_familiar?: ReturnType<typeof familyGuidance>;
    version_motor: string;
    entrada: {
      edad_dias: number;
      peso_kg: string;
      talla_cm: string;
      tipo_medicion: string;
      edema: string;
      evaluado_en: string;
    };
    referencias_sha256: string;
    reglas_sha256: string;
    version_consolidacion: string;
    orientacion: {
      version: string;
      version_reglas: string;
      indicadores: {
        indicador: string;
        estado?: string;
        regla?: string | null;
        z: number | null;
        clasificacion: string | null;
        motivo: string;
        recomendacion: string;
        fuentes: { titulo: string; url: string }[];
      }[];
      avisos: { texto: string; fuente?: { titulo: string; url: string } }[];
    };
  };
  valoraciones: {
    autor: string;
    fecha: string;
    decision: string;
    valoracion: string;
    acciones: string;
  }[];
  alertas: {
    codigo: string;
    titulo: string;
    mensaje: string;
    estado: string;
    politica: string | null;
    historial: {
      autor: string;
      fecha: string;
      estado: string;
      comentario: string | null;
    }[];
  }[];
}
export const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
const e = escapeHtml;
const date = (value: string) =>
  new Date(value).toLocaleString('es-GT', { timeZone: 'America/Guatemala' });
export function reportHtml(d: ReportData) {
  const family =
    d.calculo.guia_familiar &&
    ['NUTRITECH-FAMILIA-2', 'NUTRITECH-FAMILIA-3'].includes(
      d.calculo.guia_familiar.version,
    )
      ? d.calculo.guia_familiar
      : familyGuidance(
          d.calculo.orientacion.indicadores,
          d.calculo.entrada.edema,
        );
  const sources = [
    ...new Map(
      [
        ...d.calculo.orientacion.indicadores.flatMap((i) => i.fuentes),
        ...d.calculo.orientacion.avisos.flatMap((a) =>
          a.fuente ? [a.fuente] : [],
        ),
        ...(family.revision_medidas ? [family.revision_medidas.fuente] : []),
      ].map((s) => [s.url, s]),
    ).values(),
  ];
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NutriTech · ${e(d.codigo)}</title><style>
 @page {size:A4;margin:17mm} *{box-sizing:border-box} body{font:11pt/1.45 Arial,sans-serif;color:#2F3A45;margin:0;background:white} main{max-width:185mm;margin:20px auto;padding:0 12px} h1{font-size:23pt;color:#2563A6;margin:0} h2{font-size:15pt;border-bottom:1px solid #2563A6;padding-bottom:5px;margin-top:22px;break-after:avoid} h3{font-size:12pt;break-after:avoid} p{margin:6px 0;overflow-wrap:anywhere} .meta{font-size:9pt;color:#515a65} .notice{padding:10px;border-left:4px solid #2563A6;background:#E8F1FA} table{width:100%;border-collapse:collapse;font-size:10pt} th,td{padding:7px;border:1px solid #cbd5e1;text-align:left;vertical-align:top;overflow-wrap:anywhere} th{background:#E8F1FA} thead{display:table-header-group} tr{break-inside:avoid} .entry{border-bottom:1px solid #cbd5e1;padding:8px 0} .text{white-space:pre-wrap;overflow-wrap:anywhere} .hash{font-family:monospace;font-size:8pt;overflow-wrap:anywhere} li{margin:5px 0;overflow-wrap:anywhere} @media print{main{max-width:none;margin:0;padding:0} body{font-size:10pt} a{color:inherit}}
 </style></head><body><main>
 <header><h1>NutriTech</h1><p>Reporte de evaluación y seguimiento</p><p class="meta">Código ${e(d.codigo)} · Generado: ${e(date(d.fecha))} (Guatemala) · Por: ${e(d.autor)}</p></header>
 <p class="notice">Orientación automática de apoyo. La valoración médica se muestra por separado. Este reporte conserva la información disponible al generarlo; no constituye una notificación oficial al MSPAS.</p>
 <h2>Identificación y medición</h2><p><strong>${e(d.paciente)}</strong> · Expediente: ${e(d.expediente)}</p><p>Centro: ${e(d.centro)}</p><p>Evaluación: ${e(d.evaluacion)} · Estado al generar: ${e(d.estado_evaluacion)}</p>
 <p>Medición: ${e(date(d.calculo.entrada.evaluado_en))} (Guatemala) · Edad: ${e(d.calculo.entrada.edad_dias)} días</p><p>Peso: ${e(d.calculo.entrada.peso_kg)} kg · Longitud/talla: ${e(d.calculo.entrada.talla_cm)} cm · Método: ${e(d.calculo.entrada.tipo_medicion)} · Edema: ${e(d.calculo.entrada.edema)}</p>
 <h2>Para la madre, el padre o responsable</h2><div class="notice"><h3>${e(family.titulo)}</h3><p><strong>¿Qué hacemos ahora?</strong> ${e(family.siguiente_paso)}</p></div>
 ${family.revision_medidas ? `${family.revision_medidas.avisos.map((a) => `<div class="entry"><h3>${e(a.titulo)}</h3><p>${e(a.detalle)}</p></div>`).join('')}<p>${e(family.revision_medidas.explicacion)}</p><h3>Si la medida se confirma</h3><p>${e(family.revision_medidas.si_se_confirma)}</p>` : family.aviso_medidas ? `<p class="notice">${e(family.aviso_medidas)}</p>` : ''}
 ${d.calculo.entrada.edema === 'DESCONOCIDO' ? '<p class="notice">La revisión de hinchazón en ambos pies está pendiente. Esto no significa que el niño la tenga; pide al personal de salud que la revise antes de interpretar su peso.</p>' : ''}
 ${!family.aviso_medidas && !family.pendientes.length ? family.comparaciones.map((c) => `<div class="entry"><h3>${e(c.pregunta)}</h3><p><strong>${e(c.resultado)}</strong></p><p>${e(c.explicacion)}</p></div>`).join('') : ''}<p>${e(family.peso_referencia)}</p><p class="meta">${e(family.fuente_crecimiento.url)}</p>
 ${family.hallazgos.map((h) => `<p><strong>${e(h.titulo)}</strong>: ${e(h.sugerencia)}</p>`).join('')}
 <h3>Posibles factores que conviene revisar</h3><p>${e(family.factores)}</p><p>${e(family.nota)}</p><p class="meta">Información general: ${e(family.fuente.titulo)} · ${e(family.fuente.url)} · ${e(family.fuente_exceso_peso.url)} · ${e(family.version)}</p>
 <h2>Detalle para el personal de salud</h2><p class="meta">Orientación ${e(d.orientacion)} · Guardada: ${e(date(d.guardada))} (Guatemala)</p><p class="meta">Los puntajes se muestran a dos decimales. Las clasificaciones usan el valor completo conservado.</p>
 <table><thead><tr><th>Indicador</th><th>Puntaje Z</th><th>Clasificación orientativa</th></tr></thead><tbody>${d.calculo.orientacion.indicadores.map((i) => `<tr><td>${e(i.indicador)}</td><td>${i.z === null ? 'No disponible' : e(i.z.toFixed(2))}</td><td>${e(i.clasificacion ?? 'Requiere revisión / sin clasificación automática')}</td></tr>`).join('')}</tbody></table>
 ${d.calculo.orientacion.indicadores.map((i) => `<div class="entry"><h3>${e(i.indicador)}</h3><p>${e(i.recomendacion)}</p><p class="meta">Motivo: ${e(i.motivo)}</p></div>`).join('')}
 <ul>${d.calculo.orientacion.avisos.map((a) => `<li>${e(a.texto)}</li>`).join('')}</ul>
 <h2>Valoraciones médicas registradas</h2>${d.valoraciones.length ? d.valoraciones.map((v) => `<div class="entry"><h3>${e(v.decision)} · ${e(v.autor)}</h3><p class="meta">${e(date(v.fecha))} (Guatemala)</p><p class="text">${e(v.valoracion)}</p><p class="text"><strong>Acciones indicadas:</strong> ${e(v.acciones)}</p></div>`).join('') : '<p>Sin valoración médica registrada a la fecha de generación.</p>'}
 <h2>Alertas y seguimiento</h2><p class="meta">Los estados describen el seguimiento del aviso, no una prioridad clínica.</p>${d.alertas.length ? d.alertas.map((a) => `<div class="entry"><h3>${e(a.titulo)} · ${e(a.estado)}</h3><p>${e(a.mensaje)}</p><p class="meta">Alerta: ${e(a.codigo)} · Política: ${e(a.politica ?? 'Registro anterior')}</p><ol>${a.historial.map((h) => `<li><strong>${e(h.estado)}</strong> · ${e(h.autor)} · ${e(date(h.fecha))}<p class="text">${e(h.comentario)}</p></li>`).join('')}</ol></div>`).join('') : '<p>Sin alertas registradas para esta orientación. Esto no descarta riesgo clínico.</p>'}
 <h2>Fuentes y trazabilidad</h2><ul>${sources.map((s) => `<li>${e(s.titulo)}<p class="meta">${e(s.url)}</p></li>`).join('')}</ul>
 <p class="meta">Motor: ${e(d.calculo.version_motor)} · Reglas: ${e(d.calculo.orientacion.version_reglas)} · Orientación: ${e(d.calculo.orientacion.version)} · Consolidación: ${e(d.calculo.version_consolidacion)}</p>
 <p class="hash">SHA-256 orientación: ${e(d.hash_orientacion)}</p><p class="hash">SHA-256 referencias: ${e(d.calculo.referencias_sha256)}</p><p class="hash">SHA-256 reglas: ${e(d.calculo.reglas_sha256)}</p><p class="meta">Documento confidencial para revisión profesional. Identificación del paciente y centro tomadas al generar el reporte. No incluye una firma digital certificada.</p>
 </main></body></html>`;
}
