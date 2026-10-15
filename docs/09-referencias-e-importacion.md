# Paso 9: referencias oficiales e importación verificable

## Resultado de la preparación

Se descargaron cinco tablas originales del repositorio de la Organización Mundial de la Salud, paquete `anthro` versión **1.1.0**, etiqueta `v1.1.0`, commit fijo `80c8db44575425463423ed07bddfd79a3a3301b9`. Esta es la versión del paquete de distribución; el patrón de destino continúa siendo **OMS-2006**.

La simulación contra la base de NutriTech resultó `LISTO_PARA_IMPORTAR`. En este paso no se cargaron parámetros en el patrón real ni se lo activó. La prueba de escritura se realizó en un patrón temporal independiente y retiró todos sus datos al terminar.

## Procedencia

La [página oficial de herramientas de la OMS](https://www.who.int/tools/child-growth-standards/software) enlaza el [paquete anthro en CRAN](https://cran.r-project.org/web/packages/anthro/index.html), que identifica el [repositorio WorldHealthOrganization/anthro](https://github.com/WorldHealthOrganization/anthro) y la versión usada. Las URL de descarga de cada archivo están fijadas al commit, no a una rama que cambie.

`database/references/anthro-1.1.0/manifest.json` registra las URL, fecha de descarga, tamaños y huellas SHA-256. Los archivos originales se conservan sin modificar. Se incluye `DESCRIPTION` con autoría y licencia GPL-3, el texto de esa licencia y `growthstandards.R` como referencia de la organización de datos del paquete. NutriTech no ejecuta ese código R.

Las huellas del importador están fijadas en `backend/scripts/anthro-lock.json`. Detectan diferencias respecto de los bytes descargados desde la fuente identificada; no son una firma digital de la OMS. Actualizar la versión requiere revisar la procedencia y actualizar deliberadamente archivos, huellas y pruebas.

## Correspondencia con tu base

| Archivo original | Indicador | Tabla destino | Cobertura en ambos sexos | Filas |
| --- | --- | --- | --- | ---: |
| `weianthro.txt` | P_E | `parametros_lms_edad` | Días 0–1826, paso 1 | 3654 |
| `lenanthro.txt` | T_E | `parametros_lms_edad` | Días 0–1826, paso 1 | 3654 |
| `bmianthro.txt` | IMC_E | `parametros_lms_edad` | Días 0–1826, paso 1 | 3654 |
| `wflanthro.txt` | P_T, longitud acostado | `parametros_lms_talla` | 45.0–110.0 cm, paso 0.1 | 1302 |
| `wfhanthro.txt` | P_T, talla de pie | `parametros_lms_talla` | 65.0–120.0 cm, paso 0.1 | 1102 |

Total: **10,962 referencias por edad + 2,404 por talla = 13,366 filas**. Las coberturas se comprobaron directamente en los archivos descargados. La disponibilidad de referencias hasta 1826 días no cambia la regla de captura de evaluaciones anterior al quinto cumpleaños.

Según la [documentación de anthro](https://cran.r-project.org/web/packages/anthro/refman/anthro.html), sexo 1 corresponde a masculino y 2 a femenino. Se transforman a `M` y `F`. Los coeficientes `l`, `m`, `s` pasan a `valor_l`, `valor_m`, `valor_s` como cadenas decimales exactas compatibles con `DECIMAL(14,8)`, sin redondeo.

Las tablas de longitud/edad e IMC/edad incluyen `loh`: `L` hasta el día 730 y `H` desde el 731. El importador verifica ese contenido. Tu tabla por edad no tiene una columna para `loh`; el original se conserva y el futuro motor deberá respetar esa transición y las reglas de ajuste de medición descritas por anthro. En esta fase no se ajustan medidas ni se calculan puntajes.

## Qué verifica el importador

1. SHA-256 de cada una de las cinco tablas contra el archivo de bloqueo.
2. Encabezados y número de columnas exactos.
3. Sexo, método, valores numéricos y precisión; M y S positivos.
4. Claves únicas y cobertura completa por sexo, con los pasos indicados arriba.
5. Patrón existente, inactivo y sin resultados asociados; cuatro indicadores activos con ejes y variables compatibles.
6. Destino vacío o una carga completa idéntica. Una carga parcial, extra o diferente se rechaza sin sobrescribirla.
7. Al aplicar, escritura por lotes en una sola transacción, con bloqueo del patrón y lectura posterior de todas las claves y coeficientes.
8. Auditoría con commit, hashes y cantidades. Si falla cualquier paso, se revierte toda la escritura. Un reintento idéntico devuelve `YA_COINCIDE` sin duplicar datos o auditoría.

No se añaden reglas de clasificación ni se activa el patrón. Los límites de alertas y su correspondencia con el protocolo del proyecto requieren un paso específico; las tablas LMS por sí solas no resuelven esa configuración.

## Comandos, desde la carpeta backend

Verificar los archivos sin conectarse a MariaDB:

```bash
npm run references:verify
```

Simular la importación: consulta la base y no escribe en ella.

```bash
npm run references:plan
```

Aplicar la carga preparada en OMS-2006, cuando se decida ejecutarla:

```bash
npm run references:import
```

Después de aplicar, vuelve a **Configuración → Patrones nutricionales → Actualizar datos**. Aparecerán los conteos anteriores; el patrón seguirá inactivo y sin nuevas reglas.

El importador utiliza `DATABASE_URL` del `.env` existente. No pide ni imprime la contraseña. Un parámetro desconocido en la línea de comandos se rechaza para evitar ejecutar un modo distinto por un error de escritura.

## Pruebas realizadas

```bash
npm run test:references
npm run test:references:db
```

La primera orden ejecuta cinco pruebas sin base y omite la de integración. La segunda ejecuta las seis, incluyendo la prueba en MariaDB. Se comprobaron archivos alterados, duplicados, huecos, números inválidos, precisión excesiva, métodos inconsistentes, simulación sin cambios, rollback ante fallo de auditoría, comparación completa, reintento, patrón activo y conflicto con datos existentes.

El informe de la simulación realizada está en `database/references/anthro-1.1.0/import-plan.json`. Es una fotografía de esta ejecución; `references:plan` vuelve a verificar el estado actual.

## Conceptos para tu proyecto de graduación

**Procedencia** permite explicar de dónde salieron los datos. **SHA-256** permite comprobar que los archivos siguen siendo los mismos. **Validación estructural** comprueba que las filas se pueden interpretar y guardar. **Transacción** evita una carga incompleta. **Idempotencia** permite repetir una operación sin duplicar su resultado.

Estas verificaciones prueban la fidelidad de esta importación. La validación del futuro cálculo nutricional necesitará además casos comparados contra la herramienta oficial, tratamiento de medidas y selección documentada de reglas.
