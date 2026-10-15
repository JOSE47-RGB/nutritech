# NutriTech

Proyecto de graduación: sistema web para el seguimiento nutricional infantil.

## Empezar y verificar

La versión local incluye los módulos descritos abajo. Consulta `docs/26-manual-de-uso.md` para el recorrido y `docs/25-entrega-y-verificacion.md` para las comprobaciones y límites de la entrega.

Estado revisado al 7 de octubre de 2026: [inventario de módulos, correcciones y prioridades](docs/43-revision-general-y-pendientes.md). Incluye un problema confirmado de acceso a alertas desde el perfil normal y pendientes de instalación que deben corregirse antes de publicar. Las etapas descritas más abajo conservan el historial del desarrollo.

En dos terminales: `cd backend && PORT=3017 npm run start:dev` y `cd frontend && npm run dev`. Abre http://localhost:5173.

Desde esta carpeta, `npm run verify` comprueba tipos, lint, pruebas unitarias, referencias y compilación del frontend. `npm run verify:db` añade integración con la MariaDB configurada en `backend/.env`; crea y limpia registros de prueba. No importa el esquema, no cambia contraseñas ni publica el proyecto. Requiere dependencias instaladas en ambos subproyectos.

## Tecnologías acordadas

- Backend: Node.js, NestJS y TypeScript.
- Frontend: React, TypeScript, Vite y Tailwind CSS.
- Base de datos: MariaDB 10.11, administrada desde phpMyAdmin.
- ORM: Prisma.
- Autenticación: JWT y bcrypt.
- Despliegue planificado: Docker y Nginx.

## Estructura inicial

```text
nutritech/
├── backend/        # API NestJS inicializada
├── frontend/       # React, Vite y Tailwind CSS
├── database/
│   └── nutritech.sql
├── infra/          # Configuración Docker y Nginx para HTTPS local
├── .editorconfig
├── .gitignore
└── package.json
```

## Historial del desarrollo actual

Los módulos del menú están implementados para la versión local: expedientes, evaluaciones, orientaciones, valoración médica, alertas, reportes, dashboard, usuarios, roles, menús, auditoría y respaldos. Consulta `docs/25-entrega-y-verificacion.md` para las comprobaciones y limitaciones de esta entrega.

Inicio incluye una tabla OMS de peso y talla por edad para niño o niña. El módulo Crecimiento ofrece gráficas de las mediciones guardadas por día, mes o año en ambas vistas, con el historial normal limitado a su propia cuenta. Guía y fuentes: `docs/40-crecimiento-y-tabla-de-inicio.md`.

La navegación interactiva, selección de visitas y adaptación móvil de Crecimiento se describen en [docs/42-crecimiento-interactivo.md](docs/42-crecimiento-interactivo.md).

La consulta rápida y la captura de evaluaciones muestran una referencia de peso mientras se llenan los datos, con comparación del peso medido y sin rellenarlo automáticamente. Detalles y comprobaciones: [docs/44-referencia-de-peso-en-formularios.md](docs/44-referencia-de-peso-en-formularios.md).

Las alertas identifican la medida que necesita confirmación, distinguen edema pendiente de presente y explican qué hacer si se confirma una medida extrema. Pantalla, reportes y seguimiento: [docs/45-validacion-de-medidas-y-alertas.md](docs/45-validacion-de-medidas-y-alertas.md).

## Historial del inicio

Paso 1 completado: estructura inicial y copia del SQL proporcionado por el autor.
El SQL original se conserva sin modificaciones. En ese primer paso todavía no se había importado; la instalación local y las migraciones se completaron posteriormente.
Las referencias a Laravel en sus comentarios pertenecen al documento original;
el backend del proyecto se desarrollará con NestJS.

Entorno detectado al crear el proyecto: Node.js 22.22.0 y npm 10.9.4.
El backend se inicia con `cd backend` y `PORT=3017 npm run start:dev`.
El endpoint inicial es http://localhost:3017 y responde `Hello World!`.

## Etapas implementadas

1. Backend NestJS creado; consultar `backend/README.md` para ejecutarlo.
2. Frontend creado: `cd frontend` y `npm run dev`; abrir http://localhost:5173.
3. MariaDB conectada mediante Prisma: 27 modelos obtenidos de la base existente. Ejecutar `npm run db:check` desde `backend` para comprobar la conexión.
4. Inicio de sesión JWT/bcrypt implementado. Crear la primera cuenta con `npm run auth:create-admin` desde `backend`; consultar `docs/03-inicio-de-sesion.md`. Los permisos de cada módulo se implementarán con sus endpoints.
5. Menú dinámico y consulta de roles implementados; consultar `docs/04-menu-y-permisos.md`.
6. Listado y registro de niños implementados: consultar `docs/05-modulo-ninos.md`.
7. Detalle del expediente y responsables familiares implementados: `docs/06-expediente-y-responsables.md`.
8. Captura e historial de evaluaciones manuales implementados: `docs/07-evaluaciones-manuales.md`.
9. Consulta de patrones, parámetros cargados y reglas implementada: `docs/08-consulta-de-patrones.md`.
10. Referencias oficiales descargadas e importación verificable preparada (simulación): `docs/09-referencias-e-importacion.md`.
11. Referencias OMS-2006 cargadas y verificadas: `docs/10-carga-de-referencias.md`. El patrón permanece inactivo.
12. Motor TypeScript contrastado con 500 casos ejecutados en anthro: `docs/11-motor-de-calculo.md`. Sin activación ni resultados persistidos.
13. Estado de edema y consulta de puntajes provisionales integrados en evaluaciones: `docs/12-edema-y-calculo-provisional.md`.
14. Propuesta de 20 reglas definida y revisada técnicamente, todavía en borrador: `docs/13-reglas-de-clasificacion.md`. Incluye límites exactos, fuentes y verificación reproducible.
15. Puntajes sin redondeo de salida conservados en el motor y la API: `docs/14-puntajes-sin-redondear.md`. Presentación a dos decimales y pruebas de precisión e integración verificadas.
16. Casos especiales revisados técnicamente y disponibles en la propuesta: `docs/15-revision-del-protocolo.md`. Pendiente confirmar protocolo local y responsable clínico antes de persistir clasificaciones y definir alertas.

17. Base documental OMS y MSPAS consolidada: `docs/16-consolidacion-oms-mspas.md`. Se distinguen apoyo clínico, vigilancia, discrepancias y datos pendientes; decisión final del médico.

18. Orientación por evaluación implementada: `docs/17-orientacion-por-evaluacion.md`. Clasificación provisional, recomendaciones con fuente y avisos de datos pendientes; sin persistencia.

19. Guardado e historial de orientaciones automáticas: `docs/18-guardar-orientaciones.md`. Copias con versiones, fuentes, autor y huellas; revisión médica pendiente.

20. Valoración médica con permiso específico e historial: `docs/19-valoracion-medica.md`. Conserva la orientación automática y registra la decisión del profesional por separado.

21. Alertas y seguimiento implementados: `docs/20-alertas-y-seguimiento.md`. Generación al guardar orientación, bandeja, historial y control de concurrencia.

22. Reportes imprimibles y archivo implementados: `docs/21-reportes-imprimibles.md`. Copia de orientación, valoraciones y seguimiento; impresión o guardado como PDF desde el navegador.

23. Panel de seguimiento conectado: `docs/22-panel-de-seguimiento.md`. Conteos con permisos por módulo, fecha de consulta y accesos a las listas.

24. Administración de usuarios, permisos por rol, menús, auditoría y respaldos cifrados: `docs/23-administracion-y-respaldos.md`.

25. Preparación de Docker, MariaDB y Nginx con HTTPS local: `docs/24-despliegue-local.md`.

26. Anulación auditada de capturas incorrectas desde el historial, con permiso y motivo obligatorio. Guía de uso: `docs/26-manual-de-uso.md`.

27. Edición auditada de nombres, dirección y estado del expediente con control de concurrencia: `docs/28-edicion-de-expedientes.md`.

28. Vista propia para Usuario normal: `docs/29-vista-usuario-normal.md`. Actualizada a consulta y reporte sin expediente ni persistencia clínica: `docs/30-consulta-sin-expediente.md`.

Para instalar desde cero, importar `database/nutritech.sql` y después `database/migrations/001-permisos-utc.sql` y `database/migrations/002-evaluaciones-edema.sql` y `database/migrations/003-orientaciones-guardadas.sql` y `database/migrations/004-valoraciones-medicas.sql` y `database/migrations/005-alertas-orientacion.sql` y `database/migrations/006-reportes-imprimibles.sql`.

Para habilitar la búsqueda de responsables por DPI en instalaciones existentes, ejecutar `node scripts/migrate-guardian-dpi.cjs` desde backend y regenerar Prisma con `npm run db:generate`. Instalaciones nuevas deben aplicar también `database/migrations/007-responsables-dpi.sql`. Guía: `docs/32-padres-y-dpi.md`.
