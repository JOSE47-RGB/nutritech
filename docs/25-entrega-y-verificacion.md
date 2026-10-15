# Entrega local de NutriTech — 17 de septiembre de 2026

## Alcance implementado

La versión local incluye inicio de sesión y recuperación administrativa de contraseña, permisos, expedientes y responsables, captura e historial de evaluaciones, cálculo nutricional, orientaciones guardadas, valoración médica, alertas y seguimiento, reportes imprimibles, panel de conteos, administración de usuarios, asignación de roles, edición de permisos por rol, personalización del menú, auditoría y respaldos cifrados.

El médico conserva la decisión final. Patrones y reglas se consultan con su trazabilidad; no se ha añadido un editor para activar reglas clínicas arbitrarias. La consolidación documental OMS/MSPAS y los casos especiales están descritos en los documentos anteriores. La implementación técnica no equivale a una validación clínica institucional.

## Verificación realizada

- 64 pruebas unitarias, 11 suites.
- 59 pruebas de integración, 6 suites con MariaDB: autenticación, expedientes, evaluaciones, patrones, administración y API inicial.
- TypeScript y ESLint del backend; compilación y ESLint del frontend.
- Respaldo local cifrado, autenticación del contenido y restauración de ensayo a una base temporal: 29 tablas y vistas consultables; base temporal eliminada al terminar.
- Dockerfiles de backend y frontend construidos con Podman en Fedora. Nginx pasó `nginx -t`.
- Instalación nueva mediante Compose/Podman en un proyecto aislado: MariaDB y backend saludables, HTTPS local, login y cookies Secure/HttpOnly, 14 rutas autenticadas, respaldo cifrado desde el contenedor y cierre de sesión comprobados.
- Dependencias transitivas corregidas: multer 2.4.0, effect 3.22.2 y deepmerge-ts 8.0.2, fijadas con overrides. Prisma se regeneró y las suites completas se repitieron. `npm audit` y `npm audit --omit=dev` informaron cero vulnerabilidades conocidas en esa consulta.

El servidor de desarrollo tenía dos procesos NestJS vigilando la misma carpeta. Se detuvieron y se dejó una sola instancia en 3017; el backend y el proxy de Vite volvieron a responder HTTP 200.

Las comprobaciones de las nuevas pantallas administrativas cubren compilación, permisos y API. No se completó un recorrido visual autenticado de todos los formularios en el navegador. La impresión de reportes usa el diálogo del navegador, no un generador PDF del servidor.

## Recorrido para la presentación

1. Iniciar sesión y explicar el menú según permisos.
2. Registrar un expediente ficticio y su responsable.
3. Capturar una evaluación con fecha, peso, longitud/talla y estado de edema.
4. Revisar puntajes y recomendaciones; explicar que los decimales mostrados no cambian la categoría calculada con el valor completo.
5. Guardar la orientación: conserva la información y versiones de ese momento.
6. Con una cuenta de médico autorizada, registrar la valoración profesional.
7. Consultar alertas, documentar su seguimiento y explicar los estados.
8. Generar el reporte, imprimir o guardar como PDF y abrirlo luego desde Reportes.
9. Mostrar Dashboard y sus conteos, sin presentarlos como prioridad clínica.
10. Con administración, mostrar usuarios, permisos, auditoría y respaldos.

Usa datos ficticios para una demostración pública. No modifiques información real solo para hacer la presentación.

## Puesta en marcha habitual

Terminal del backend, desde `backend`:

```bash
PORT=3017 npm run start:dev
```

Terminal del frontend, desde `frontend`:

```bash
npm run dev
```

Abre `http://localhost:5173`. Mantén una sola instancia de cada servicio. No ejecutes `npm run build` del backend sobre la misma carpeta `dist` mientras el modo watch la está regenerando; detén el modo watch o construye en un entorno separado.

Para la instalación nueva en contenedores consulta `24-despliegue-local.md`. No se ha publicado el sitio en internet. Dominio, certificados confiables, respaldos externos y validación institucional son decisiones de puesta en servicio, distintas de la entrega local.

## Cierre técnico del 18 de septiembre de 2026

Se completó la anulación de evaluaciones desde el historial y la API, con permiso específico, motivo obligatorio, registro de autor/fecha, auditoría y bloqueo transaccional para evitar sobrescribir motivos con solicitudes simultáneas. Conserva el historial y los reportes; no cierra automáticamente alertas. No requiere migraciones.

Se agregó el manual `26-manual-de-uso.md` y un comando reproducible en la raíz del proyecto:

```bash
npm run verify
npm run verify:db
```

El primero ejecuta tipos, análisis estático, pruebas unitarias, pruebas de archivos de referencias y compilación del frontend. El segundo añade las suites de integración sobre la base configurada, con creación y limpieza de datos ficticios. El verificador no recompila `backend/dist` para evitar interferir con una instancia en modo watch; comprueba sus tipos con `tsc --noEmit`.

La pantalla de acceso y su comprobación de conexión respondieron correctamente en el navegador. No se completó un recorrido visual autenticado: la pestaña estaba en inicio de sesión. La revisión clínica institucional, el despliegue público y la conformidad con una rúbrica universitaria no proporcionada no se presentan como completados.

Resultado de `npm run verify:db` del 18 de septiembre: **64 pruebas unitarias y 60 de integración aprobadas**, además de 5 pruebas de archivos de referencia (la prueba adicional de importación en base de datos se omite en esa suite), TypeScript, ESLint y compilación del frontend. Las seis suites de integración terminaron sin fallos y el comando finalizó con código 0.

## Actualización: recorrido visual con sesión abierta

Se realizó posteriormente una revisión autenticada de navegación, listados, detalle de expediente, cálculo provisional y formularios sin guardar cambios. Se corrigieron títulos de pestaña y mensajes desactualizados. El alcance y las limitaciones están registrados en `27-revision-visual.md`; reemplaza el pendiente de acceso visual mencionado antes, pero no implica haber probado visualmente todas las operaciones de escritura o la exportación PDF.
