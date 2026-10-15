# Consulta sin expediente

Por solicitud del autor, la vista de Usuario normal muestra un formulario directo, sin buscar ni registrar niños. Se introducen fecha de nacimiento, fecha de medición, sexo, peso, longitud/talla, método y edema (por defecto desconocido). La edad se obtiene en días; las fechas permanecen en el navegador y el servidor recibe edad y mediciones.

`POST /mi-portal/consulta` requiere sesión, CSRF y `evaluaciones.crear`. Reutiliza la verificación de las referencias y el motor existente. No crea niños, evaluaciones, orientaciones, alertas ni reportes en la base. Las reglas y recomendaciones clínicas no se modificaron. Los avisos se muestran en pantalla y en el reporte; no se convierten en alertas de seguimiento.

El botón Generar reporte / PDF prepara un documento HTML en memoria con medidas, fecha de medición, resultados, fuentes y versiones. El visor existente permite imprimir o guardar como PDF desde el navegador. Se identifica como consulta informativa sin expediente. No es un reporte archivado ni contiene valoraciones médicas; al cerrar o recargar se pierde la consulta. No hay cambios de esquema ni ampliación de permisos.

La prueba de integración añadida usa el rol normal sin permiso de búsqueda, comprueba validaciones, sesión, CSRF, edema presente/desconocido y que los conteos de las cinco tablas clínicas permanecen iguales. Las 21 pruebas de integración de evaluaciones pasaron. Frontend y backend compilan; lint de los cambios correcto.

Verificación en navegador con sesión de Usuario normal: formulario, cálculo con datos ficticios (730 días, sexo F, 12 kg, 85 cm), cuatro indicadores, apertura y revisión visual del reporte HTML, cierre y Nueva evaluación. El formulario quedó vacío después de la prueba. No se ejecutó la descarga de PDF del diálogo de impresión. Las 64 pruebas unitarias del backend también pasaron.

## Registro opcional desde el resultado

El botón adicional «Guardar / Registrar» inicia un flujo explícito de dos pasos. La consulta y el reporte sin expediente continúan disponibles sin persistir información clínica.

1. Crear expediente mediante el formulario existente: certificado, nombres, apellidos, nacimiento, sexo y datos opcionales de ubicación. Nacimiento y sexo se precargan desde la consulta y se pueden corregir.
2. Guardar evaluación para ese expediente: peso, talla, método y edema se precargan; el usuario confirma centro y fecha/hora real. No se inventa una hora para la consulta que solo tenía fecha. El cálculo se vuelve a ejecutar con el expediente guardado y después se guarda la orientación y se generan las alertas correspondientes mediante el flujo existente. El resultado permite generar un reporte archivado según los permisos actuales.

El expediente se guarda en el primer paso. Cancelar antes no guarda nada; una vez creado permanece aunque se cierre la página antes del segundo paso. El estado de la pantalla distingue esta situación. El certificado conserva la protección contra duplicados del servicio original.

Los endpoints de creación `/mi-portal/ninos` y catálogo `/mi-portal/ninos/comunidades` requieren sesión, `evaluaciones.crear` y `ninos.buscar`, y reutilizan NinosService. Esta es una capacidad adicional explícita del portal solicitada por el autor. No se concedió acceso al listado general, edición o eliminación ni se modificaron roles en la base. No requiere migración.

Verificación: compilación de frontend/backend y lint correctos; 22 pruebas de integración aprobadas, incluyendo el rol normal, validación, sesión/CSRF, rechazo de certificado duplicado, autoría del registro, guardado de medición y orientación y denegación sin los permisos requeridos. Los datos de prueba de integración se eliminan al finalizar.
