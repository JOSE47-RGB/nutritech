# Paso 17: orientación por evaluación

En el expediente, abre una evaluación y pulsa **Consultar cálculo provisional**. Debajo de los puntajes aparece **Clasificación orientativa y recomendaciones**. Cada indicador muestra una etiqueta (cuando se puede interpretar), recomendación, motivo y enlace de fuente. La decisión final corresponde al médico.

## Cómo funciona

1. La API conserva sus comprobaciones de sesión, permiso, estado de evaluación e integridad de referencias.
2. El motor calcula el puntaje completo. `recommendations.ts` compara ese valor con los intervalos revisados del catálogo, sin usar el texto redondeado de la pantalla.
3. Devuelve cuatro entradas independientes bajo `orientacion`, con versión `NUTRITECH-ORIENTACION-1` y versión de reglas. La clasificación es orientativa, no una validación clínica ni una activación de reglas en MariaDB.
4. React muestra la orientación y permite desplegar su motivo y fuente. Las frases de recomendación son redacción del proyecto apoyada en los documentos, no citas literales ni un protocolo oficial consolidado.

## Casos que requieren revisión

- Edema presente o desconocido: se retiene la clasificación automática de todos los indicadores, incluso T_E si tiene puntaje disponible. Los cálculos disponibles siguen visibles. Es una decisión conservadora de presentación del proyecto.
- Puntaje ausente, no finito o acompañado de motivo de indisponibilidad: no se asigna categoría.
- Bandera de calidad verdadera o desconocida, o método marcado: se solicita revisión de la medición.
- Los indicadores disponibles permanecen independientes si otro carece de cobertura.

La referencia clínica distingue los menores de seis meses y requiere integrar información clínica. La pantalla lo hace explícito; no decide hospitalización ni tratamiento a partir de estos puntajes. [OMS 2023, capítulo 4](https://www.ncbi.nlm.nih.gov/books/NBK601655/). El catálogo de intervalos se apoya en la [interpretación de crecimiento OMS](https://www.ncbi.nlm.nih.gov/books/NBK148966/). MSPAS se enlaza como contexto separado de vigilancia; no se utiliza para afirmar elegibilidad o enviar notificaciones.

## Qué no se guarda todavía

La consulta sigue siendo de lectura: no inserta resultados, alertas ni recomendaciones en tablas. `persistida: false` describe esa salida. No hay formulario de valoración médica todavía. El siguiente paso será guardar resultados con trazabilidad y separar su revisión médica.

## Verificación

Se añadieron diez pruebas de orientación: frontera −3.004/−3, edema presente/desconocido, calidad marcada/desconocida, método marcado, puntajes inválidos y cobertura independiente. Las 56 pruebas unitarias pasan. Compilación TypeScript y lint del backend, y build y lint del frontend pasan. También pasaron las 13 pruebas de integración de evaluaciones con MariaDB, incluida la comprobación de las cuatro entradas y la ausencia de resultados persistidos. La primera comprobación local fue bloqueada por el entorno restringido (P1001); al ejecutar con acceso local la conexión y la suite funcionaron.

Desde `backend`:

```bash
npm test -- --runInBand
npm run test:evaluaciones
```
