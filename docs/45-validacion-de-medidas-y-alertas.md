# Medidas diferentes, comprobación y alertas

Verificado el 8 de octubre de 2026.

## Qué cambia para el usuario

El resultado identifica la medida que activa la revisión. En el ejemplo de un recién nacido con 4 kg y 30 cm, se muestra «Revisar la longitud/talla: 30 cm». El mensaje explica que una medida extrema puede ser real y pide repetirla; no afirma que el usuario se equivocó.

La pantalla ofrece dos pasos: comprobar fechas, unidades y medición; si la medida se confirma, conservar el valor real y solicitar valoración profesional. El botón «Revisar los datos ingresados» permite volver al formulario sin perderlos. No se reemplazan medidas por una mediana ni se cambia una bandera de calidad al confirmar un dato.

La revisión de hinchazón (edema) tiene un estado explícito. «Desconocido» significa pendiente, no que el niño tenga hinchazón. Si se indicó edema presente, la recomendación de valoración médica mantiene la prioridad aunque existan avisos sobre las medidas.

## Distinciones que conserva el sistema

- **Tamaño diferente que puede evaluarse:** utiliza las reglas existentes por edad, sexo e indicador. Una talla baja puede generar orientación de crecimiento sin tratarse como error de captura.
- **Medida que activa una bandera de calidad:** informa qué variable necesita confirmación antes de interpretar el resultado. No convierte automáticamente el valor extremo en un diagnóstico.
- **Falta de cobertura de una tabla:** explica que la comparación de peso para longitud/talla tiene un intervalo disponible. Estar fuera de ese intervalo no significa que el niño deba medir dentro de él; el sistema no extrapola la tabla.

Se mantienen el motor, sus límites de calidad, las clasificaciones y las validaciones de captura existentes. Esta entrega mejora la explicación y el seguimiento de sus resultados; no añade una evaluación de edad gestacional ni corrige automáticamente la edad por prematuridad.

Fuente de la distinción entre medida extrema, posible error y repetición de la medición: [manual oficial OMS Anthro, secciones 1.3 y 3.4.2](https://www.who.int/docs/default-source/child-growth/child-growth-standards/software/anthro-pc-manual-v322.pdf). La redacción de los pasos para la familia es una adaptación de NutriTech.

## Pantalla, reporte y seguimiento

La guía familiar versión 3 contiene el estado de edema y avisos estructurados de revisión. La pantalla compartida los presenta tanto en la consulta temporal como en resultados de evaluaciones registradas. Los reportes temporales y los nuevos reportes guardados incluyen la medida concreta y el paso a seguir si se confirma.

Al guardar una orientación, la política de seguimiento versión 2 también conserva los avisos de medidas cuando el edema está pendiente. La clave de cada aviso evita duplicarlo dentro de la misma orientación. No se reescriben orientaciones ni reportes históricos; las guías anteriores siguen siendo compatibles. La consulta temporal no crea historial ni alertas persistentes.

## Verificación

- 27 pruebas unitarias focalizadas en cálculo del servicio, guía familiar, comprobación de medidas, política de alertas y reporte guardado.
- 10 pruebas del frontend, incluidas alertas antiguas, edema desconocido/presente, reporte temporal y escape de contenido HTML.
- 23 pruebas de integración con MariaDB: incluye conservar 30 cm en una evaluación, guardar avisos con edema pendiente y verificar que una repetición no los duplica. Los registros de prueba se limpiaron al terminar.
- Tipos y lint del backend modificado; compilación y lint del frontend.
- Navegador: consulta temporal del ejemplo, reporte para la familia, vuelta al formulario conservando valores y caso de menor talla que recibe orientación sin bandera de captura. Las consultas de navegador no se guardaron en un expediente.

Los pendientes generales siguen en [la revisión del proyecto](43-revision-general-y-pendientes.md).
