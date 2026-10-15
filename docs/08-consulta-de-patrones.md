# Paso 8: consulta de patrones nutricionales

## Cómo probarlo

1. Ingresa con una cuenta que tenga `patrones.gestionar`, como el administrador inicial.
2. Pulsa **Actualizar menú** y abre **Configuración → Patrones nutricionales**.
3. Revisa el código, organización fuente, versión, referencia documental, vigencia y estado del patrón.
4. Despliega un indicador para ver parámetros por sexo y, cuando corresponde, método de medición, además de sus reglas.
5. Usa **Actualizar datos** para volver a consultar la base sin cerrar la sesión.

Al implementar este paso, la base contenía OMS-2006 inactivo, sin parámetros LMS ni reglas. La pantalla obtiene los datos reales en cada consulta; no utiliza conteos de ejemplo. No necesitas importar nuevamente el SQL.

## Qué aprendemos

Un **catálogo** contiene definiciones: por ejemplo, el nombre y la versión de un patrón. Las tablas de **parámetros** contienen los valores numéricos de referencia asociados a un indicador, sexo y edad o talla. Las **reglas** contienen los intervalos de clasificación y si una regla genera alerta.

Esta pantalla permite inspeccionar esos tres grupos antes de incorporar un motor de cálculo. Un registro de peso y talla pertenece a un niño; los patrones son configuración compartida y se consultan con un permiso administrativo independiente.

El recorrido de la solicitud es:

1. React solicita `GET /api/patrones` a través del proxy existente de Vite.
2. NestJS verifica la sesión y el permiso `patrones.gestionar`.
3. `PatronesService` consulta cuatro conjuntos dentro de una transacción de lectura: patrones con reglas, tipos de indicador y resúmenes de las dos tablas LMS.
4. Prisma usa `groupBy` para contar filas y obtener extremos en MariaDB. No descarga todos los coeficientes para contarlos en JavaScript.
5. El servicio relaciona los resúmenes por patrón e indicador, convierte las fechas a `AAAA-MM-DD` y conserva los decimales de reglas como cadenas.
6. React presenta estados de carga, error, catálogo vacío y datos disponibles. La respuesta usa `Cache-Control: no-store`.

## Cómo interpretar lo que ves

- **Activo en la base** representa únicamente el campo `activo`; no acredita que el contenido esté validado.
- Los conteos del resumen corresponden al eje del indicador. El detalle muestra ambas tablas para poder detectar cargas en un eje distinto del esperado.
- Los extremos de edad o talla son el mínimo y máximo presentes. Pueden existir huecos entre ellos.
- Las reglas inactivas también aparecen, identificadas como tales.
- Los límites nulos se muestran abiertos. Un límite cero se conserva como cero, no se trata como ausente.
- Esta versión consulta lo almacenado. No activa patrones, carga parámetros, verifica continuidad, valida reglas ni genera resultados o alertas.

La referencia documental se muestra como texto, incluso si contiene una dirección web o etiquetas. Se conserva como dato; no se interpreta como HTML ni como instrucciones para la aplicación.

## Archivos

- `backend/src/patrones/patrones.module.ts`: integra el módulo con Prisma.
- `backend/src/patrones/patrones.controller.ts`: define la ruta y su permiso.
- `backend/src/patrones/patrones.service.ts`: consultas, agrupación y serialización.
- `frontend/src/components/PatronesView.tsx`: presentación y estados de la consulta.
- `frontend/src/components/Workspace.tsx`: habilita la ruta existente del menú.
- `backend/test/patrones.e2e-spec.ts`: pruebas de acceso y datos agrupados.

## Verificación

Desde `backend`, `npm run test:patrones` ejecuta cuatro pruebas con un usuario y un patrón sintéticos. Los datos de prueba permanecen inactivos y se eliminan al terminar. Se comprueban permisos, cambios de permiso en una sesión existente, agrupación por sexo/método, fechas, decimales, límites abiertos y ausencia de modificaciones durante la consulta.

El siguiente paso para implementar clasificaciones es obtener y documentar las tablas oficiales de referencia y las reglas que se usarán, preparar su importación y verificar cobertura, unidades y procedencia. La pantalla actual ayudará a inspeccionar esa carga.
