# Paso 20: alertas y seguimiento

En el menú **Alertas → Alertas nutricionales** se encuentra la bandeja. Permite filtrar por estado, paginar (20 por página), consultar el origen y el historial, y registrar seguimiento con justificación. Las fuentes aparecen en el detalle de la orientación conservada.

## Cuándo se generan

Los avisos se crean dentro de la misma transacción que guarda una orientación. Consultar el cálculo provisional no escribe alertas. Para procesar una orientación anterior a esta etapa, usa **Calcular y guardar orientación**: si devuelve la copia existente, genera únicamente los avisos que falten para ella. No se realizó una carga masiva retrospectiva ni se enviaron mensajes externos.

La política `NUTRITECH-SEGUIMIENTO-1` usa las recomendaciones ya implementadas:

| Caso | Aviso |
| --- | --- |
| Clasificación fuera de los cuatro intervalos centrales del catálogo | Hallazgo para revisión profesional |
| Edema presente | Un aviso de revisión clínica por orientación |
| Edema desconocido | Un aviso para completar datos por orientación |
| Puntaje ausente, calidad marcada o método en revisión | Aviso de datos por indicador |
| Indicador en intervalo central, con datos utilizables | No crea aviso por ese indicador |

No tener avisos no significa que se haya descartado todo riesgo clínico. Los datos clínicos todavía no capturados siguen señalados en la orientación. Las etiquetas son reglas operativas del proyecto basadas en su catálogo, no un protocolo oficial de triaje.

Los registros nuevos usan el valor técnico `OBSERVAR` de la tabla existente por compatibilidad. La interfaz no lo presenta como categoría médica ni decide tiempos de atención. No se generan automáticamente niveles PRIORITARIO o URGENTE a partir del color, del puntaje aislado o de información clínica desconocida. Una priorización clínica requiere su propio diseño y criterios.

## Flujo de trabajo

- Pendiente → En revisión: comienza el seguimiento; se registra el usuario responsable.
- Pendiente → Descartada: exige justificar por qué no procede.
- En revisión → Atendida o Descartada: registra autor, fecha y comentario.
- Atendida o Descartada → En revisión: permite reabrir con justificación sin eliminar el cierre anterior.

“Atendida” significa que el profesional registró la atención del aviso; no declara recuperación nutricional ni modifica una valoración médica. Una evaluación anulada conserva sus avisos, pero solo permite descartarlos con justificación. No se eliminan por anular la evaluación ni se reabren al repetir el cálculo.

Cada operación exige comentario de 10 a 600 caracteres. Un número de revisión evita sobrescribir un cambio concurrente: si otra persona modificó la alerta, la API responde conflicto y se debe actualizar la bandeja. Los cambios se guardan junto con el historial y auditoría en una transacción.

## Permisos y datos

- `alertas.ver`: bandeja, orientación de origen e historial.
- `alertas.atender`, además de lectura: registrar cambios.

Se reutilizan los permisos y asignaciones existentes. La autorización se comprueba en el servidor y se mantiene la protección de origen para las escrituras. La lectura no cambia estados. Una valoración médica no cierra alertas automáticamente; son registros diferentes.

Se amplió `alertas` con origen por orientación, tipo, regla, política y revisión. La relación antigua con `resultados_indicador` continúa disponible; un CHECK exige exactamente uno de los dos orígenes. La clave única orientación/regla/política evita duplicados. Las alertas de distintas copias de una evaluación permanecen distintas y muestran el código de origen.

Se conserva la tabla `historial_alerta`. Las vistas SQL antiguas que unen exclusivamente con `resultados_indicador` no incluyen el nuevo origen: esta bandeja consulta las tablas y relaciones directamente. No deben usarse esas vistas antiguas para contar todas las alertas sin adaptarlas primero.

## Instalación y verificación

Se aplicó la migración `005-alertas-orientacion.sql`, preservando registros previos. En otra instalación, aplicar primero las migraciones 001–004 y luego, desde backend:

```bash
npm run db:migrate:alerts
npm run db:generate
npm test -- --runInBand
npm run test:evaluaciones
```

Pasaron 61 pruebas unitarias y 16 de integración con MariaDB, además de compilación TypeScript, validación Prisma y lint del backend y frontend. Se probaron categorías de aviso, deduplicación, generación al guardar, reintentos, permisos, protección de origen, estados inválidos, cambios simultáneos, reapertura e historial. Las pruebas usan registros sintéticos y los eliminan al terminar.

La comprobación del navegador encontró la sesión vencida en la pantalla de acceso; la bandeja autenticada no se revisó visualmente con la cuenta del usuario. No se cambió su contraseña ni se ingresaron datos clínicos reales para probar.

Rutas: `GET /alertas`, `GET /alertas/:codigo`, `POST /alertas/:codigo/estado`. La siguiente etapa puede preparar el reporte de orientación, valoración médica y seguimiento para revisión o impresión.
