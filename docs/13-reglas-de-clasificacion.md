# Paso 13: definir y revisar las reglas de clasificación

La propuesta contiene 20 reglas para cuatro indicadores. Está en estado `BORRADOR`: no clasifica expedientes, no guarda resultados en MariaDB ni activa alertas. La revisión técnica verifica cómo funcionan los intervalos; la revisión clínica del protocolo y de las etiquetas sigue pendiente.

## Dónde revisarla

Con una cuenta que tenga el permiso `patrones.gestionar`, abre **Configuración → Patrones nutricionales → Revisar propuesta**. Allí puedes consultar los intervalos de cada indicador, las fuentes y los pendientes. La API que entrega esta información es `GET /patrones/propuesta-clasificacion`.

## Cómo leer las reglas

`z` representa el puntaje calculado respecto a la referencia de crecimiento. El signo `<` excluye el límite y `≤` lo incluye. En los límites exactos, la tabla de crecimiento sitúa el valor en la categoría menos severa de las dos contiguas; por ejemplo, −3 exacto corresponde a emaciación, mientras que −3.001 corresponde a emaciación severa. Esto se aplica a esta propuesta de indicadores de crecimiento, sin establecer prioridades de atención. [OMS: interpretación de indicadores de crecimiento](https://www.ncbi.nlm.nih.gov/books/NBK148966/).

Estos intervalos corresponden a menores de cinco años dentro de la cobertura del motor OMS-2006. Las etiquetas en español son la propuesta del proyecto. [OMS EMRO: tabla de problemas de crecimiento, página impresa 24, página 26 del PDF](https://www.emro.who.int/images/stories/nutrition/Child-growth-monitoring-a-technical-guide-for-healtcare-professionals.pdf#page=26).

### Peso para la edad (`P_E`): 4 reglas

| Intervalo | Etiqueta propuesta |
| --- | --- |
| z < −3 | Bajo peso severo para la edad |
| −3 ≤ z < −2 | Bajo peso para la edad |
| −2 ≤ z ≤ +1 | Sin bajo peso según P_E |
| z > +1 | Interpretar con P_T o IMC_E |

### Talla para la edad (`T_E`): 4 reglas

| Intervalo | Etiqueta propuesta |
| --- | --- |
| z < −3 | Talla baja severa para la edad |
| −3 ≤ z < −2 | Talla baja para la edad |
| −2 ≤ z ≤ +3 | Sin talla baja según T_E |
| z > +3 | Talla muy alta: interpretar el contexto |

### Peso para la talla (`P_T`) e IMC para la edad (`IMC_E`): 6 reglas cada uno

| Intervalo | Etiqueta propuesta |
| --- | --- |
| z < −3 | Emaciación severa |
| −3 ≤ z < −2 | Emaciación |
| −2 ≤ z ≤ +1 | Dentro del intervalo central de este indicador |
| +1 < z ≤ +2 | Posible riesgo de sobrepeso |
| +2 < z ≤ +3 | Sobrepeso |
| z > +3 | Obesidad |

Peso para la edad no se usa aquí para determinar obesidad. Las etiquetas describen cada indicador: estar en su intervalo central no equivale a una evaluación integral del estado nutricional. Las notas por indicador forman parte de la revisión. [OMS: tabla 4 y notas](https://www.ncbi.nlm.nih.gov/books/NBK148966/table/session5.t1/?report=objectonly).

## Qué revisa el código

En `backend/src/nutrition/classification-draft.ts`, cada regla guarda un límite inferior y superior y dos indicadores de inclusión. Un límite `null` significa que ese extremo no está acotado. `validateDraft()` comprueba que cada indicador cubra los intervalos sin huecos, sin superposiciones, sin códigos repetidos dentro del indicador y sin límites inválidos.

Las pruebas recorren 80,004 combinaciones de indicador y puntaje entre −10 y +10, además de comprobar valores inmediatamente antes, sobre y después de los límites. Ese recorrido es una prueba matemática del catálogo, no una afirmación de que todos esos puntajes sean clínicamente utilizables. La función de prueba rechaza puntajes no disponibles y evita asignar una regla cuando hay banderas de calidad o un método que requiere revisión.

Una prueba demuestra por qué hace falta conservar la precisión: **−3.004 redondeado a dos decimales se convierte en −3.00**, lo cual cambiaría la categoría si se clasificara usando el número mostrado. En este paso el cálculo provisional todavía devolvía dos decimales. El cambio posterior documentado en `14-puntajes-sin-redondear.md` ya conserva el valor completo en el motor y la API. El catálogo continúa separado de los resultados mientras se completa la revisión clínica.

## Cómo repetir la revisión

Desde la carpeta `backend`:

```bash
npm run classification:review
npm test -- --runInBand classification-draft
```

El primer comando verifica el SHA-256 del PDF local contra `database/references/classification/manifest.json`, valida los intervalos y genera `rules-draft.json` y `review-report.json` en esa misma carpeta. No se conecta a la base de datos. El hash permite detectar cambios en el archivo respecto al manifiesto; no sustituye la revisión de su contenido.

El segundo comando ejecuta las pruebas específicas del borrador. En esta revisión también pasaron las 33 pruebas unitarias del backend, su comprobación de TypeScript y lint, y la compilación y lint del frontend. La integración con MariaDB no pudo repetirse desde este entorno: la comprobación de conexión devolvió `P1001`. El caso de prueba del endpoint y sus permisos queda pendiente de ejecución con la base accesible.

## Qué falta antes de aplicarlas

- Revisar etiquetas y protocolo aplicable con el responsable clínico del proyecto.
- Completado en el paso siguiente: conservar el puntaje sin redondear para las comparaciones.
- Definir el tratamiento de edema bilateral, datos fuera de cobertura y banderas de calidad.
- Definir por separado prioridades de atención y condiciones de alertas. Los colores de la interfaz no determinan esas prioridades.
- La integración de consulta ya se verificó en el paso siguiente; la futura persistencia y activación requerirán sus propias pruebas.

La propuesta entrega `activa: false`, `revision_clinica: PENDIENTE`, `nivel_revision: null` y `genera_alerta: false` para hacer visible este estado tanto en la API como en la pantalla.
