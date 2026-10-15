# Paso 7: captura e historial de evaluaciones

## Qué puedes hacer

Entra a NutriTech y pulsa **Actualizar menú**. Según tus permisos, aparecen habilitadas **Capturar peso y altura** e **Historial de evaluaciones**.

1. Busca al niño por nombre o expediente (mínimo 3 caracteres).
2. Selecciona el expediente comprobando su nombre y fecha de nacimiento.
3. Selecciona un centro de salud activo. Si tu cuenta tiene un centro asignado, únicamente podrás usar ese centro.
4. Indica fecha y hora, peso en kg, longitud/talla en cm, método y lugar de medición. Las observaciones son opcionales.
5. Pulsa **Guardar medición**. La confirmación muestra el código del registro y la edad calculada en días.
6. Consulta el historial si tu cuenta tiene permiso. Se muestran 20 registros por página, del más reciente al más antiguo.

Las pantallas emplean la paleta acordada. Si no aparecen las opciones, actualiza el menú y verifica los permisos de tu cuenta.

## Cómo funciona, paso a paso

**React** construye el formulario y envía JSON a `/api/evaluaciones`. Vite redirige esa solicitud al backend local. La cookie de sesión identifica al usuario; el formulario no envía el autor ni el estado del registro.

**NestJS** comprueba primero la sesión y los permisos. El DTO (`evaluation.dto.ts`) valida tipos, límites y campos permitidos. El servicio vuelve a comprobar la existencia del niño, su estado, la fecha y el centro antes de guardar.

**Prisma** ejecuta una transacción: guarda la evaluación y su auditoría juntas. Si una operación falla, no queda un registro a medias. El bloqueo del niño también permite reconocer dos envíos idénticos concurrentes del mismo usuario y devolver el mismo registro.

**MariaDB** conserva la medición en `evaluaciones_nutricionales`. Tu SQL ya define `imc` como una columna generada: la base calcula `ROUND(peso_kg / POW(talla_cm / 100, 2), 2)`. El backend no escribe en esa columna. El valor calculado no implica por sí solo una clasificación nutricional.

## Reglas implementadas

- Solo niños activos; fecha válida, no futura y no anterior al nacimiento.
- La edad se calcula con fechas de calendario en `APP_TIMEZONE` (actualmente `America/Guatemala`), desde el nacimiento hasta el día de la evaluación.
- La captura se limita a evaluaciones anteriores al quinto cumpleaños. Para nacimiento el 29 de febrero, el corte en un año no bisiesto es el 1 de marzo. Es una regla del módulo, más estricta que el máximo de 2200 días de la tabla.
- Peso entre 0.30 y 100.00 kg y longitud/talla entre 30.00 y 150.00 cm, hasta dos decimales: son límites técnicos tomados del SQL, **no rangos de normalidad nutricional**.
- Se rechazan combinaciones que excedan la capacidad `DECIMAL(5,2)` del IMC generado.
- Estado inicial `REGISTRADA` y origen `MANUAL_WEB`, asignados por el servidor. Observaciones de hasta 2000 caracteres.
- Un reintento con el mismo niño, autor, centro, instante, medidas, método, lugar y observaciones devuelve el registro existente si sigue `REGISTRADA`. Cambiar esos datos puede crear otra medición.
- El formulario interpreta la hora en la zona del dispositivo (indicada en pantalla), la envía con zona y el backend guarda el instante UTC. El historial lo muestra en hora de Guatemala.

## Permisos y endpoints

| Endpoint | Permiso |
| --- | --- |
| `GET /evaluaciones` | `evaluaciones.ver` |
| `GET /evaluaciones/ninos?busqueda=...` | `evaluaciones.crear` y `ninos.buscar` |
| `GET /evaluaciones/centros` | `evaluaciones.crear` |
| `POST /evaluaciones` | `evaluaciones.crear` |

El listado admite `pagina` y un filtro opcional `nino_codigo` (código público). Los permisos de consulta y captura son independientes. Los endpoints requieren sesión y no exponen certificados, contraseñas ni identificadores internos de niños o evaluaciones. El catálogo de centros entrega su identificador para seleccionarlo.

## Dónde mirar lo guardado

En phpMyAdmin, selecciona la base `nutritech` y abre **evaluaciones_nutricionales → Examinar**. Verás las medidas, edad, fecha, centro y autor. La tabla **registros_auditoria** registra quién creó la evaluación. Para la operación habitual, utiliza el historial de la aplicación.

## Archivos para aprender

- `frontend/src/components/Evaluaciones.tsx`: formulario, confirmación e historial.
- `frontend/src/components/Workspace.tsx`: conecta las pantallas al menú existente.
- `backend/src/evaluaciones/evaluation.dto.ts`: validaciones de entrada.
- `backend/src/evaluaciones/evaluaciones.controller.ts`: rutas y permisos.
- `backend/src/evaluaciones/evaluaciones.service.ts`: edad, consultas, transacción y auditoría.
- `backend/test/evaluaciones.e2e-spec.ts`: pruebas con datos temporales en MariaDB.

## Verificación

Desde `backend`, ejecuta `npm run test:evaluaciones` para las nueve pruebas de integración del módulo. Crean sus propios usuarios, centros y niños de prueba y eliminan esos datos al terminar. `npm test -- --runInBand` incluye cuatro pruebas de edad (cambio de día local, futuro, quinto cumpleaños y 29 de febrero).

No se requieren nuevas tablas ni importar otra vez tu base de datos.

## Alcance de este paso

Incluye captura e historial. Los puntajes Z, clasificaciones, alertas, validación, anulación y sustitución de evaluaciones quedan pendientes. Los patrones de referencia y sus reglas deberán estar validados antes de habilitar clasificaciones. El IMC generado por el SQL se conserva; en esta etapa las pantallas muestran las medidas originales.
