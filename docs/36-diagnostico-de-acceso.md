# Diagnóstico del acceso y restablecimiento verificable

29/09/2026

Se comprobó que el frontend y el backend usan las carpetas de este proyecto. El servidor volvió a responder tras un apagado anterior. En la revisión posterior, el error visible fue de credenciales y la cuenta afectada tenía cinco intentos fallidos y bloqueo temporal. No figuraba un restablecimiento reciente mediante el comando en la auditoría consultada. No se confirmó todavía la causa por la que el cambio informado no aparecía en esa base.

Cambios:
- El envío del formulario de acceso lee `FormData` para usar los valores actuales de los controles, incluyendo autocompletado. No recorta ni transforma la contraseña.
- El script de restablecimiento resuelve `.env` relativo a la carpeta del backend y permite indicar el código como argumento.
- Antes de solicitar la contraseña muestra proyecto, base de datos y cuenta; nunca muestra credenciales de conexión ni hashes.
- Después de guardar verifica la contraseña con bcrypt y comprueba intentos a cero y bloqueo eliminado. Emite un comprobante `VERIFICADO` con cuenta y fecha solo si todas esas comprobaciones pasan.
- Se conserva la revocación de sesiones anteriores y la política de bloqueo. No se modificó la contraseña del usuario desde el asistente.

Pruebas: 17 pruebas de autenticación con MariaDB aprobadas. La nueva prueba usa una cuenta sintética: sesión anterior → bloqueo → restablecimiento → sesión antigua revocada → contraseña antigua rechazada → nueva contraseña aceptada y perfil disponible. Frontend compilado y lint aprobado.

Pendiente: confirmación del comprobante del restablecimiento ejecutado por el usuario y de su acceso real. No confundir el éxito de la prueba sintética con el acceso confirmado de la cuenta real.


## Confirmación del intento de restablecimiento

El usuario compartió la salida del comando: la validación rechazó la contraseña por longitud, límite de bytes o confirmación diferente. Ese intento no guardó una contraseña nueva; el mensaje combinado no permite identificar cuál de las tres condiciones falló.

El script ahora distingue cada causa y permite repetir la entrada sin reiniciar el comando. Conserva la validación antes de modificar la cuenta. Se verificaron límites, bytes UTF-8 y confirmación exacta mediante `node --test scripts/reset-password.test.cjs`. Falta que el usuario complete la entrada privada y obtenga el comprobante VERIFICADO; luego debe comprobar su inicio de sesión.
