# Referencia de peso mientras se completan las medidas

Fecha de verificación: 7 de octubre de 2026.

## Recorrido

La consulta rápida y la evaluación de un niño registrado muestran una referencia de peso al disponer de fecha de nacimiento, fecha de medición y sexo. En la evaluación registrada, los datos del expediente se toman automáticamente.

La tarjeta presenta el valor central y la franja de referencia por edad y sexo. Al escribir el peso medido, indica si está dentro, por debajo o por encima de esa franja. Si está dentro de la franja pero por debajo del valor central, explica que eso no significa automáticamente tener bajo peso.

El peso se escribe a partir de la báscula: la referencia nunca rellena ni reemplaza esa medida. Volver al paso anterior conserva lo escrito; seleccionar otro niño en la captura registrada limpia las medidas para evitar mezclarlas.

## Datos y límites

- Se reutiliza la consulta autenticada de crecimiento y las referencias OMS ya importadas. La referencia depende de la edad exacta en días y el sexo; no se envían identificadores de niños a servicios externos.
- Las fechas inválidas, invertidas o futuras ocultan la referencia anterior. También se evita mostrar una respuesta que pertenezca a otra selección de edad o sexo.
- La franja corresponde a −2 y +2 desviaciones estándar de peso para la edad. El valor central es la mediana, no una meta individual. Fuente: [OMS, peso para la edad](https://www.who.int/tools/child-growth-standards/standards/weight-for-age).
- La comparación conserva la precisión de los valores recibidos, aunque se muestran dos decimales.
- Si se indica hinchazón presente en ambos pies, se muestra la necesidad de revisión profesional en lugar de interpretar el peso ingresado. La tarjeta es una comparación de referencia; la evaluación completa conserva sus controles de talla, edema y calidad de datos.
- Consultar esta tarjeta no guarda una evaluación ni genera un reporte. No se modificaron el esquema de MariaDB ni las reglas clínicas.

## Comprobaciones realizadas

- Frontend: compilación, lint y cinco pruebas automatizadas de fechas, zona horaria de Guatemala, límites, precisión y datos inválidos.
- Backend: comprobación de tipos y lint del servicio modificado. La búsqueda de niños ahora incluye el sexo para seleccionar la referencia correspondiente.
- Navegador: cuentas temporales de usuario normal y administrador; referencia automática, cambios de sexo y fecha, comparación del peso, conservación al volver atrás, tratamiento de hinchazón y limpieza al seleccionar otro niño.
- No se guardaron mediciones durante la prueba. Se eliminaron las dos cuentas, los dos expedientes y el centro ficticio usados para verificar el recorrido.
- La revisión visual de esta entrega se realizó en escritorio; queda pendiente una comprobación específica en móvil.

Se verificó el funcionamiento local de MariaDB, el backend en el puerto 3017 y el frontend en el puerto 5173. Los pendientes generales de la aplicación siguen descritos en [la revisión del proyecto](43-revision-general-y-pendientes.md).
