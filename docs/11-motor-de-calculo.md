# Paso 11: motor de cálculo y comparación con anthro

## Qué quedó implementado

Un motor TypeScript calcula P_E, T_E, P_T e IMC_E a partir de sexo, edad entera en días, peso, longitud/talla, método de medición y estado de edema. Es un componente del backend para verificación; todavía no está conectado al guardado ni a las pantallas de evaluaciones.

Se ejecutaron 500 casos sintéticos mediante las funciones R originales de `anthro` 1.1.0 y se compararon con el motor. La comparación se repitió usando los 13,366 parámetros leídos de MariaDB: **cero discrepancias** en las salidas comprobadas.

La evidencia está en `database/references/anthro-1.1.0/calculation-verification.json`. El patrón sigue inactivo. No se guardaron resultados nutricionales ni se generaron alertas.

## Qué aprendemos

Las tablas LMS no son resultados del niño. Son los parámetros de referencia seleccionados para calcular su puntaje Z. La implementación separa tres responsabilidades:

1. **Preparar la medición** según edad y método, conservando el valor original.
2. **Seleccionar o interpolar la referencia** que corresponde al indicador.
3. **Calcular y comprobar la salida**, distinguiendo un número disponible de un resultado que no puede calcularse.

`NutritionCalculator` recibe las referencias y la medición. No sabe de cookies, formularios, contraseñas ni transacciones. Esa separación permite probarlo independientemente y conectarlo más adelante al servicio de evaluaciones.

## Comportamientos contrastados

Se tomaron como referencia los archivos originales del commit `80c8db44575425463423ed07bddfd79a3a3301b9`, conservados en `database/references/anthro-1.1.0/calculation-source`. Su manifiesto incluye URL y SHA-256. Consulta también la [documentación del paquete oficial](https://cran.r-project.org/web/packages/anthro/refman/anthro.html).

- Método depurado y ajuste de longitud/talla conforme al flujo de `anthro_zscores`, incluyendo el tratamiento específico de mediciones de pie por debajo de nueve meses.
- IMC calculado con la medida ajustada y sin redondeo previo. No se reutiliza el IMC generado por MariaDB, que emplea la medida original.
- Selección de referencia por edad y sexo; interpolación de L, M y S entre décimas de centímetro cuando corresponde a P_T.
- Fórmula LMS y extensión de los extremos para los indicadores que la aplican en anthro. T_E utiliza el cálculo sin esa extensión.
- Puntajes con dos decimales y banderas de calidad equivalentes a las de la fuente en los casos comparados.
- Ausencia de puntajes dependientes del peso cuando se indica edema.

Las banderas de calidad **no son diagnósticos ni reglas de alerta**. Se devuelven separadas del puntaje. El motor no crea etiquetas de clasificación.

## Decisiones explícitas de NutriTech

El motor exige edad conocida en días enteros, sexo, método y estado de edema. No implementa la imputación de edad o método desconocidos ni la entrada en meses que ofrece anthro.

Para edema acepta `SI`, `NO` o `DESCONOCIDO`. En el último caso, P_E, P_T e IMC_E se devuelven sin puntaje y con motivo `EDEMA_DESCONOCIDO`. Esto evita tratar un dato no capturado como si fuera una ausencia confirmada. T_E puede seguir calculándose.

La base actual de evaluaciones no guarda edema. Por ello, el motor aún no calcula resultados de los expedientes existentes. La integración deberá incorporar ese dato y definir el tratamiento de registros previos.

Las tablas cubren días 0–1826. Para la equivalencia con anthro se aplica su límite de menos de 60 meses usando el factor 30.4375 días. La captura de evaluaciones conserva su validación por quinto cumpleaños; son comprobaciones de capas distintas y deberán mantenerse documentadas.

Si falta una referencia o vecino de interpolación, el motor devuelve `REFERENCIA_AUSENTE`. Si la medida queda fuera de la cobertura de P_T, devuelve `TALLA_FUERA_DE_COBERTURA`. No extrapola. Un cero de puntaje es un resultado disponible, distinto de `null`.

## Cómo comprobarlo tú

Desde `backend`:

```bash
npm run test:nutrition
npm run nutrition:verify
```

La primera orden ejecuta siete pruebas del motor. Una compara los 500 casos oficiales ejecutados; las otras prueban límites matemáticos, redondeo, edema desconocido, datos faltantes, extremos, interpolación incompleta, entradas inválidas y conservación de la medición original.

La segunda orden:

1. Verifica los archivos de referencia contra sus huellas fijadas.
2. Lee los parámetros de MariaDB y comprueba íntegramente que coincidan con esos archivos.
3. Ejecuta los 500 casos usando esas referencias de la base.
4. Escribe el informe local con discrepancias, cantidades y versión. No escribe en la base.

## Cómo se obtuvieron los resultados esperados

`generate-anthro-oracle.mjs` ejecuta en R las fuentes oficiales sin modificarlas. Se cargan también las tablas auxiliares que necesita `anthro_zscores`; esas tablas auxiliares se usan solo para ejecutar la herramienta de contraste, no se importan a MariaDB.

Se utilizó WebR 0.5.8 con R 4.5.1. Está instalado únicamente en `work/anthro-oracle`, fuera de las dependencias de la aplicación. La cuadrícula cubre ambos sexos, ambos métodos, edades alrededor de transiciones y del límite superior, medidas ordinarias y extremas, y presencia/ausencia de edema. Se añaden 100 casos con un generador de semilla fija. Los 500 casos y sus salidas se conservan en `oracle-cases.json`.

Las doce salidas comparadas por caso son los cuatro puntajes, sus cuatro banderas, longitud/talla ajustada, IMC ajustado, método depurado y bandera de medición de pie por debajo de nueve meses. Para puntajes y banderas se exige una diferencia menor a 1e-9; para las medidas derivadas, menor a 1e-10. Las ausencias se comparan explícitamente como `null`.

Para regenerar los casos en otro equipo con Node.js, instala el entorno de comparación por separado:

```bash
npm install --prefix /tmp/nutritech-oracle webr@0.5.8 ws@8.18.3
WEBR_MODULE=/tmp/nutritech-oracle/node_modules/webr/dist/webr.mjs npm run nutrition:oracle
npm run test:nutrition
npm run nutrition:verify
```

El comando de generación reemplaza el archivo local de casos esperados. Las pruebas habituales no requieren instalar ni ejecutar R.

## Archivos para estudiar

- `backend/src/nutrition/calculator.ts`: preparación, selección de referencias y cálculo.
- `backend/src/nutrition/calculator.spec.ts`: pruebas del motor.
- `backend/src/nutrition/oracle.ts`: comparación con resultados esperados.
- `backend/scripts/generate-anthro-oracle.mjs`: ejecución reproducible del contraste en R.
- `backend/scripts/verify-nutrition.ts`: comparación con los parámetros de MariaDB.

La adaptación del motor está identificada como GPL-3.0-only y conserva atribución a anthro. Las fuentes oficiales conservan su autoría y la licencia del paquete, incluida en `database/references/anthro-1.1.0/COPYING-GPL-3`.

## Alcance de la verificación

La coincidencia se refiere a los casos y comportamientos enumerados; no constituye una validación clínica general. Aún faltan la captura de edema, integración con evaluaciones, selección y revisión de reglas de clasificación, persistencia de resultados y activación del patrón. El próximo paso es integrar los datos necesarios para usar el motor desde una evaluación sin asumir información ausente.
