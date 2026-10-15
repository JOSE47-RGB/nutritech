# Paso 22: reportes de evaluación y seguimiento

## Cómo usarlo

1. Abre un expediente y su historial de evaluaciones.
2. En una orientación guardada, pulsa **Generar reporte imprimible**.
3. Revisa el documento y pulsa **Imprimir / Guardar como PDF**. El navegador ofrece la impresora o la opción de guardar como PDF.
4. En **Reportes** puedes volver a abrir las copias generadas. El listado tiene páginas de 20 reportes; el contenido incluye todas las valoraciones y todo el seguimiento disponibles al generarlo.

Se requieren los permisos `reportes.generar`, `evaluaciones.ver` y `alertas.ver`. La API comprueba los tres, aunque se intente acceder directamente.

## Qué estamos aprendiendo

Un reporte es una copia conservada: se prepara dentro de una transacción y se guarda como HTML en MariaDB. Incluye identificación, medición, orientación automática, recomendaciones, fuentes, valoraciones médicas y alertas con su historial. La fecha se muestra en horario de Guatemala. La identificación del paciente y del centro corresponde al momento de generación; las mediciones y la orientación se toman de la orientación guardada.

Si luego se añade una valoración o cambia una alerta, el reporte anterior permanece igual. Para reflejar el cambio se genera otro reporte. No se recalculan categorías al imprimir: los puntajes se presentan con dos decimales y se conserva la clasificación obtenida con la precisión completa.

La orientación del sistema y la valoración del médico aparecen por separado. La ausencia de valoraciones o alertas se indica expresamente. Una evaluación anulada muestra su estado. El reporte no es una notificación oficial al MSPAS ni contiene una firma digital certificada.

## Archivo y controles

- Cada reporte conserva código, autor, fecha, orientación de origen, HTML y huella SHA-256.
- Se verifica la huella antes de entregarlo. Esto detecta discrepancias con el contenido guardado, pero no equivale a una firma certificada ni protege frente a alguien que pueda modificar contenido y huella a la vez.
- Generación y consulta se registran en auditoría. La respuesta evita caché y requiere sesión.
- Una misma solicitud del mismo usuario devuelve el mismo reporte: los reintentos no crean duplicados. Reutilizarla con otra evaluación se rechaza.
- Los textos se escapan para impedir que se interpreten como etiquetas o scripts. El visor utiliza un iframe aislado sin permisos de scripts; las fuentes se muestran como texto.
- Un reporte vencido o con una huella incorrecta no se entrega.

El servidor archiva HTML, no un PDF. El PDF se obtiene con la impresión del navegador y no se carga automáticamente de vuelta a NutriTech.

## Base de datos

La migración `database/migrations/006-reportes-imprimibles.sql` agrega soporte HTML, orientación de origen, identificador de solicitud y contenido, conservando los registros anteriores. Ya se aplicó en el entorno local.

Para otro entorno con las migraciones anteriores aplicadas, desde `backend`:

```bash
npm run db:migrate:reports
npm run db:generate
```

El script evita repetir una migración completa y detiene la ejecución si detecta una aplicación parcial.

## Verificación

- 64 pruebas unitarias aprobadas, incluidas precisión de presentación, escape de HTML e historiales largos.
- 17 pruebas de integración de evaluaciones aprobadas: generación concurrente sin duplicados, permisos, protección CSRF, copia inmutable, inclusión de más de 20 valoraciones y rechazo de contenido alterado.
- Compilación y análisis estático del backend y frontend aprobados.
- Presentación en pantalla revisada con datos ficticios. La paginación del PDF y el diálogo de impresión dependen del navegador y no se verificaron mediante una exportación PDF automatizada.
