# Paso 23: panel de seguimiento

## Uso

Selecciona **Dashboard** en el menú. El panel muestra cinco conteos y la fecha de consulta en horario de Guatemala. **Actualizar resumen** vuelve a consultar la base de datos; no hay actualización automática. Los enlaces llevan a las listas existentes, sin aplicar filtros nuevos.

## Qué significa cada cifra

- **Niños activos:** expedientes con estado ACTIVO.
- **Evaluaciones registradas:** evaluaciones con estado REGISTRADA; excluye anuladas.
- **Orientaciones sin valoración médica:** copias guardadas de evaluaciones registradas que todavía no tienen ninguna valoración. Cuenta orientaciones, no pacientes: un niño puede tener varias. No indica si una valoración existente requiere acciones adicionales.
- **Alertas pendientes:** avisos con estado PENDIENTE.
- **Alertas en revisión:** avisos con estado EN_REVISION.

Los conteos abarcan todo el sistema y todas las fechas, como las listas actuales; no se limitan al centro del usuario. Las alertas incluyen avisos abiertos de evaluaciones anuladas. No representan prioridad clínica ni una clasificación adicional.

## Cómo funciona

El frontend React solicita `GET /dashboard`. NestJS valida la sesión y exige `dashboard.ver`. Para cada grupo de cifras consulta además el permiso del módulo: `ninos.ver`, `evaluaciones.ver` o `alertas.ver`. Si falta, devuelve `null` y React muestra «Sin permiso de consulta». No se entrega el conteo para ocultarlo solo visualmente.

Prisma calcula los conteos sobre las tablas existentes dentro de una transacción con aislamiento RepeatableRead: las cifras pertenecen a una misma lectura consistente. No se guardan copias de estadísticas y no se requiere migración. La respuesta usa `Cache-Control: no-store`.

El frontend distingue carga, error, falta de permiso y cero registros. Al actualizar, retira las cifras anteriores para no presentarlas como recientes si falla la petición. Cancela solicitudes al salir y limita la espera a 15 segundos.

## Comprobaciones

Compilación y análisis estático del backend y frontend; pruebas unitarias y prueba de integración con MariaDB para sesión obligatoria, conteos, permiso del dashboard y ocultación de cifras al denegar permisos de los módulos. La integración crea y limpia sus registros de prueba. No se realizó revisión visual autenticada en el navegador.
