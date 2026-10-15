# Paso 12: edema y consulta de cálculos en evaluaciones

## Cómo probarlo

1. Abre **Capturar peso y altura**, busca al niño y completa los datos habituales.
2. Selecciona el estado de edema: **Presente**, **Ausente** o **Desconocido / no evaluado**. El formulario exige elegir una opción.
3. Guarda la medición.
4. Si tienes `evaluaciones.ver`, abre **Historial de evaluaciones** y pulsa **Consultar cálculo provisional** en la evaluación.
5. Revisa la medida original, la ajustada y los cuatro indicadores. Los puntajes no disponibles muestran su motivo.

La consulta de cálculos requiere el permiso de historial. Una cuenta con permiso de captura pero sin permiso de consulta puede registrar edema, pero no consultar los puntajes. Esto mantiene separados los permisos existentes.

## Qué cambió en la base

La migración `database/migrations/002-evaluaciones-edema.sql` agrega la columna `edema` a `evaluaciones_nutricionales` con valores `SI`, `NO` y `DESCONOCIDO`. Es un cambio aditivo: no elimina registros ni cambia medidas. Las evaluaciones anteriores reciben `DESCONOCIDO`; no se interpreta como ausencia confirmada.

La migración ya se aplicó en este entorno y el cliente Prisma se regeneró. Para instalar en otro entorno, desde `backend`:

```bash
npm run db:migrate:edema
npm run db:generate
```

El ejecutor comprueba la definición si la columna ya existe y rechaza una definición incompatible. No necesitas volver a importar la base completa. La nueva API exige el estado explícito; el valor predeterminado en la base protege registros históricos o inserciones que no incluyan ese dato.

## Cómo se conecta el motor

El guardado usa `POST /evaluaciones`, ahora con el campo obligatorio `edema`. NestJS valida que sea una de las tres opciones y Prisma lo guarda junto a la medición y su auditoría. La búsqueda de reintentos idénticos incluye el estado de edema; dos cuerpos con distinto estado no se consideran el mismo registro.

La nueva consulta es `GET /evaluaciones/:codigo/calculo`, protegida por `evaluaciones.ver`. El servicio:

1. Obtiene los datos de la evaluación y el sexo del niño. Rechaza evaluaciones anuladas.
2. Verifica las huellas de los archivos originales.
3. Lee las referencias de MariaDB en la misma transacción de lectura y comprueba su correspondencia completa con los archivos y la configuración de los indicadores.
4. Invoca el motor con la edad registrada, peso, talla, método y edema guardados.
5. Devuelve puntajes, motivos de ausencia, ajustes y banderas de calidad con `Cache-Control: no-store`.

Si faltan referencias o cambian sus valores, responde que no puede realizar el cálculo. No devuelve un número basado en una carga parcial. Se verifican las referencias en cada consulta; para volúmenes mayores puede estudiarse una caché con invalidación por versión, conservando estas comprobaciones.

## Cómo interpretar la pantalla

La etiqueta **Cálculo provisional** indica que se trata de una consulta técnica con el motor contrastado. No constituye una clasificación nutricional y no genera alertas. Tampoco se guarda en `resultados_indicador` ni cambia el estado `REGISTRADA` de la evaluación.

Con edema `SI` o `DESCONOCIDO`, los indicadores dependientes del peso muestran el motivo por el que no se calculan. No se sustituyen por cero. T_E puede mostrarse si sus datos y referencia permiten calcularlo.

El valor original se conserva. La pantalla identifica la medida ajustada que utiliza el motor y muestra el IMC ajustado cuando el estado de edema es `NO`. Las banderas de calidad no se presentan como diagnósticos.

Esta consulta provisional está disponible mientras el patrón permanece inactivo. No equivale a activar la clasificación del sistema. Las reglas de clasificación y su revisión siguen pendientes.

## Archivos para aprender

- `backend/src/evaluaciones/evaluation.dto.ts`: valida el nuevo campo obligatorio y el código de consulta.
- `backend/src/evaluaciones/evaluaciones.service.ts`: guarda y devuelve edema.
- `backend/src/evaluaciones/evaluation-calculation.service.ts`: verifica referencias y conecta el motor a la evaluación.
- `backend/src/evaluaciones/evaluaciones.controller.ts`: ruta de cálculo y permiso.
- `frontend/src/components/Evaluaciones.tsx`: selector de edema e historial.
- `frontend/src/components/EvaluationCalculation.tsx`: consulta y presentación provisional.
- `backend/scripts/migrate-edema.cjs`: aplicación verificable del cambio de esquema.

## Comprobaciones

Las pruebas de integración cubren las tres opciones, campo ausente e inválido, valor histórico predeterminado, consulta sin persistencia, permisos, códigos inválidos y evaluación anulada. Las pruebas del servicio simulan parámetros incompletos y alterados sin modificar las referencias reales. Se mantienen las pruebas del motor contra 500 casos ejecutados en R.

Desde `backend`:

```bash
npm run test:evaluaciones
npm test -- --runInBand
```

El siguiente paso es definir y revisar las reglas de clasificación y el proceso de validación antes de persistir resultados definitivos o generar alertas.


## Verificación del paso completada

Se comprobaron 23 pruebas unitarias y 48 pruebas de integración con MariaDB (71 en total), compilación TypeScript del backend, compilación y lint del frontend y lint del backend. La prueba HTTP a través del proxy de Vite también verificó registro de un niño temporal, captura de edema desconocido, consulta provisional y ausencia de resultados persistidos. Los datos temporales se retiraron al terminar.

Se ajustó `backend/tsconfig.build.json` para compilar únicamente `src` y conservar `dist/main.js` como entrada. Los scripts de verificación se ejecutan con sus comandos específicos; no desplazan los archivos de la aplicación a `dist/src`. Esto mantiene válidas las rutas usadas para cargar el importador y sus referencias.
