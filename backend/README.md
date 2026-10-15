# NutriTech — Backend

API inicial generada con NestJS 11 y TypeScript en modo estricto.

## Ejecutar

Desde esta carpeta:

```bash
npm install
npm run start:dev
```

Abrir http://localhost:3000. El endpoint inicial responde `Hello World!`.

## Comprobar

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

## Archivos iniciales

- `src/main.ts`: inicia el servidor; puerto 3000 por defecto.
- `src/app.module.ts`: módulo raíz.
- `src/app.controller.ts`: endpoint inicial GET /.
- `src/app.service.ts`: lógica de la respuesta inicial.

## Base de datos

Prisma 6.19.0 se conecta a MariaDB con el proveedor `mysql`.
`prisma/schema.prisma` se obtuvo leyendo las tablas existentes mediante
`prisma db pull`. El SQL original se conserva en `../database/nutritech.sql`.

La configuración local está en `.env` (excluido de Git). Para otro equipo,
copiar `.env.example` a `.env` y configurar las credenciales locales;
codificar los caracteres especiales de usuario y contraseña en la URL.
NestJS carga `.env` al iniciar, incluido `PORT=3017`.

```bash
npm run db:pull
npm run db:generate
npm run db:check
```

Después de instalar dependencias en otro equipo, ejecutar `npm run db:generate`.
La comprobación consulta solo metadatos. PrismaService abre la conexión al
iniciar NestJS y la cierra al apagarlo. Importar PrismaModule en los módulos
que necesiten inyectar PrismaService.

El SQL y la base existente son la fuente del esquema en esta etapa. No se
han ejecutado migraciones, `db push` ni reinicios de la base. Las vistas,
CHECK, triggers y comentarios no se reproducen íntegramente en los modelos
Prisma; conservarlos en SQL antes de planificar migraciones.

Autenticación JWT y bcrypt implementada. Consultar `../docs/03-inicio-de-sesion.md` para crear el primer administrador y comprender el flujo. Los módulos funcionales siguen pendientes.

## Validación de esta etapa

Conexión real verificada: 27 tablas accesibles. Compilación, prueba unitaria y
prueba de integración completadas. No se modificaron tablas ni registros.

La auditoría npm detectó avisos de dependencias que requieren revisión antes
del despliegue, incluido Multer transitivo en NestJS. Esta etapa no agrega
endpoints de subida de archivos. No se aplicó `npm audit fix --force`, que
propone cambios incompatibles con el proyecto.

## Inicio de sesión

```bash
npm run auth:create-admin
npm run start:dev
```

Usar el código y contraseña elegidos en http://127.0.0.1:5173.
`JWT_SECRET` debe tener al menos 32 bytes; está generado en el `.env` local.
En otro equipo, generar una clave con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
y guardarla en el `.env` de ese equipo. Los orígenes permitidos se definen en
APP_ORIGINS. No subir secretos a Git ni incluirlos en el frontend.

## Menú y permisos

GET /menu devuelve las opciones autorizadas. GET /seguridad/roles requiere
roles.gestionar. Consultar `../docs/04-menu-y-permisos.md`, incluido el ajuste
SQL de vigencias UTC aplicado durante esta etapa.

## Módulo de niños

GET /ninos exige ninos.ver; POST /ninos exige ninos.crear. Certificados
protegidos con claves CERTIFICATE_HMAC_KEY y CERTIFICATE_ENCRYPTION_KEY en
.env (32 bytes hexadecimales cada una). Conservarlas junto a los respaldos.
La configuración local ya está preparada; no regenerarlas sobre datos existentes.
Consultar `../docs/05-modulo-ninos.md` y ejecutar `npm run test:ninos` para
las pruebas de integración con datos sintéticos.

Detalle y responsables implementados. Consultar `../docs/06-expediente-y-responsables.md`.
