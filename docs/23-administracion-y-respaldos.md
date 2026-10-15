# Administración y respaldos

## Usuarios

En **Seguridad → Usuarios** puedes buscar por código o nombre, crear cuentas, asignar roles activos, cambiar nombres y estado y restablecer contraseñas. La creación y los cambios requieren `usuarios.ver`, `usuarios.gestionar` y `roles.gestionar`. Consulta de usuarios requiere `usuarios.ver`.

Las contraseñas se procesan con bcrypt; nunca se muestran ni se registran en auditoría. El mínimo es 12 caracteres y el máximo efectivo de bcrypt son 72 bytes UTF-8. Los cambios de acceso y contraseña revocan las sesiones anteriores. Al guardar una edición se exige un motivo y se comprueba que nadie haya cambiado la cuenta mientras estaba abierto el formulario.

La pantalla no permite modificar tu propia cuenta; para restablecer tu contraseña continúa disponible `npm run auth:reset-password`. Tampoco permite desactivar o retirar el rol de las cuentas administrativas existentes, evitando perder la administración. No elimina usuarios ni su historial.

## Roles y permisos

La pantalla permite consultar todos los permisos activos y cambiar los asignados a roles existentes. Cada cambio requiere motivo, controla ediciones simultáneas, registra auditoría y revoca las sesiones de los usuarios afectados. El rol ADMINISTRADOR y los roles asignados al propio editor están protegidos.

Las excepciones particulares de usuarios existentes siguen aplicándose: una denegación prevalece sobre el rol. Esta pantalla edita permisos por rol; no crea ni elimina roles y no administra excepciones particulares. Los permisos se comprueban en la API, además de controlar el menú.

## Menús

Se pueden editar nombre, orden, visibilidad y estado de opciones existentes. Las rutas y relaciones con permisos se mantienen vinculadas a las pantallas implementadas. No es un constructor de módulos nuevos. Se protege el acceso a la configuración del menú. Después de guardar, pulsa **Actualizar menú**.

Ocultar una opción no revoca acceso a su API: esa responsabilidad corresponde a los permisos.

## Auditoría

Lista paginada de operaciones con usuario, fecha de Guatemala, acción, entidad e identificador. Puedes filtrar por entidad. No entrega contraseñas ni los detalles clínicos contenidos en los campos de cambios de la base de datos. La auditoría no tiene acciones de edición ni borrado en la interfaz.

## Respaldos

En **Respaldos**, el usuario con `respaldos.gestionar` puede crear una copia cifrada. Se ejecuta `mariadb-dump` sin shell, con credenciales en un archivo temporal privado; no se pasan contraseñas como argumentos. Se incluyen tablas, datos, vistas, rutinas, eventos y triggers, utilizando una transacción consistente para InnoDB. No ejecutar migraciones o cambios de estructura mientras se genera una copia.

Los archivos se guardan fuera del directorio web: `database/backups/nutritech-ID.ntb`, con permisos privados. Formato NTB1: cabecera, nonce de 12 bytes, SQL cifrado con AES-256-GCM y etiqueta de autenticación de 16 bytes. La huella SHA-256 se guarda en `respaldos_bd`. La clave es `BACKUP_ENCRYPTION_KEY` (32 bytes hexadecimales) en el entorno del backend. Conserva una copia de esa clave **separada** de los archivos; no se puede recuperar el contenido sin ella. También conserva las claves originales de certificados y HMAC para una recuperación del sistema completo.

La interfaz muestra los últimos 50 registros y distingue la integridad del archivo de la restauración. No descarga el SQL ni ofrece restaurar sobre la base activa. Un bloqueo de archivo impide dos copias simultáneas. Si el servidor se apaga bruscamente, un administrador debe comprobar que no haya procesos de respaldo antes de retirar un bloqueo residual `.backup.lock`.

Desde `backend`:

```bash
npm run backup:create
npm run backup:verify -- ID
npm run backup:test-restore -- ID
```

La última orden autentica y descifra una copia a un directorio temporal privado, crea una base de nombre aleatorio, importa el SQL, consulta las tablas y vistas esperadas y elimina la base temporal. Requiere privilegios de crear y eliminar bases en el servidor de ensayo. Adapta únicamente las referencias de las vistas al nombre temporal; no reescribe los INSERT de datos. Registra el resultado satisfactorio en auditoría. **No restaura ni reemplaza la base de uso diario**.

La comprobación de restauración cubre importación SQL y consultas de tablas/vistas; no prueba por sí sola recuperación del servidor, certificados, archivos de respaldo externos ni todos los flujos funcionales sobre la copia. Para una recuperación real se debe acordar un destino aislado y conservar las claves originales antes de conectar la aplicación.

Referencia: [manual de mariadb-dump](https://mariadb.com/docs/server/clients-and-utilities/backup-restore-and-import-clients/mariadb-dump).
