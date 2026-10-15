import type { Measurement, NutritionCalculator } from './calculator';

type Calculation = ReturnType<NutritionCalculator['calculate']>;
export type MeasurementReview = {
  avisos: { codigo: string; titulo: string; detalle: string }[];
  explicacion: string;
  comprobar: string;
  si_se_confirma: string;
  fuente: { titulo: string; url: string };
};

// Describe las banderas existentes. No modifica medidas, límites ni clasificaciones.
export function measurementReview(
  input: Measurement,
  quality: Calculation,
): MeasurementReview | null {
  const avisos: MeasurementReview['avisos'] = [];
  const { T_E, P_E, P_T, IMC_E } = quality.indicadores;
  const age =
    input.edad_dias === 0
      ? 'el día del nacimiento'
      : `a los ${input.edad_dias} días de edad`;
  if (T_E.fuera_rango_calidad) {
    avisos.push({
      codigo: 'T_E:CALIDAD',
      titulo: `Revisar la longitud/talla: ${input.talla_cm} cm`,
      detalle: `La medida ingresada ${age} está muy ${T_E.z !== null && T_E.z < 0 ? 'por debajo' : 'por encima'} de la referencia para su edad y sexo. Es una señal para confirmar la medida, no una prueba de que se escribió mal.`,
    });
  }
  if (P_E.fuera_rango_calidad) {
    avisos.push({
      codigo: 'P_E:CALIDAD',
      titulo: `Revisar el peso: ${input.peso_kg} kg`,
      detalle: `El peso ingresado ${age} está muy alejado de la referencia para su edad y sexo. Confirma la fecha de nacimiento, la unidad y la lectura de la báscula antes de interpretarlo.`,
    });
  }
  if (
    !T_E.fuera_rango_calidad &&
    !P_E.fuera_rango_calidad &&
    (P_T.fuera_rango_calidad || IMC_E.fuera_rango_calidad)
  ) {
    avisos.push({
      codigo: P_T.fuera_rango_calidad ? 'P_T:CALIDAD' : 'IMC_E:CALIDAD',
      titulo: 'Revisar el peso y la longitud/talla juntos',
      detalle: `La combinación de ${input.peso_kg} kg y ${input.talla_cm} cm requiere repetir ambas medidas. Por sí sola, esta alerta no confirma desnutrición ni exceso de peso.`,
    });
  }
  if (P_T.motivo === 'TALLA_FUERA_DE_COBERTURA') {
    avisos.push({
      codigo: 'P_T:TALLA_FUERA_DE_COBERTURA',
      titulo: 'El peso para esta talla necesita valoración profesional',
      detalle: `La tabla de peso para ${input.edad_dias < 731 ? 'longitud cubre de 45 a 110' : 'talla cubre de 65 a 120'} cm. La medida usada (${quality.talla_ajustada_cm} cm) queda fuera. Ese límite pertenece a la tabla; no significa que el niño deba medir dentro de ella.`,
    });
  }
  if (quality.medicion_pie_menor_9_meses) {
    avisos.push({
      codigo: 'MEDICION:METODO',
      titulo: 'Confirmar cómo se midió al bebé',
      detalle:
        'Se indicó una medición de pie para un bebé menor de nueve meses. Pide al personal de salud que confirme la longitud acostado.',
    });
  }
  if (!avisos.length) return null;
  return {
    avisos,
    explicacion:
      'Los niños no tienen que medir ni pesar lo mismo. Una medida fuera de la referencia puede ser real; esta alerta pide comprobarla, no cambiarla para que coincida con un valor estándar.',
    comprobar:
      'Comprueba la fecha de nacimiento, los kilogramos y los centímetros. Pide al personal de salud que repita las medidas con el equipo adecuado.',
    si_se_confirma:
      'Si la medida se confirma, conserva el valor real y lleva el reporte al personal de salud para valorar el crecimiento y los antecedentes del nacimiento. No lo reemplaces por el valor de referencia; confirmar la medida no habilita un diagnóstico automático.',
    fuente: {
      titulo:
        'OMS Anthro: comprobación de medidas extremas, secciones 1.3 y 3.4.2',
      url: 'https://www.who.int/docs/default-source/child-growth/child-growth-standards/software/anthro-pc-manual-v322.pdf',
    },
  };
}
