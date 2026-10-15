# Paso 16: consolidación documental OMS y MSPAS Guatemala

NutriTech dará recomendaciones, alertas y reportes como apoyo al médico. La decisión clínica final corresponde al médico. Esta selección de fuentes fue indicada por el autor del proyecto; no exige registrar previamente el nombre de un médico para continuar desarrollando.

## Fuentes y alcance

| Identificador | Documento | Uso en NutriTech |
| --- | --- | --- |
| OMS-2006 | [Estándares de crecimiento infantil](https://www.who.int/tools/child-growth-standards) y referencias anthro ya verificadas | Motor de puntajes; mantener cálculo y versión separados de las reglas de interpretación. |
| OMS-2023 | [Guía de prevención y manejo de emaciación y edema nutricional](https://www.who.int/publications/i/item/9789240082830) | Marco de apoyo clínico. Sustituye la guía OMS de 2013 sobre desnutrición aguda severa. |
| MSPAS-2018 | [Vigilancia epidemiológica de desnutrición aguda](https://epidemiologia.mspas.gob.gt/phocadownload/userupload/protocolo-de-vigilancia/vigente/9.pdf), páginas impresas y PDF 8–9 | Definiciones locales y alcance de notificación. |

El PDF MSPAS dice Guatemala, octubre de 2018. Su [catálogo oficial](https://epidemiologia.mspas.gob.gt/informacion/vigilancia-epidemiologica/protocolo-de-vigilancia/25-vigente) lo lista bajo “Vigente”, con fecha de carga 17/10/2022. Esa carga no es una edición nueva. Se conserva el archivo, URL, fecha de consulta y SHA-256 en `database/references/protocols/manifest.json`.

Existe evidencia oficial de la socialización de un protocolo comunitario en 2024, pero no se obtuvo su texto íntegro desde una fuente oficial verificable durante esta revisión. [Diario de Centro América, 12/10/2024](https://dca.gob.gt/noticias-guatemala-diario-centro-america/capacitan-a-personal-de-salud-para-prevenir-desnutricion-aguda/). No se utilizaron copias estudiantiles, títulos de buscadores ni protocolos antiguos de tratamiento como sustitutos de esa edición.

## Consolidación de criterios

La OMS 2023 distingue menores de seis meses y niños de 6–59 meses. Para estos últimos, el criterio antropométrico de emaciación moderada es −3 ≤ P_T < −2 y el severo P_T < −3. El perímetro braquial y el edema aportan criterios adicionales. La decisión de atención también considera problemas médicos y apetito; un puntaje aislado no completa esa valoración. En menores de seis meses se contempla evaluación médica, de alimentación y del entorno cuidador. [OMS, capítulo 4: A1–A2, B2 y B17](https://www.ncbi.nlm.nih.gov/books/NBK601655/).

El MSPAS utiliza peso para longitud/talla o signos clínicos para la vigilancia. Su cuadro de moderada tiene una redacción resumida; para operadores exactos conservamos la definición explícita OMS, sin atribuir símbolos que el cuadro local no imprime. El documento excluye de clasificación/notificación a neonatos menores de 29 días y a menores de seis meses con antecedente de bajo peso al nacer. También describe el método de longitud/talla con una condición de 85 cm que no se debe trasladar automáticamente al algoritmo anthro. Estas son diferencias de alcance que permanecen visibles; no son motivo para suprimir la evaluación clínica. [MSPAS, páginas 8–9](https://epidemiologia.mspas.gob.gt/phocadownload/userupload/protocolo-de-vigilancia/vigente/9.pdf).

## Decisiones de diseño del proyecto

Las siguientes son decisiones propuestas para NutriTech, no citas de protocolos:

1. Mantener el motor OMS validado y el puntaje sin redondear. No promediar umbrales de fuentes distintas.
2. Registrar por separado hallazgo automático, recomendación, alerta, decisión médica y eventual elegibilidad para notificación.
3. Toda recomendación debe incluir su regla, versión, población aplicable y fuente. Si hay discrepancias, mostrarlas y pedir valoración del médico, sin elegir silenciosamente una fuente.
4. Distinguir alertas de hallazgos nutricionales, calidad de datos e información incompleta. Una etiqueta de interfaz no define por sí misma una urgencia clínica.
5. El reporte debe mostrar medidas originales, ajustes, puntajes, motivos de ausencia, recomendaciones y fuentes, con una sección diferenciada para la valoración médica. No constituye una notificación enviada al MSPAS.
6. Antes de implementar criterios que dependan de ellos, añadir captura estructurada de perímetro braquial, grado de edema, signos de peligro, apetito y peso al nacer. Un dato faltante no equivale a “no”. No extraer estos hechos automáticamente del texto libre.
7. No asignar automáticamente tratamientos o dosis desde esta consolidación. El médico decide la conducta.

## Qué quedó incorporado

La pantalla **Patrones nutricionales → Revisar propuesta** muestra la consolidación, siete decisiones, tres fuentes y las limitaciones. `consolidated-protocol.ts` es un catálogo documental, no un motor de decisiones. La API y `rules-draft.json` lo incluyen bajo `protocolo.consolidacion`. La revisión técnica no se presenta como aprobación clínica institucional.

Este paso no modifica tablas ni activa alertas. El siguiente desarrollo puede implementar la clasificación orientativa y recomendaciones explicables con los datos ya capturados, mostrando explícitamente qué criterios todavía no se pueden evaluar. El diseño de persistencia deberá conservar versiones y separar la valoración médica de la salida automática.
