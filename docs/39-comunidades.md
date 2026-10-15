# Administración de comunidades

Pantalla disponible en el menú con permiso `comunidades.gestionar`. Permite buscar por nombre o municipio, crear, editar y activar/desactivar. Se muestran hasta 100 coincidencias con aviso para acotar la búsqueda. Desactivar no elimina expedientes y la consulta existente de comunidades activas excluye esas opciones de nuevos registros.

API: GET/POST /admin/comunidades y POST /admin/comunidades/:id. Validación de longitudes y espacios, permiso específico, restricción de duplicados por ubicación, bloqueo de fila y revisión SHA-256 contra ediciones concurrentes; cambios y auditoría en una transacción. No agrega tablas ni elimina datos existentes.

Habilitación reproducible desde backend: `node scripts/enable-communities.cjs`. Se ejecutó en la base local y asignó el permiso al rol ADMINISTRADOR. Se requiere renovar la sesión para actualizar los permisos visibles. Si el servidor corre con dist/main, compilar y reiniciarlo; si corre con start:dev, comprobar su recarga.

Validación: seis pruebas de integración de administración con MariaDB aprobadas, incluida creación/edición, validación, duplicados, conflicto concurrente, auditoría y rechazo sin sesión/sin permiso. TypeScript y ESLint del backend, build y lint frontend aprobados. Datos ficticios de pruebas eliminados. No se realizó verificación visual autenticada ni se reinició el servidor existente desde esta sesión.
