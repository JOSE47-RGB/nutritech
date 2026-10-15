# Manual de uso de NutriTech

## Iniciar sesión

Abre http://localhost:5173 con los servicios de desarrollo encendidos. Utiliza tu código de acceso y contraseña de NutriTech, no las credenciales de MariaDB. La contraseña no se puede consultar: está almacenada mediante bcrypt. Si la olvidaste, desde `backend` ejecuta `npm run auth:reset-password`. Un administrador también puede restablecer la de otra cuenta desde Usuarios. Al cambiarla se cierran las sesiones previas.

## Trabajo con expedientes

En Listado de niños busca el expediente antes de registrar uno nuevo. Registrar niño captura identidad y fecha de nacimiento. Abre el detalle para consultar los datos y gestionar responsables. **Editar datos generales** permite corregir nombres, apellidos, dirección y estado, con motivo obligatorio. Para reactivar un expediente archivado, búscalo con el filtro de estado correspondiente. Fecha de nacimiento, sexo, comunidad y certificado no se modifican desde ese formulario. El menú depende de los permisos de cada cuenta.

## Evaluación y seguimiento

1. En Capturar peso y altura, selecciona niño y centro, fecha, peso, longitud/talla, método, lugar y estado observado de edema. Desconocido es una opción válida si no se evaluó.
2. Al guardar se calculan la orientación y sus avisos. En Historial de evaluaciones revisa el resultado de ese niño. La presentación a dos decimales no cambia el valor completo usado para la orientación.
3. Las orientaciones guardadas conservan contenido, fuentes y versiones. La valoración médica se registra por separado con el permiso correspondiente.
4. En Alertas abre el aviso y documenta el seguimiento. Atendida o descartada son estados de gestión, no diagnósticos.
5. Desde una orientación guardada genera el reporte. Puedes imprimirlo o elegir Guardar como PDF en el navegador. Los documentos anteriores conservan el contenido de su fecha de generación.
6. Dashboard resume el trabajo, sin filtro de fecha y con acceso condicionado a los permisos de cada módulo.

## Tabla de Inicio y gráfica de crecimiento

Inicio muestra **Peso y talla según la edad**. Cambia entre Niño y Niña para consultar referencias OMS y pulsa **Ver todos los meses** si necesitas más edades. Son valores centrales de referencia, no un peso ideal obligatorio.

La pestaña **Gráfica de un niño** permite seleccionar un expediente, filtrar fechas y agrupar por día, mes o año. Al seleccionar un punto se abre el detalle. El usuario normal ve las mediciones registradas por su propia cuenta; las consultas temporales no aparecen. También puedes abrir **Crecimiento** desde el menú y consultar una referencia por fecha exacta sin registrar datos.

## Corregir una captura incorrecta

Con `evaluaciones.ver` y `evaluaciones.anular`, el historial ofrece **Anular captura incorrecta**. Revisa la evaluación, escribe el motivo (5–500 caracteres) y pulsa **Confirmar anulación**. Puedes cancelar antes de confirmar.

La API marca la evaluación ANULADA y conserva usuario, fecha y motivo en una transacción con auditoría. No borra la medición. No se calculan nuevas orientaciones de esa captura. Sus orientaciones y valoraciones guardadas se conservan; los reportes previos no cambian y las alertas no se cierran automáticamente. Registra una nueva medición correcta si corresponde. Esta pantalla no crea un vínculo automático de reemplazo ni permite revertir la anulación.

Dos solicitudes simultáneas no pueden sobrescribir la justificación: la primera anula y la siguiente recibe un conflicto. Actualiza el historial para consultar el estado y motivo guardados.

## Administración

Usuarios permite crear y gestionar cuentas y asignar roles. Roles y permisos administra permisos de roles existentes; Menús cambia presentación y visibilidad de opciones implementadas. Ocultar una opción no revoca permisos. Auditoría permite consultar las operaciones. Respaldos genera copias cifradas; verificar integridad y ensayar restauración son pasos diferentes, descritos en `23-administracion-y-respaldos.md`.

## Presentación de graduación

Usa datos ficticios y recorre expediente → evaluación → orientación → valoración médica → alerta → reporte. Muestra un acceso restringido con una cuenta de permisos limitados y explica la auditoría. La cuenta administradora no adquiere automáticamente la facultad de registrar una valoración médica por ser administradora.

## Alcance de la entrega

La aplicación ofrece apoyo y trazabilidad; el médico toma las decisiones. El despliegue incluido es local con Docker/Podman y Nginx. No se ha publicado en internet. No incluye edición libre de protocolos clínicos, notificación epidemiológica oficial ni una firma digital certificada. Los requisitos universitarios adicionales se deben contrastar con esta versión.
