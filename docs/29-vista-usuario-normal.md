# Vista de Usuario normal

> Actualización: el flujo vigente es la consulta sin expediente descrita en `30-consulta-sin-expediente.md`. El flujo de captura asociado a un niño que se describe abajo corresponde a la primera versión.

La cuenta cuyo único rol es `USUARIO_NORMAL` entra directamente a una vista propia, inspirada en la referencia visual proporcionada: cabecera NutriTech, Inicio e Información, presentación, captura y resultados. Las cuentas con varios roles conservan el espacio de trabajo general. El administrador dispone del botón «Ver vista de Usuario normal»; esta previsualización conserva sus permisos y autoría, no suplanta a otro usuario.

## Flujo y decisiones

1. Buscar un niño activo por nombre o expediente.
2. Completar la medición y guardarla. Se conservan la fecha, el centro, el método de medición y el dato de edema del formulario existente. La edad se calcula desde la fecha de nacimiento registrada, en lugar de pedir años redondeados.
3. El sistema obtiene y guarda la orientación mediante el motor existente, con sus fuentes y versiones. Muestra cada indicador por separado, recomendaciones y avisos. No muestra un resultado «Normal» antes de calcular ni convierte varios indicadores en una conclusión única.
4. Generar un reporte de la orientación y usar la opción de impresión del navegador para guardarlo como PDF.
5. Iniciar otra evaluación con «Nueva evaluación».

Cambiar entre Inicio e Información conserva el formulario. Recargar la página reinicia la vista; los registros guardados permanecen en la base. Esta entrega no añade un archivo personal de evaluaciones.

Se mantiene el flujo de expedientes existentes. No se añadió una calculadora pública ni un vínculo de parentesco entre usuarios y niños. La decisión clínica sigue correspondiendo al profesional y los resultados conservan el carácter orientativo del motor actual.

## Acceso

La captura usa `ninos.buscar` y `evaluaciones.crear`; el reporte requiere además `reportes.generar` y `alertas.ver`. No se modifican permisos del rol ni tablas de la base de datos.

Los nuevos endpoints de `/mi-portal` comprueban que la evaluación fue registrada por la cuenta autenticada. La consulta del reporte comprueba también quién lo generó. Con ello el usuario puede obtener resultados de su captura sin recibir acceso al historial general mediante `evaluaciones.ver`.

## Implementación y verificación

- `UserPortal.tsx` y `user-portal.css`: presentación y navegación.
- `UserResult.tsx`: orientación, reintento si falla la consulta y reporte.
- `Evaluaciones.tsx` y `Reports.tsx`: reutilización del formulario y generador existentes.
- `user-portal.module.ts`: autorización por autoría en el backend.
- Frontend: compilación de producción y lint correctos.
- Backend: TypeScript y lint de los cambios correctos; 64 pruebas unitarias y 20 pruebas de integración de evaluaciones aprobadas. La nueva prueba usa el rol normal y comprueba autoría, permisos, sesión, CSRF y repetición sin duplicar orientación.
- Revisión visual de la pantalla inicial mediante un render estático del componente real con un perfil ficticio. La sesión del navegador estaba cerrada; no se completó en esta revisión el recorrido interactivo con una cuenta normal ni la descarga de PDF. Los archivos temporales de revisión fueron eliminados.
