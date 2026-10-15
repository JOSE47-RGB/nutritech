import type { MeasurementReview } from './measurement-review';

type Finding = {
  indicador: string;
  estado?: string;
  regla?: string | null;
  clasificacion: string | null;
  recomendacion: string;
  motivo: string | null;
};
const labels: Record<string, string> = {
  EMACIACION_SEVERA:
    'Peso muy bajo para su tamaño: posible desnutrición aguda severa',
  EMACIACION: 'Peso bajo para su tamaño: posible desnutrición aguda',
  OBESIDAD: 'Medidas compatibles con obesidad',
  SOBREPESO: 'Medidas compatibles con sobrepeso',
  POSIBLE_RIESGO_SOBREPESO: 'Posible riesgo de sobrepeso',
  BAJO_PESO_SEVERO: 'Peso muy bajo para su edad',
  BAJO_PESO: 'Peso bajo para su edad',
  TALLA_BAJA_SEVERA: 'Estatura muy baja para su edad',
  TALLA_BAJA: 'Estatura baja para su edad',
  TALLA_MUY_ALTA: 'Estatura elevada: confirmar la medición',
};
export function familyGuidance(
  indicators: Finding[],
  edema: string,
  revisarMedidas = false,
  revisionMedidas: MeasurementReview | null = null,
) {
  const findings = indicators
    .filter(
      (i) =>
        i.estado === 'ORIENTATIVA' && i.regla && labels[i.regla.split(':')[1]],
    )
    .map((i) => ({
      indicador: i.indicador,
      titulo: labels[i.regla!.split(':')[1]],
      sugerencia: i.recomendacion,
    }));
  const incomplete =
    indicators.length !== 4 ||
    indicators.some((i) => i.estado !== 'ORIENTATIVA');
  const severe = findings.find((i) => i.titulo.includes('aguda severa'));
  const weight =
    findings.find((i) => i.indicador === 'P_T') ??
    findings.find((i) => i.indicador === 'IMC_E');
  const title =
    edema === 'SI'
      ? 'Necesita valoración médica por hinchazón en ambos pies'
      : revisionMedidas
        ? revisionMedidas.avisos[0].titulo
        : edema !== 'NO'
          ? 'Falta revisar la hinchazón en ambos pies (edema)'
          : incomplete
            ? 'Revisemos los datos antes de sacar conclusiones'
            : ((severe ?? weight ?? findings[0])?.titulo ??
              'Medidas dentro de los intervalos esperados');
  const next =
    edema === 'SI'
      ? 'Acude al servicio de salud para que valoren al niño. La hinchazón puede alterar el peso; este cálculo no permite determinar su estado nutricional.'
      : revisionMedidas
        ? revisionMedidas.comprobar
        : edema !== 'NO'
          ? 'Pide al personal de salud que revise el edema. No marques «ausente» si no ha sido evaluado.'
          : incomplete
            ? 'Comprueba la fecha de nacimiento, el peso en kilogramos, la longitud en centímetros y cómo se midió. Solicita ayuda al personal de salud para repetir las medidas que requieren revisión.'
            : severe
              ? severe.sugerencia
              : findings.length
                ? 'Lleva este reporte al centro de salud para revisar el crecimiento, la alimentación y los síntomas del niño. La interpretación final corresponde al médico.'
                : 'Continúa con los controles de crecimiento. Un resultado dentro del intervalo esperado no descarta otros problemas de salud.';
  const factors =
    findings.length && edema === 'NO' && !incomplete
      ? 'Estos hallazgos pueden relacionarse con distintos factores. En el bajo peso o la estatura baja se revisan la alimentación, el acceso a alimentos y las enfermedades frecuentes. En el exceso de peso también intervienen factores biológicos y del entorno. Las medidas por sí solas no identifican la causa en este niño.'
      : 'El peso y la estatura por sí solos no permiten conocer una causa. El personal de salud necesita revisar cómo se alimenta el niño, su crecimiento previo y su salud. No se asigna una causa individual con esta consulta.';
  const comparisons = [
    {
      indicador: 'P_T',
      pregunta: '¿Su peso corresponde a su talla?',
      descripcion:
        'Compara el peso con la longitud o estatura y el sexo del niño.',
    },
    {
      indicador: 'T_E',
      pregunta: '¿Su talla corresponde a su edad?',
      descripcion:
        'Compara la longitud o estatura con la edad exacta y el sexo del niño.',
    },
  ].map((comparison) => {
    const item = indicators.find((i) => i.indicador === comparison.indicador);
    const code = item?.regla?.split(':')[1];
    const normal =
      code === 'INTERVALO_CENTRAL'
        ? 'El peso está dentro del intervalo central de referencia para su talla.'
        : code === 'SIN_TALLA_BAJA'
          ? 'La talla está dentro del intervalo esperado para su edad.'
          : null;
    const valid = edema === 'NO' && item?.estado === 'ORIENTATIVA';
    return {
      ...comparison,
      resultado: valid
        ? (normal ??
          labels[code ?? ''] ??
          item.clasificacion ??
          'Requiere revisión')
        : 'Todavía no se puede dar una conclusión',
      explicacion: valid
        ? item.recomendacion
        : (item?.recomendacion ??
          'Faltan datos o referencias para esta comparación.'),
    };
  });
  return {
    version: 'NUTRITECH-FAMILIA-3',
    estado_edema: edema,
    revision_medidas: revisionMedidas,
    comparaciones: comparisons,
    aviso_medidas:
      revisarMedidas || revisionMedidas
        ? (revisionMedidas?.explicacion ??
          'Hay medidas fuera de los límites de calidad de la referencia. Esto no demuestra que sean incorrectas. Pide al personal de salud que las repita; si se confirman, conserva el valor real para su valoración.')
        : null,
    peso_referencia:
      'No existe un único peso ideal. Se compara el peso con una referencia de crecimiento; la talla se evalúa para la edad, no se calcula una altura ideal a partir del peso.',
    fuente_crecimiento: {
      titulo: 'OMS: patrones de crecimiento infantil',
      url: 'https://www.who.int/tools/child-growth-standards',
    },
    titulo: title,
    siguiente_paso: next,
    factores: factors,
    hallazgos: edema === 'NO' ? findings : [],
    pendientes: indicators
      .filter((i) => i.estado !== 'ORIENTATIVA')
      .map((i) => ({ indicador: i.indicador, mensaje: i.recomendacion })),
    nota: 'Esta es una orientación, no un diagnóstico. En bebés pequeños, las recomendaciones de alimentación deben adaptarse a su edad con el personal de salud.',
    fuente_exceso_peso: {
      titulo: 'OMS: obesidad y sobrepeso',
      url: 'https://www.who.int/es/news-room/fact-sheets/detail/obesity-and-overweight',
    },
    fuente: {
      titulo: 'OMS: malnutrición',
      url: 'https://www.who.int/es/news-room/fact-sheets/detail/malnutrition',
    },
  };
}
