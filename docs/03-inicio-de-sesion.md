# Paso 3: inicio de sesión de NutriTech

## Qué construimos

El formulario recibe `codigo_acceso` y `contrasena`. React envía esos datos al
backend mediante una solicitud POST. NestJS busca el usuario en MariaDB,
comprueba bcrypt y genera un JWT firmado que vence a los 15 minutos.

La cookie `nutritech_session` tiene HttpOnly y SameSite=Strict. En producción
usa también Secure, por lo que se requiere HTTPS. El navegador envía la cookie
automáticamente. React no guarda tokens en localStorage ni sessionStorage.

MariaDB guarda SHA-256 del token en `sesiones_usuario`, nunca el token original.
La firma, el vencimiento, el estado del usuario y la sesión registrada se
comprueban en cada solicitud protegida. Al salir se revoca la sesión y se
elimina la cookie. Se registra inicio y cierre en `registros_auditoria`.

## Dos usuarios distintos

| Credencial | Dónde está | Para qué sirve |
| --- | --- | --- |
| Usuario y contraseña de MariaDB | `backend/.env`, en `DATABASE_URL` | Conectar NestJS a la base |
| Código de acceso de NutriTech | Tabla `usuarios`, columna `codigo_acceso` | Entrar a la aplicación |
| Hash de contraseña de NutriTech | Tabla `usuarios`, columna `contrasena_hash` | Verificar la contraseña con bcrypt |
| Clave de firma JWT | `backend/.env`, en `JWT_SECRET` | Firmar y verificar sesiones |

Un hash no se descifra: no existe una consulta SQL para recuperar la contraseña
original de NutriTech. Si se olvida, usa el restablecimiento local descrito abajo.
La clave JWT tampoco es una contraseña de usuario. No publicar `.env`.

Para consultar los códigos desde phpMyAdmin, seleccionar `nutritech` y ejecutar:

```sql
SELECT codigo_acceso, nombres, apellidos, estado
FROM usuarios
ORDER BY id;
```

## Crear el primer administrador

Desde `backend`:

```bash
npm run auth:create-admin
```

El comando pide código de acceso, nombres, apellidos y contraseña dos veces.
La contraseña no se muestra mientras se escribe; exige al menos 12 caracteres
y un máximo de 72 bytes UTF-8 por el límite de bcrypt. Se genera su hash con
costo 12, se crea el usuario y se asigna el rol ADMINISTRADOR en una transacción.
No hay una contraseña predeterminada. No reutilizar la contraseña de MariaDB.

El comando se niega a modificar cuentas existentes o crear otro administrador
si ya hay un rol ADMINISTRADOR asignado. No existe registro público ni una ruta
HTTP para crear administradores.

## Probar desde el navegador

1. Mantener MariaDB encendido.
2. Desde `backend`, ejecutar `npm run start:dev` (PORT=3017 en `.env`).
3. Desde `frontend`, ejecutar `npm run dev`.
4. Abrir http://127.0.0.1:5173 e ingresar con la cuenta creada.
5. Comprobar nombre y roles; recargar para verificar que la sesión persiste.
6. Cerrar sesión. Ya no se puede consultar el perfil con la cookie anterior.

## Archivos para aprender

| Archivo en backend/src | Responsabilidad |
| --- | --- |
| `auth/login.dto.ts` | Define y valida los datos aceptados |
| `auth/auth.controller.ts` | Recibe las solicitudes HTTP y maneja la cookie |
| `auth/auth.service.ts` | Verifica contraseña, registra sesión y consulta perfil |
| `auth/auth.guard.ts` | Comprueba autenticación antes de ejecutar una ruta |
| `auth/origin.guard.ts` | Rechaza solicitudes de escritura desde otros orígenes |
| `auth/auth.module.ts` | Conecta servicios y registra los guards globales |
| `auth/auth.config.ts` | Define duración, cookie y validación del secreto |
| `configure-app.ts` | Activa validación de entradas y lectura de cookies |

El formulario y la vista de sesión están en `frontend/src/App.tsx`.
Los colores siguen definidos en `frontend/src/index.css`.

## Rutas

| Método | Ruta NestJS | Desde React, mediante Vite | Acceso |
| --- | --- | --- | --- |
| POST | `/auth/login` | `/api/auth/login` | Público, limitado |
| GET | `/auth/me` | `/api/auth/me` | Sesión válida |
| POST | `/auth/logout` | `/api/auth/logout` | Sesión válida |
| GET | `/` | `/api/` | Comprobación pública existente |

Las solicitudes POST exigen `X-NutriTech-Request: 1`. Cuando hay Origin, debe
estar en APP_ORIGINS. No se habilita CORS para otros sitios: la cabecera no
simple impide que un formulario o fetch ajeno use las cookies para escribir.
En despliegue, Nginx deberá enrutar `/api` al backend quitando ese prefijo y
APP_ORIGINS deberá contener el origen HTTPS real.

## Protecciones de esta etapa

- Respuesta genérica ante credenciales incorrectas o cuenta no disponible.
- Cinco contraseñas incorrectas bloquean nuevos accesos durante 15 minutos.
- El contador se actualiza bajo bloqueo de fila y se confirma incluso al fallar.
- Límite de cinco solicitudes de login por minuto e IP por proceso.
- El perfil solo expone datos seleccionados, roles activos y permisos efectivos
  de la vista `vw_permisos_usuario`. Los hashes no salen de la API.
- Nuevas rutas requieren sesión por defecto. Solo `@Public()` omite ese control.
- Los permisos específicos se deberán comprobar en el backend al implementar
  cada módulo. Tener sesión no equivale a tener permiso para cualquier acción.

## Validación

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:auth
```

`test:auth` requiere MariaDB y los catálogos del SQL. Crea una cuenta sintética
TEST_AUTH_, verifica 11 casos reales y elimina solo los registros de esa cuenta
al terminar. No ejecutar la suite contra producción. Las pruebas normales no
activan esta suite; requiere RUN_DB_TESTS=1, incluido en el comando test:auth.

Casos: acceso sin cookie, validación de entradas, protección de origen,
inicio/perfil/cierre, bloqueo y recuperación, cuentas inactivas o bloqueadas,
desactivación con sesión abierta, tokens vencidos/manipulados/no registrados,
límite de 72 bytes y límite de solicitudes.

## Alcance pendiente

No hay recuperación pública por correo ni renovación automática de JWT. El restablecimiento local está disponible. Antes de desplegar: revisar avisos npm documentados en el
README, configurar HTTPS, orígenes, proxy confiable y almacenamiento compartido
del limitador si se ejecuta más de una instancia. No habilitar trust proxy de
forma indiscriminada, pues permitiría falsificar la IP del limitador.

## Fuentes para estudiar

- [Autenticación en NestJS](https://docs.nestjs.com/security/authentication)
- [Almacenamiento de contraseñas: OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Protección CSRF: OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

## Restablecer una contraseña olvidada

Desde `backend`, con MariaDB encendida:

```bash
npm run auth:reset-password
```

Introduce el código de acceso y la nueva contraseña dos veces (entrada oculta). El comando conserva roles y estado, limpia el bloqueo temporal por intentos, revoca sesiones y registra la operación sin contraseñas ni hashes en la auditoría. Solo funciona desde una terminal local con acceso a la base; no es una recuperación pública por correo. No cambia la contraseña de MariaDB.
