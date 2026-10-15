# Paso 5: listado y registro de niños

## Probar en NutriTech

1. Iniciar sesión en http://127.0.0.1:5173 con una cuenta autorizada.
2. Abrir Niños → Registrar niño.
3. Completar certificado, primer nombre, primer apellido, nacimiento y sexo biológico.
4. Guardar. El sistema muestra el código de expediente generado.
5. Abrir el listado, buscar por nombre o expediente y probar los filtros.

Los nombres y apellidos adicionales, la comunidad y la dirección son opcionales.
No se crearon comunidades ficticias: si el catálogo está vacío, se puede dejar
Sin asignar. Los responsables familiares se incorporarán en otra etapa.

## Flujo de registro

1. React recoge el formulario y envía POST /api/ninos.
2. AuthGuard valida la sesión; PermissionsGuard exige ninos.crear.
3. CreateNinoDto comprueba tipos, longitudes y campos permitidos.
4. NinosService comprueba calendario, fecha no futura y comunidad activa.
5. CertificateService normaliza, calcula HMAC y cifra el certificado original.
6. Se crea el niño junto con su registro de auditoría en una transacción.
7. React recibe un resultado con campos seleccionados y muestra el expediente.

El cliente no elige id, codigo_publico, codigo_expediente, estado ni registrado_por.
NestJS genera los códigos, establece el estado inicial ACTIVO y toma el autor
de la sesión validada. El expediente utiliza el prefijo NT- y un ULID.

## HMAC y cifrado no son lo mismo

La normalización utilizada es: eliminar espacios y guiones y convertir letras
a mayúsculas. Se aceptan entre 4 y 80 letras ASCII o números normalizados;
el texto de entrada admite hasta 120 caracteres para incluir separadores.
Así, ab-1234 y AB 1234 se consideran el mismo certificado. Esta es una regla
inicial del proyecto; confirmar el formato institucional antes de cambiarla
cuando existan datos, pues los hashes dependen de ella.

El HMAC-SHA-256 produce 32 bytes y permite comparar certificados sin guardar
el número en texto plano. El índice único certificado_hash impide duplicados,
incluso cuando llegan solicitudes simultáneas. Un duplicado devuelve HTTP 409.
La unicidad incluye expedientes inactivos o archivados.

AES-256-GCM conserva cifrado el original (sin espacios exteriores). Utiliza un
nonce aleatorio de 12 bytes y una etiqueta de autenticación de 16 bytes.
Formato binario guardado: versión 1 (un byte), nonce, etiqueta, contenido.
El contexto autenticado es nutritech:certificate:v1. No hay un endpoint para
descifrar o mostrar el certificado completo en esta etapa.

## Claves de configuración

En backend/.env:

- CERTIFICATE_HMAC_KEY: clave exclusiva para comparar certificados.
- CERTIFICATE_ENCRYPTION_KEY: otra clave para cifrarlos.
- APP_TIMEZONE: America/Guatemala para determinar el día actual al validar nacimientos.

Las dos claves se generaron porque la base estaba vacía. Son 32 bytes aleatorios
cada una, representados por 64 caracteres hexadecimales. No se imprimieron en
la conversación ni se incluyeron en el frontend. El arranque falla si faltan
o tienen un formato incorrecto; no se regeneran automáticamente.

Conservar una copia privada de estas claves junto con el procedimiento de
respaldo. Sin la clave de cifrado no se puede recuperar el certificado; cambiar
la clave HMAC rompe la comparación con los registros anteriores. La rotación
requiere una migración planificada. El formato actual tiene versión de formato,
pero no incorpora identificadores de varias claves para rotación automática.

En una instalación nueva con base vacía, generar dos valores independientes:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Ejecutar dos veces y guardar cada resultado en su variable correspondiente.
Al restaurar datos, restaurar las claves existentes, no generar otras.

## Rutas

| Ruta desde React | Permiso | Función |
| --- | --- | --- |
| GET /api/ninos | ninos.ver | Listado, búsqueda y paginación |
| POST /api/ninos | ninos.crear | Registro del niño y auditoría |
| GET /api/ninos/comunidades | ninos.crear | Catálogo de comunidades activas |

Vite quita /api antes de llamar a NestJS. Las solicitudes POST mantienen la
cabecera X-NutriTech-Request y la protección de origen existente.

Parámetros del listado: busqueda (hasta 80 caracteres), pagina (desde 1),
limite (1–50; valor inicial 20) y estado (ACTIVO, INACTIVO, ARCHIVADO o TODOS).
Cada palabra buscada debe coincidir en algún nombre, apellido o expediente.
Por defecto se muestran activos, ordenados por fecha de registro e id descendentes.
El listado devuelve total, pagina, limite, paginas y datos.

Los resultados contienen identificadores públicos, nombre, nacimiento, sexo,
estado, comunidad y últimos cuatro caracteres del certificado. No incluyen
id interno, autor, dirección, hash ni contenido cifrado. La API usa no-store.

## Fechas

Las fechas de nacimiento viajan como AAAA-MM-DD y se guardan en una columna
DATE. No se transforma el nacimiento a la zona horaria del navegador al
mostrarlo. Se comprueba que la fecha exista (por ejemplo, 2025-02-29 no existe)
y que no sea posterior al día actual de Guatemala.

El registro general no impone una regla de menor de cinco años. En el esquema
original esa validación corresponde al momento de registrar una evaluación;
se implementará en el módulo de evaluaciones. No se calculan indicadores ni
se hacen clasificaciones nutricionales en esta etapa.

## Archivos para estudiar

| Archivo backend/src/ninos | Responsabilidad |
| --- | --- |
| create-nino.dto.ts | Validación de los campos de registro |
| list-ninos.dto.ts | Validación de filtros y paginación |
| certificate.service.ts | Normalización, HMAC y cifrado |
| ninos.service.ts | Consultas, transacción y representación pública |
| ninos.controller.ts | Rutas y permisos |
| ninos.module.ts | Conecta controlador y servicios |

Frontend: components/NinosList.tsx, components/NinoForm.tsx y
components/ninos-api.ts. Workspace.tsx habilita las dos opciones existentes
del menú. No se modificaron roles ni permisos de los usuarios reales.

## Pruebas realizadas

```bash
npm test -- --runInBand
npm run test:ninos
npm run test:auth
```

10 pruebas unitarias y 25 pruebas de integración: 9 del módulo de niños y
16 de autenticación/permisos. Las pruebas de integración requieren MariaDB,
crean datos sintéticos y los eliminan al finalizar; no usar contra producción.
Incluyen cifrado, detección de alteraciones, normalización, fechas, duplicados
simultáneos, autoría, validación de comunidad, búsqueda, paginación y permisos.
La compilación y el análisis de código de ambos proyectos también se verificaron.

## Alcance de esta entrega

Incluye listado y creación. Quedan pendientes detalle/edición, archivo,
responsables familiares y evaluaciones. El acceso es por permisos; no hay
segmentación por centro de salud en estas consultas. La navegación sigue
siendo interna a React, sin rutas independientes para cada pantalla.

[Referencia de criptografía de Node.js](https://nodejs.org/api/crypto.html).
