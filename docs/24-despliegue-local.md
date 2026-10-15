# Despliegue local con Docker y Nginx

Se incluyen Dockerfiles separados para NestJS y React/Nginx, `compose.yaml` con MariaDB 10.11 y HTTPS local. Este entorno usa una **base nueva en un volumen separado**; no importa ni reemplaza automáticamente los datos de tu MariaDB actual.

## Preparación

Desde la raíz `nutritech`, con Docker Engine y Docker Compose instalados:

```bash
node infra/prepare-local.cjs
docker compose up -d --build
docker compose exec backend npm run references:import
docker compose exec -it backend npm run auth:create-admin
```

Abre `https://localhost:8443`. El certificado generado es autofirmado para localhost/127.0.0.1: el navegador mostrará un aviso de confianza en este entorno local. Las claves se generan una sola vez, no se imprimen y no se reemplazan al repetir la preparación. `.env` de la raíz pertenece a Compose; `backend/.env` pertenece al desarrollo actual.

Las migraciones 001–006 se ejecutan al crear por primera vez el volumen de MariaDB. No se vuelven a ejecutar sobre un volumen ya inicializado. Las referencias se importan con el script verificable existente. No se activan automáticamente reglas clínicas.

## Componentes

- Nginx sirve React y dirige `/api/` a NestJS, retirando el prefijo.
- MariaDB y NestJS no publican puertos al host. Solo HTTPS se publica en `127.0.0.1:8443`.
- JWT usa cookies Secure en producción. El origen HTTPS local se permite explícitamente.
- El backend ejecuta como usuario sin privilegios y tiene un volumen separado para respaldos.
- Las imágenes excluyen `.env`, claves, certificados locales, respaldos y `node_modules` del contexto. Dependencias se instalan con `npm ci`.
- Las verificaciones de salud ordenan el arranque; la salud HTTP del backend no reemplaza la prueba de conexión a MariaDB.

## Operación

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose exec backend npm run db:check
docker compose exec backend npm run backup:create
docker compose exec backend npm run backup:verify -- ID
docker compose stop
docker compose start
```

No uses `docker compose down -v` si quieres conservar datos: elimina los volúmenes. La cuenta de aplicación de Compose tiene permisos sobre su base, no para crear bases de ensayo; la prueba de restauración requiere un entorno de ensayo con los privilegios correspondientes.

Para llevar **datos existentes** a este entorno hay que conservar las claves de certificados/HMAC del backend original y realizar una recuperación controlada. Generar claves nuevas para datos cifrados antiguos rompe su recuperación y detección de duplicados. Este procedimiento inicial está pensado para una instalación nueva de demostración.

## Servidor con dominio

La configuración entregada es local. Publicar en internet requiere definir dominio, certificado TLS confiable, origen permitido, interfaces expuestas y estrategia externa de respaldos. No se ha publicado el proyecto ni contratado un servidor.

## Fuentes técnicas

- [Variables de entorno en Docker Compose](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/).
- [Proxy HTTP de Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

## Validación en Fedora

Se construyeron los Dockerfiles con Podman y se verificó la instalación nueva usando podman-compose 1.6.0 en un entorno temporal. `infra/check-compose.yaml` selecciona las imágenes de ensayo y `infra/smoke-containers.cjs` verifica exclusivamente el proyecto `nutritech-check`. No son necesarios para ejecutar el Compose normal. El ensayo usa un certificado autofirmado y omite la validación de su cadena solo en el cliente de prueba dirigido a localhost. No cambia la verificación TLS del backend ni del sistema.

La herramienta de ensayo se instaló en `/tmp/nutritech-compose-tools`, sin paquetes globales. Docker Engine/Compose no estaban instalados en esta computadora; para usar los comandos Docker de esta guía debes instalarlos o usar una instalación propia de Podman Compose.
