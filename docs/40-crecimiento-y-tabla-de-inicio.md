# Crecimiento y tabla de Inicio

Disponible en Inicio de administración y del usuario normal. Se comparte un componente para mantener el mismo diseño y los mismos datos en ambas vistas.

## Recorrido de uso

1. En **Tabla por edad**, elige Niño o Niña. Se muestran edad, peso (kg) y longitud/talla (cm), desde el nacimiento hasta los cinco años. **Ver todos los meses** amplía la tabla resumida.
2. **Gráfica de un niño** permite elegir un expediente y consultar sus mediciones en el mismo Inicio. También existe la opción **Crecimiento** del menú.
3. Usa Desde/Hasta y Día/Mes/Año para delimitar el historial. Cada punto representa la última medición de ese período; la tabla de detalle conserva todas las mediciones del filtro. No se promedian ni se rellenan períodos sin datos.
4. Selecciona un punto con clic, Enter o espacio para consultar peso, talla, edad, referencia y avisos. El selector mantiene los pacientes separados.
5. **Peso de referencia por edad** permite consultar la mediana y la franja -2/+2 DE con nacimiento, fecha y sexo, sin guardar información.

## Referencias y límites

La tabla de Inicio usa las medianas M de seis tablas mensuales oficiales OMS: peso para la edad en ambos sexos, longitud de 0 a 2 años y talla de 2 a 5 años. Para la fila de 24 meses se usa explícitamente la tabla de talla de pie. La pantalla redondea a un decimal; los archivos conservan el valor publicado completo. Son referencias centrales, no metas ni un diagnóstico de normalidad.

Los PDF originales están en `database/references/growth-monthly/`. `manifest.json` registra sus URLs y SHA-256; `medians.json` contiene 61 filas por sexo, meses 0–60. `scripts/extract-growth-monthly.py` reproduce la extracción y comprueba continuidad, filas únicas y correspondencia de año/mes. La API verifica las huellas de los seis documentos y del JSON antes de entregar la tabla; no depende de internet al consultar la aplicación.

El historial y la consulta por fecha usan las referencias diarias OMS-2006 ya importadas en MariaDB, contrastadas con el paquete anthro fijado del proyecto. No se sustituye la edad exacta de una evaluación por el mes de la tabla ilustrativa. La consulta diaria cubre 0–1826 días. El peso para la edad por sí solo no diagnostica sobrepeso u obesidad.

Si no se pueden verificar los parámetros diarios, el historial conserva los pesos reales y avisa que no hay comparación disponible. Si falta la tabla mensual verificada, no se inventan valores. Los puntos con edema presente, pendiente de evaluar o peso fuera de límites de calidad se señalan para revisión y no se conectan como tendencia interpretable.

## Acceso y almacenamiento

- Administración: `/crecimiento/tabla`, `/referencia`, `/ninos` y `/ninos/:codigo`, con permiso `evaluaciones.ver`.
- Usuario normal: la tabla de Inicio (`/mi-portal/crecimiento/tabla`) está disponible para cualquier sesión autenticada, sin depender del permiso de captura. Las demás rutas bajo `/mi-portal/crecimiento` requieren `evaluaciones.crear`; búsqueda e historial además requieren `ninos.buscar`.
- El servidor limita la búsqueda normal a niños registrados o evaluados por esa cuenta, y devuelve únicamente sus propias mediciones. No recibe un identificador de usuario desde el cliente.
- Se excluyen capturas anuladas. Fechas y agrupaciones usan la zona de Guatemala; Hasta incluye todo ese día. Más de 1000 mediciones requiere acotar el filtro, sin truncamiento silencioso.
- Todas estas operaciones son consultas. No hay migración, nuevos permisos ni escritura de mediciones. Las consultas temporales siguen sin formar parte del historial.
- La configuración Docker ya copia `database/`, incluidos los archivos mensuales.

## Comprobaciones

Se añadieron seis pruebas unitarias (LMS inverso, cobertura, calidad, fechas y medianas mensuales) y ocho de integración con MariaDB (autenticación, roles, aislamiento entre cuentas, anuladas, filtros, datos mensuales, referencia ausente y acceso a la tabla sin permiso de captura). La integración crea y elimina exclusivamente sus propios registros ficticios.

Desde backend:

```bash
npm test -- --runInBand growth
RUN_DB_TESTS=1 npm run test:e2e -- --runInBand growth.e2e-spec.ts
```

Fuentes: [OMS: peso para la edad](https://www.who.int/tools/child-growth-standards/standards/weight-for-age) y [OMS: longitud/talla para la edad](https://www.who.int/tools/child-growth-standards/standards/length-height-for-age).

Verificación (06/10/2026): las seis pruebas unitarias y las siete pruebas originales de integración pasaron con MariaDB local. Tras habilitar la tabla para cualquier sesión normal autenticada, se ejecutaron y aprobaron las ocho pruebas de integración, TypeScript y ESLint del backend, compilación y ESLint del frontend. Se revisaron visualmente Inicio de administración y la vista previa normal, el cambio Niño/Niña, los 61 meses y el acceso al historial desde Inicio. Además, se comprobó en el navegador una cuenta con rol Usuario normal y captura denegada: la tabla seguía visible y el selector Niño/Niña funcionaba. Las cuentas temporales de revisión fueron eliminadas. Backend, frontend y su conexión mediante el proxy respondieron correctamente.
