# Paso 14: conservar los puntajes sin redondear

El motor ahora devuelve `indicadores[indicador].z` sin redondearlo a dos decimales. La API conserva ese número y React aplica `toFixed(2)` únicamente al mostrarlo. Los puntajes no disponibles continúan siendo `null` con su motivo.

## Qué problema resuelve

Antes, el motor convertía aproximadamente −3.004 en −3.00 antes de devolverlo. Una comparación posterior contra −3 recibía un valor que ya había perdido información. Ahora el código puede comparar el puntaje completo, aunque la pantalla muestre dos decimales.

```ts
// Ejemplo del flujo; el valor calculado conserva la precisión de number.
const z = -3.004;
z < -3;       // true: comparación numérica
z.toFixed(2); // "-3.00": texto para mostrar
```

`toFixed()` produce texto. No se debe convertir ese texto nuevamente a número para decidir una clasificación. Tampoco se debe agregar una tolerancia que transforme automáticamente valores cercanos en límites exactos.

La precisión conservada es la del tipo `number` de JavaScript, no aritmética decimal infinita. No se cambió la precisión de las mediciones registradas ni de las referencias LMS. Este paso conserva el resultado de cálculo en memoria y al enviarlo por JSON; todavía no lo guarda en la tabla de resultados.

## Archivos y responsabilidades

- `backend/src/nutrition/calculator.ts`: devuelve el resultado de `lmsScore()` sin el redondeo de salida. La versión pasa a `nutritech-anthro-1.1.0-v2` para distinguir el cambio de contrato.
- `backend/src/evaluaciones/evaluation-calculation.service.ts`: ya transmitía el resultado completo; no necesitó cambios.
- `frontend/src/components/EvaluationCalculation.tsx`: ya aplicaba `score.z.toFixed(2)` para mostrarlo; no necesitó cambios. Puedes verlo desde el expediente, en **Consultar cálculo provisional**.
- `backend/src/nutrition/oracle.ts`: redondea una copia del puntaje únicamente al contrastarlo con los casos oficiales guardados, porque esos resultados de anthro tienen dos decimales. Las fórmulas del motor siguen contrastadas con esos 500 casos a esa precisión; los casos sintéticos prueban por separado la conservación de decimales adicionales.
- `backend/src/nutrition/classification-draft.ts`: actualiza el pendiente para exigir el uso del puntaje completo al implementar la futura persistencia.

## Banderas de calidad

El código de anthro conservado en `database/references/anthro-1.1.0/calculation-source` redondea antes de obtener sus banderas. Mantuvimos ese comportamiento para `fuera_rango_calidad`, usando una variable separada `qualityZ`. Esa variable no reemplaza `z` ni se usa como entrada del borrador de clasificación.

Esto es una compatibilidad explícita: las banderas existentes mantienen su comportamiento y la futura clasificación dispone del puntaje sin recortar. Hay una prueba específica cerca del límite de calidad para evitar que un cambio accidental mezcle ambos contratos.

## Verificación realizada

- 38 pruebas unitarias aprobadas, incluidas pruebas de −3.004 en los cuatro indicadores, transmisión por JSON y comparación con el borrador usando el valor completo.
- Los 500 casos de contraste con anthro siguen coincidiendo después de aplicar el redondeo de compatibilidad al comparar las salidas.
- 18 pruebas de integración de evaluaciones y patrones aprobadas con MariaDB accesible. La consulta HTTP entrega decimales adicionales y no crea resultados persistidos.
- Comprobación TypeScript y lint del backend, compilación y lint del frontend aprobados.
- Revisión del catálogo regenerada: 20 reglas, sin huecos ni superposiciones.

Para repetir desde `backend`:

```bash
npm test -- --runInBand
RUN_DB_TESTS=1 npx jest --config ./test/jest-e2e.json --runInBand evaluaciones.e2e-spec.ts patrones.e2e-spec.ts
npm run classification:review
```

Las pruebas de integración crean registros sintéticos propios y los eliminan al terminar. No se realizó una migración de esquema en este paso.

## Próximo paso

Completar la revisión de etiquetas y del protocolo aplicable, incluidos los casos con edema, datos fuera de cobertura y banderas de calidad. Las clasificaciones continúan como borrador; todavía no se activan ni generan alertas. Una futura persistencia deberá conservar la precisión y la versión del motor usadas para decidir cada resultado.
