# Paso 18: guardar orientaciones con trazabilidad

Actualización del paso 20: el guardado ahora genera avisos de seguimiento; consultar `20-alertas-y-seguimiento.md`. El texto restante describe el alcance original de esta etapa.

En **Historial de evaluaciones**, cada medición tiene una sección **Orientaciones guardadas**:

- **Calcular y guardar orientación** vuelve a calcular en el servidor con datos y referencias verificados. No guarda puntajes enviados por el navegador. Requiere los permisos `evaluaciones.ver` y `evaluaciones.crear`.
- **Ver últimas 20 guardadas** consulta las copias conservadas, ordenadas de más reciente a más antigua. Requiere `evaluaciones.ver`. También permite consultar el historial de una evaluación anulada, aunque no guardar nuevas orientaciones sobre ella.

Guardar no representa aprobación del médico. El registro conserva el estado `ORIENTACION_AUTOMATICA` y revisión médica `PENDIENTE`. No se crean alertas ni se cambia el estado de la evaluación. Los indicadores que necesitan revisión conservan sus motivos; guardarlos no los convierte en clasificaciones válidas.

## Qué conserva cada registro

La nueva tabla `orientaciones_guardadas` almacena una copia JSON de las medidas usadas, sexo, edad, fecha de evaluación, edema, ajustes, puntajes completos, orientación, motivos y fuentes. Incluye versiones de motor, reglas, consolidación, huella de las reglas y de las referencias LMS. Columnas independientes identifican evaluación, usuario que guardó, fecha UTC, código público y SHA-256 del contenido. La interfaz muestra fechas en Guatemala.

El JSON conserva la precisión disponible de `number` al serializar: no convierte los puntajes a DECIMAL de tres posiciones ni a texto con dos decimales para decidir categorías. La tabla previa `resultados_indicador` sigue reservada para su flujo específico; no se fuerza esta copia automática a ese esquema ni se declara validada clínicamente.

## Transacción y duplicados

El guardado bloquea la fila de evaluación, verifica referencias, calcula, inserta la copia y registra auditoría en una transacción. Dos solicitudes simultáneas para la misma evaluación se serializan. La combinación evaluación/huella es única: el mismo contenido devuelve el registro existente con su autor y fecha originales. Si el contenido o las versiones cambian, se conserva una nueva copia; no se sobrescribe la anterior.

No hay endpoints de edición o eliminación de copias. Las claves foráneas impiden borrar por accidente evaluaciones o usuarios referenciados. La consulta verifica el hash y rechaza una copia alterada; esta huella detecta cambios del contenido respecto al hash guardado, pero no es una firma digital ni protege frente a alguien con acceso para cambiar ambos en la base.

La consulta histórica no depende de las referencias actuales ni ejecuta un cálculo nuevo. La API devuelve como máximo las últimas 20 copias; una consulta paginada completa puede añadirse posteriormente.

## Instalación y rutas

La migración aditiva `database/migrations/003-orientaciones-guardadas.sql` ya fue aplicada en esta base. Para otra instalación, desde `backend`:

```bash
npm run db:migrate:orientations
npm run db:generate
```

El SQL usa `CREATE TABLE IF NOT EXISTS`; repetir el comando no borra contenido. No es una herramienta de reconciliación de tablas modificadas manualmente. El modelo correspondiente está declarado en Prisma; el servicio usa consultas parametrizadas para bloqueo y acceso al historial.

- `POST /evaluaciones/:codigo/orientaciones`: calcula y conserva; requiere sesión, ambos permisos y la protección de origen existente.
- `GET /evaluaciones/:codigo/orientaciones`: lee las últimas copias y verifica integridad.
- `GET /evaluaciones/:codigo/calculo`: sigue siendo una vista previa sin escritura.

## Verificación y siguiente paso

Se probaron precisión, guardado simultáneo sin duplicados, autor, lectura histórica, permisos, cabecera de origen, bloqueo de nuevas copias para evaluaciones anuladas y detección de contenido alterado. Las pruebas solo modifican registros sintéticos propios y los eliminan al terminar.

Validación completada: 56 pruebas unitarias y 14 de integración con MariaDB; compilación y lint del backend y frontend; esquema Prisma válido y cliente regenerado.

El siguiente paso será implementar la valoración médica y/o las alertas, manteniendo separado el hallazgo automático de la decisión registrada por el profesional.
