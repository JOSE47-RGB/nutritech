/** Consolidación documental; no ejecuta decisiones clínicas ni notificaciones. */
export const CONSOLIDATED_PROTOCOL = {
  version: 'OMS-MSPAS-CONSOLIDACION-1',
  estado: 'CONSOLIDACION_DOCUMENTAL',
  rol_sistema:
    'Apoyo al médico mediante recomendaciones, alertas y reportes trazables.',
  decision_final: 'MEDICO',
  fuentes: [
    {
      id: 'OMS-2006',
      titulo: 'OMS: estándares de crecimiento infantil',
      url: 'https://www.who.int/tools/child-growth-standards',
      alcance:
        'Referencias de cálculo; el motor existente conserva su metodología.',
    },
    {
      id: 'OMS-2023',
      titulo: 'OMS 2023: emaciación y edema nutricional',
      url: 'https://www.who.int/publications/i/item/9789240082830',
      alcance:
        'Apoyo clínico; separar menores de 6 meses y población de 6–59 meses.',
    },
    {
      id: 'MSPAS-2018',
      titulo: 'MSPAS 2018: vigilancia epidemiológica de desnutrición aguda',
      url: 'https://epidemiologia.mspas.gob.gt/phocadownload/userupload/protocolo-de-vigilancia/vigente/9.pdf',
      alcance:
        'Definiciones y notificación; páginas 8–9. Listado en el catálogo Vigente, no equivale a verificar el protocolo clínico más reciente.',
    },
  ],
  decisiones: [
    {
      tema: 'Antropometría',
      acuerdo:
        'Mantener el cálculo OMS y vincular cada recomendación con indicador, puntaje completo y fuente. Para desnutrición aguda antropométrica, comparar P_T con el criterio local.',
      estado: 'BASE_DOCUMENTADA',
    },
    {
      tema: 'Límites',
      acuerdo:
        'Conservar −3 ≤ z < −2 y z < −3 en P_T según OMS. La redacción resumida del cuadro MSPAS no se convierte en operadores diferentes sin evidencia.',
      estado: 'BASE_DOCUMENTADA',
    },
    {
      tema: 'Edema',
      acuerdo:
        'No convertir un puntaje ausente en ausencia de riesgo. Separar el hallazgo registrado de su interpretación clínica por el médico.',
      estado: 'REQUIERE_DATOS_CLINICOS',
    },
    {
      tema: 'Menores de seis meses',
      acuerdo:
        'Separar la evaluación clínica OMS de las exclusiones de notificación MSPAS. No omitir recomendaciones de revisión por estar excluido de un registro.',
      estado: 'ALCANCES_DISTINTOS',
    },
    {
      tema: 'Método y edad',
      acuerdo:
        'Conservar el motor validado. Revisar la diferencia entre la descripción local de medición y la metodología computacional antes de cambiar captura o cálculo.',
      estado: 'DIFERENCIA_DOCUMENTADA',
    },
    {
      tema: 'Alertas',
      acuerdo:
        'Proponer alertas de hallazgo, calidad y datos faltantes con motivo y fuente. La decisión médica y su registro deben mantenerse separados de la sugerencia automática.',
      estado: 'DISENO_PENDIENTE',
    },
    {
      tema: 'Reporte',
      acuerdo:
        'Mostrar medidas, puntajes, fuentes, versión y recomendaciones; incluir una sección diferenciada para valoración médica. No presentar el reporte como notificación oficial enviada.',
      estado: 'DISENO_PENDIENTE',
    },
  ],
  limitaciones: [
    'No se localizó una copia oficial verificable del protocolo clínico comunitario MSPAS más reciente. El documento de vigilancia no lo sustituye.',
    'Faltan campos estructurados para perímetro braquial, grado de edema, signos de peligro, apetito y peso al nacer; no inferirlos de observaciones libres.',
    'Esta consolidación no activa reglas ni guarda clasificaciones. La futura implementación debe distinguir datos desconocidos de respuestas negativas.',
  ],
} as const;
