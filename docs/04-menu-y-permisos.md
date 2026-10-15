# Paso 4: menú dinámico y autorización

## Lo que puedes probar

1. Iniciar sesión en http://127.0.0.1:5173 con tu cuenta de administrador.
2. Revisar el menú lateral. Nombres, orden y permisos proceden de MariaDB.
3. Abrir Seguridad → Roles y permisos y desplegar cada rol.
4. Usar Actualizar menú para volver a consultar los accesos vigentes.

Esta etapa permite consultar roles y permisos; no editarlos. Las opciones con
la etiqueta Pendiente todavía no tienen una pantalla funcional y están
deshabilitadas. Mi cuenta está disponible para todo usuario autenticado.
La opción Dashboard muestra por ahora el resumen de cuenta, no estadísticas
clínicas. La selección actual se conserva en React durante esa sesión de
pantalla; aún no se implementa navegación con URLs para cada módulo.

## Autenticación y autorización

Autenticar: comprobar quién está conectado (JWT y sesión en MariaDB).
Autorizar: comprobar si esa persona tiene permiso para una acción concreta.

```ts
@Get('roles')
@RequirePermissions('roles.gestionar')
```

Antes de ejecutar esta ruta, AuthGuard valida la sesión. Después,
PermissionsGuard consulta los permisos efectivos y exige roles.gestionar.
Una solicitud sin sesión obtiene 401. Una sesión sin el permiso obtiene 403.

No se confía en el rol o usuario enviado por React. El ID del usuario sale de
la sesión validada. GET /menu ignora cualquier usuario_id enviado por URL.
Los permisos exigidos a nivel de clase y método se acumulan; se deben cumplir
todos. No marcar como pública una ruta que necesite permisos.

## De dónde sale el menú

- roles, usuario_rol y rol_permiso: permisos otorgados mediante roles activos.
- usuario_permiso: concesiones o denegaciones particulares con vigencia.
- vw_permisos_usuario: combina lo anterior; una denegación vigente prevalece.
- modulos_menu y opciones_menu: estructura, etiquetas, orden y visibilidad.
- opcion_menu_permiso: enlaza las opciones con los permisos necesarios.
- vw_menu_usuario: opciones autorizadas para cada usuario.

MenuService agrupa las opciones por módulo. Incluye grupos contenedores cuando
tienen hijos autorizados. Descarta grupos vacíos, huérfanos, ciclos, rutas
externas y descendientes sin una cadena visible hacia la raíz. Un enlace
padre no autorizado no se revela para mostrar a un hijo. Ocultar un menú no
revoca por sí mismo permisos: la autorización depende del permiso de la ruta.

## Rutas y archivos

| Ruta desde React | Función | Archivo backend/src |
| --- | --- | --- |
| GET /api/menu | Menú de la sesión actual | menu/menu.controller.ts |
| GET /api/seguridad/roles | Catálogo de roles y permisos activos asignados | security/security.controller.ts |

Vite elimina el prefijo /api al llamar a NestJS.

- permissions/permissions.service.ts: una única consulta de permisos efectivos.
- permissions/permissions.guard.ts: comprueba permisos antes del controlador.
- permissions/require-permissions.decorator.ts: declara permisos requeridos.
- menu/menu.service.ts: arma los módulos y sus opciones.
- frontend/src/components/Workspace.tsx: menú lateral y resumen de cuenta.
- frontend/src/components/RolesView.tsx: consulta del catálogo.
- frontend/src/types.ts: estructura TypeScript de las respuestas.

La lista de pantallas disponibles en React indica cuáles están implementadas;
no es una lista de permisos ni de roles. El servidor sigue decidiendo el acceso.

## Corrección de zona horaria encontrada durante las pruebas

La sesión MariaDB utilizaba SYSTEM con seis horas menos que UTC. Prisma
guarda las fechas de vencimiento como UTC; comparar con CURRENT_TIMESTAMP(3)
podía mantener vigentes permisos ya vencidos.

Se cambió solo la vista vw_permisos_usuario para comparar sus dos condiciones
de expiración con UTC_TIMESTAMP(3). No se alteraron tablas, cuentas ni sus
asignaciones. El ajuste aplicado está en:

`database/migrations/001-permisos-utc.sql`

Para una instalación nueva, importar primero database/nutritech.sql y después
este ajuste desde phpMyAdmin, con nutritech seleccionada. El archivo original
del esquema se conserva. La migración es repetible. No volver a importar el
esquema inicial encima de esta vista sin reaplicar el ajuste.

Este cambio corrige la vigencia de permisos. El despliegue debe configurar
MariaDB en UTC también para que los valores DEFAULT de fechas y auditoría
se generen en UTC; no se cambió la configuración global del servidor ni se
reinterpretaron registros históricos en esta etapa.

## Pruebas

Desde backend:

```bash
npm test -- --runInBand
npm run test:auth
```

Hay 5 pruebas unitarias (incluida la inicial) y 16 pruebas de integración.
La suite de integración crea una cuenta temporal y elimina sus datos al
terminar. No modifica la cuenta de administrador existente.

Se verificaron acceso normal y administrativo, denegación directa, concesión
particular, vencimiento de permisos, ausencia de duplicados y rutas protegidas.

Para ejecutar npm run build, detener primero npm run start:dev con Ctrl+C y
reiniciarlo al terminar; ambos usan dist y una compilación simultánea puede
interferir con la salida del modo watch.

## Próximo paso

Construir el módulo de niños: empezar por un listado autorizado y paginado,
y después el formulario de registro con validación del certificado.
