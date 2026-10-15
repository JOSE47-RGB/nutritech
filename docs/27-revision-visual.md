# Revisión visual autenticada — 18 de septiembre de 2026

## Recorrido realizado

Se utilizó la sesión administrativa abierta en el navegador local, sin crear cuentas, modificar permisos, guardar orientaciones, anular evaluaciones ni generar respaldos.

- Dashboard: conteos, fecha de consulta, enlaces y distribución de tarjetas en el ancho disponible del navegador.
- Expedientes: listado, filtros y apertura del detalle con responsables.
- Evaluaciones: historial, consulta de cálculo provisional con respuesta visible, presentación de indicadores y recomendaciones.
- Anulación: apertura del formulario, motivo requerido, confirmación deshabilitada con motivo vacío y cancelación sin cambios.
- Captura de evaluación: apertura de la pantalla de búsqueda de niño; no se registró una medición.
- Alertas: bandeja y estado vacío para el filtro pendiente.
- Reportes: archivo vacío y navegación.
- Usuarios: listado y apertura/cancelación del formulario de nueva cuenta.
- Roles: listado de roles y conteos de permisos.
- Menús: carga del editor de nombres, orden, visibilidad y estado, sin guardar.
- Auditoría: carga de operaciones y paginación.
- Respaldos: visualización de registros existentes con integridad verificada.
- Patrones: carga de referencias, conteos y estado del catálogo.

## Correcciones

La pestaña del navegador ahora muestra el nombre del módulo seleccionado. Fuera de una sesión muestra «NutriTech | Iniciar sesión». Se retiraron mensajes de bienvenida y menú que presentaban módulos ya implementados como futuros.

Se actualizaron los textos de patrones, propuesta de clasificación e historial para distinguir consulta provisional, guardado de orientaciones y generación de avisos. No se cambiaron reglas clínicas ni el estado del catálogo.

Compilación y ESLint del frontend aprobados después de los cambios. El título y los textos corregidos se verificaron en el navegador.

## Límites

Este recorrido es de navegación y lectura sobre la sesión existente. No constituye una prueba visual completa de altas/ediciones, exportación PDF, todas las resoluciones ni todos los roles. No había reportes guardados que abrir; no se generó uno sobre datos existentes para esta revisión. Los flujos de escritura y permisos se verificaron previamente con datos ficticios en integración (60 pruebas). No se almacenaron capturas con información personal en la documentación.

## Ensayo posterior: generación y reapertura del reporte

Se preparó un expediente temporal identificado como PRUEBA REPORTE FICTICIO y un centro ficticio. Se generó su orientación y un aviso con el motor existente. Desde la interfaz se generó el reporte, se inspeccionaron sus secciones y se volvió a abrir desde Reportes. Se verificaron identificación ficticia, mediciones, orientación, ausencia explícita de valoración médica, alerta con historial y fuentes. No se creó una valoración médica ficticia atribuida a un profesional.

El botón Imprimir / Guardar como PDF se pulsó, pero el navegador integrado no mostró un diálogo observable; no se verificó la exportación PDF ni su paginación. No se detectaron errores en el registro de consola consultado, lo cual no prueba que la impresión se haya ejecutado.

Se conservó el HTML exacto del reporte en `qa/reporte-ficticio.html`, comprobando previamente su SHA-256 contra el archivo registrado en la base. Después se retiraron únicamente el expediente, evaluación, orientación, alerta, reporte, centro y auditorías exclusivas de este ensayo. Los registros reales permanecieron intactos.

Para finalizar la comprobación de impresión, abrir ese HTML local en Firefox o Chrome, pulsar Ctrl+P, seleccionar A4 y revisar las páginas antes de guardar como PDF. La copia HTML no requiere iniciar sesión ni conectarse a la base. Este paso sigue pendiente de ejecución en un navegador con diálogo de impresión accesible.
