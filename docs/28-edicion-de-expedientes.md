# Edición de datos generales del expediente

## Uso

En **Listado de niños → Ver expediente → Editar datos generales**, corrige nombres, apellidos o dirección. Selecciona el estado y escribe un motivo de 5–500 caracteres. Guarda para confirmar o cancela para descartar el formulario.

El listado muestra activos inicialmente. Para localizar un expediente inactivo o archivado, cambia el filtro Estado. Desde su detalle puedes volver a activarlo. Archivar no elimina mediciones, orientaciones, responsables ni reportes; impide nuevas capturas mientras el expediente no esté activo.

Requiere `ninos.ver` y `ninos.editar`. Los controles de acceso se aplican también en la API `POST /ninos/:codigo/editar`.

## Qué estamos aprendiendo

Cada edición envía `version_registro`. El servidor bloquea la fila dentro de una transacción, compara esa versión con la actual, guarda los cambios e incrementa la versión. Si alguien guardó mientras el formulario estaba abierto, responde 409 y pide cancelar, actualizar y revisar antes de reintentar. Esto evita sobrescribir cambios ajenos.

La misma transacción registra usuario, valores anteriores, nuevos valores y motivo en auditoría. El certificado cifrado no se consulta ni se modifica durante la edición. Los campos opcionales vacíos se guardan como nulos para permitir retirar un segundo nombre o dirección incorrectos.

## Límites deliberados

Este formulario no cambia certificado, comunidad, fecha de nacimiento ni sexo biológico. Corregir los dos últimos requiere un procedimiento que considere las edades y orientaciones históricas; no deben cambiarse silenciosamente. Los reportes ya generados conservan los datos de su fecha de creación. Nuevos reportes toman la identificación vigente al generarlos.

No requiere migración: utiliza las columnas `version_registro` y `archivado_en` existentes. Las capturas de evaluación ya bloquean la misma fila del niño y exigen estado activo, coordinándose con el archivo/reactivación.

## Verificación

- 15 pruebas de integración de expedientes aprobadas con MariaDB, incluida la nueva prueba de permisos, CSRF, motivo vacío, rechazo de campos no editables, doble guardado concurrente, auditoría y reactivación.
- TypeScript y ESLint del backend aprobados.
- Compilación y ESLint del frontend aprobados.
- Las operaciones de prueba usan expedientes ficticios que se limpian al terminar. No se editaron expedientes reales para comprobar esta función.
