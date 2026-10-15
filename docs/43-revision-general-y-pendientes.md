# NutriTech: revisión general y lista de pendientes

Fecha: 7 de octubre de 2026.

La base funcional está implementada. El trabajo pendiente consiste principalmente en corregir permisos, completar recorridos del usuario normal y preparar una instalación reproducible. Este documento registra hallazgos y un orden de trabajo; no significa que las correcciones enumeradas ya se hayan aplicado.

## Alcance y evidencia

Se revisaron los módulos de la API NestJS, componentes React, permisos, esquema Prisma, migraciones SQL, scripts de instalación y respaldo, configuración Docker/Nginx y documentación. Se consultó la MariaDB local y se hicieron comprobaciones de API con cuentas temporales, además del recorrido visual de crecimiento.

- `npm run verify`: aprobado. Incluye TypeScript, lint, 78 pruebas unitarias en 13 suites, 5 pruebas de referencias y compilación del frontend.
- La prueba de importación de referencias en MariaDB se omitió en ese comando. No se volvió a ejecutar toda la integración `npm run verify:db` en esta revisión.
- Frontend y backend locales respondieron correctamente durante la revisión.
- Crecimiento se comprobó en navegador con cuenta normal y administración, incluyendo ancho móvil. No se probó visualmente cada operación de escritura de todos los módulos.
- `npm audit --omit=dev`: frontend sin avisos; backend con cinco entradas críticas derivadas de un mismo aviso de `proxy-addr`. Se explica su alcance abajo.
- Los datos ficticios y las cuentas creadas para esta revisión se eliminaron al terminar. No se modificaron expedientes históricos.

## Correcciones prioritarias

### 1. Aislamiento de datos del usuario normal — prioridad alta, confirmado

Una cuenta temporal con rol Usuario normal y cero alertas propias recibió HTTP 200 y dos alertas en `GET /alertas`. La misma cuenta recibió HTTP 403 en el listado administrativo de niños y únicamente sus dos niños de prueba en crecimiento. Esto confirma que ocultar el menú de alertas no impide consultar esa API.

En [AlertsService](../backend/src/alerts/alerts.service.ts), el listado filtra por estado, pero no por propietario o alcance de la cuenta. El parámetro `actor` se usa para indicar si puede atender alertas. La consulta de detalle tampoco recibe el actor. El permiso `alertas.ver` que tiene el perfil normal abre esas rutas generales.

Trabajo pendiente:

- Separar acceso general del personal y acceso a registros propios del usuario normal, tanto en listado como en detalle.
- Mantener el funcionamiento de sus reportes: las rutas de reporte normal también requieren `alertas.ver`; quitarlo sin adaptar esas rutas rompería ese recorrido.
- Revisar las búsquedas generales de niños para evaluación y de responsables. Por lectura del código, no reciben un filtro de propietario; este alcance debe distinguir la cuenta familiar de la cuenta de personal.
- Añadir pruebas con dos cuentas independientes: una no puede obtener ni modificar datos de la otra, aunque conozca su código público.

Evidencia adicional: [controlador de evaluaciones](../backend/src/evaluaciones/evaluaciones.controller.ts), [servicio de evaluaciones](../backend/src/evaluaciones/evaluaciones.service.ts), [portal normal](../backend/src/user-portal/user-portal.module.ts) y [responsables](../backend/src/ninos/guardians.service.ts). Las búsquedas indicadas son hallazgos de revisión de código; la consulta de alertas sí se reprodujo contra la API local.

### 2. Instalación incompleta desde cero — prioridad alta, confirmado en configuración

[compose.yaml](../compose.yaml) importa el esquema y las migraciones 001–006, pero omite [007-responsables-dpi.sql](../database/migrations/007-responsables-dpi.sql). El modelo y los servicios actuales usan las columnas del DPI que añade esa migración. Que la base local funcione no garantiza que una base nueva creada con Docker funcione igual.

Además, la habilitación de comunidades depende del script [enable-communities.cjs](../backend/scripts/enable-communities.cjs), que no forma parte de ese arranque inicial.

Pendiente: un procedimiento único de instalación/actualización, con migraciones y permisos necesarios, y una prueba sobre una base vacía separada. No reimportar el esquema original sobre la base que ya contiene datos.

### 3. Sesión y formularios — prioridad alta de uso

La sesión dura 15 minutos según [auth.config.ts](../backend/src/auth/auth.config.ts). Al vencer, [App.tsx](../frontend/src/App.tsx) retira el usuario y desmonta su interfaz. No hay aviso previo ni un recorrido para autenticarse y continuar el formulario sin perder lo escrito.

Pendiente: aviso antes del vencimiento, continuación segura de sesión y recuperación controlada del trabajo pendiente. No basta con aumentar el tiempo indefinidamente. El restablecimiento administrativo y por comando ya existe; una recuperación autónoma o cambio de contraseña desde Mi cuenta sería una mejora adicional.

### 4. Dependencia y configuración del proxy — prioridad alta antes de publicar

La instalación usa `proxy-addr@2.0.7`, a través de Express y NestJS. La auditoría de dependencias mostró cinco paquetes afectados en esa cadena, no cinco fallos independientes. El mantenedor identifica el problema y su corrección en 2.0.8; el ataque descrito depende de determinadas subredes de confianza IPv6 mal configuradas. [Aviso del mantenedor GHSA-jqcg-44mw-7w3h](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h).

No se encontró esa configuración de confianza en el proyecto y no se reprodujo ese ataque. Pendiente actualizar la dependencia de forma compatible, verificar el archivo de versiones y repetir las pruebas. La salida de npm no ofreció una corrección automática; no se ejecutó `npm audit fix --force`.

Por separado, Nginx reenvía la dirección del cliente, pero no se encontró configuración de proxy de confianza en Express. Esto puede hacer que los límites por IP agrupen usuarios detrás del proxy; se debe verificar en el despliegue y configurar únicamente los saltos de confianza necesarios.

## Inventario de módulos

“Implementado” describe lo que existe en el código; los pendientes indican lo necesario para cerrar el recorrido o una ampliación propuesta. Alta significa corregir antes de publicación o de ampliar ese flujo; media corresponde a completar el uso diario.

| Módulo | Qué existe | Qué terminar o corregir | Prioridad |
|---|---|---|---|
| Acceso y Mi cuenta | JWT, bcrypt, bloqueo por intentos, cierre de sesión y restablecimiento | Aviso y continuidad de sesión; proteger formularios ante vencimiento; valorar cambio de contraseña desde la cuenta | Alta |
| Permisos y separación de pacientes | Roles, permisos y rutas propias de crecimiento/reportes | Corregir exposición de alertas; revisar búsquedas y escritura por cuenta con pruebas cruzadas | Alta |
| Portal del usuario normal | Consulta temporal, registro opcional, reporte del resultado y crecimiento | Añadir Mis niños, evaluar un niño ya registrado y Mis reportes; volver a consultar resultados después de cerrar la pantalla | Alta |
| Expedientes de niños | Registrar, buscar, ver, editar nombres/dirección/estado, prevenir duplicados | Permitir cambio de comunidad; definir corrección auditada de fecha, sexo o certificado mal capturados sin alterar silenciosamente resultados anteriores | Media |
| Padres y responsables | Crear, buscar por DPI/nombre/teléfono, vincular y elegir responsable principal; correo opcional | Editar contactos y corregir parentescos o vínculos equivocados; revisar alcance de búsquedas para perfil normal | Media, con permisos en alta |
| Evaluaciones y consulta temporal | Captura, cálculo, orientación, avisos, guardado guiado y anulación con motivo | Unificar mensajes de edad/cobertura y evitar que una consulta temporal admita continuar a un registro que la rechazará; comprobar corrección y repetición sin duplicados | Media |
| Orientación nutricional y valoración médica | Referencias OMS, fuentes MSPAS, puntajes completos, orientación familiar y valoración profesional separada | Documentar versión vigente y revisión del contenido; la propuesta conserva estado de borrador/revisión clínica pendiente. Corregir textos de estado desactualizados | Alta para cierre clínico del alcance |
| Alertas y seguimiento | Generación, bandeja, estados, comentarios e historial | Aislamiento por cuenta primero; después filtros por niño/fecha y presentación más clara de pendientes | Alta / media |
| Reportes para la familia | Copias guardadas, integridad, impresión y guardar como PDF desde navegador | Listado por nombre del niño y filtros por fecha; archivo propio en portal normal. Descarga directa y gráfica dentro del PDF son ampliaciones | Alta para acceso normal; media para presentación |
| Crecimiento y tabla de Inicio | Tabla de peso/talla en ambas vistas, curva de peso, día/mes/año, filtros, selección y detalle interactivo | La mejora interactiva ya se verificó. Como ampliación: curva de talla y exportación del seguimiento | Ampliación posterior |
| Inicio y estadísticas | Acciones rápidas y totales según permisos | Resumen por período, comunidad o centro y enlaces a listados filtrados; las estadísticas institucionales detalladas serían una ampliación | Media |
| Comunidades | Buscar, crear, editar, activar/desactivar y evitar duplicados | Incluir permisos en instalación; preparar catálogo definitivo cuando se acuerde sustituir el catálogo ficticio | Media |
| Centros de salud | Tabla y selector de centros en evaluaciones | Falta pantalla para crear/editar/activar centros y asignar el centro a una cuenta desde administración | Nuevo mantenimiento, media |
| Usuarios, roles y menús | Crear/editar cuentas, asignar roles, restablecer contraseña, editar permisos y menú | Revisar matriz de permisos, añadir asignación de centro y mejorar mensajes de administración | Alta para permisos; media para interfaz |
| Auditoría | Registro de operaciones, responsables, motivos y control de cambios | Mejorar filtros de consulta y comprobar la trazabilidad de los recorridos que se agreguen | Media |
| Respaldos y restauración | Respaldo cifrado manual, listado, verificación y script de restauración de prueba | Programación, retención, copia externa y ensayo de restauración en el entorno desplegado | Alta antes de publicar |
| Instalación y despliegue | Dockerfiles, Compose, MariaDB persistente y Nginx con HTTPS local | Completar migraciones, preparar Railway/dominio/orígenes/secretos, persistencia y verificación de salud que consulte la base | Alta antes de publicar |
| Pruebas y documentación | Pruebas unitarias/integración existentes, manuales y resumen funcional | Repetir integración completa tras correcciones, automatizar recorridos de navegador, actualizar manual/capturas y matriz de alcance de graduación | Alta para entrega |

## Detalles que conviene conservar al completar los módulos

- **Consulta sin registro:** ya existe y no debe crear historial por consultar o imprimir. Registrar después es una acción explícita.
- **Correo opcional:** ya está implementado; no es un módulo pendiente.
- **Padres:** el vínculo familiar ya existe. Lo pendiente es su mantenimiento y alcance de búsqueda.
- **PDF:** actualmente se obtiene mediante impresión del navegador. La descarga directa sería una mejora de comodidad, no la primera implementación de un reporte.
- **Crecimiento:** la tabla y gráfica ya se comparten entre ambas vistas. No hace falta duplicar el módulo.
- **Edades:** el DTO temporal admite hasta 1856 días, la referencia diaria de crecimiento hasta 1826 y el guardado exige una fecha anterior al quinto cumpleaños. Se deben explicar y coordinar esas coberturas, sin ampliar referencias clínicas arbitrariamente.
- **Patrones y recomendaciones:** hay pruebas técnicas, fuentes y versiones. Eso no equivale a una aprobación institucional del protocolo. Los datos clínicos adicionales, como perímetro de brazo y signos de peligro, solo deben añadirse si se amplía formalmente el alcance.
- **Documentación:** algunas notas históricas dicen que comunidades o infraestructura están pendientes aunque ya existen. Deben identificarse como historial y actualizar la guía de instalación actual.
- **Control de versiones:** esta carpeta no se identificó como un repositorio Git durante la revisión. Conviene versionar el proyecto y automatizar las verificaciones antes de la entrega.

## Orden propuesto y criterio para cerrar cada etapa

1. **Seguridad y acceso.** Corregir alertas y rutas compartidas, revisar la dependencia y configurar el proxy. Cierre: dos usuarios normales no pueden acceder a datos ajenos mediante ninguna de las rutas afectadas y los reportes propios siguen funcionando.
2. **Recorrido del usuario normal.** Mis niños → nueva evaluación del mismo niño → resultado → reporte → consulta posterior. Cierre: completar el recorrido y retomarlo después de iniciar sesión de nuevo, sin volver a registrar al niño.
3. **Sesión y mantenimiento de datos.** Aviso de vencimiento, edición de responsables/comunidad y administración de centros. Cierre: cambios autorizados, trazables y visibles al consultar de nuevo.
4. **Claridad de resultados y seguimiento.** Revisar contenido, edades, filtros de alertas/reportes y resumen de Inicio. Cierre: un usuario identifica al paciente, entiende el resultado disponible y reconoce la siguiente acción sin entrar al detalle técnico.
5. **Instalación y entrega.** Base nueva reproducible, configuración de Railway, respaldo/restauración, integración completa y manual actualizado. Cierre: instalar desde cero en un entorno separado y completar el recorrido de administración y usuario normal.

Citas, recordatorios, notificaciones por correo y estadísticas adicionales pueden planificarse después si forman parte de los requisitos de graduación. No se consideran fallos del alcance actual. La idea de IA/MCP fue descartada por el usuario y no figura como pendiente.

La revisión del diseño interactivo de crecimiento está en [42-crecimiento-interactivo.md](42-crecimiento-interactivo.md).
