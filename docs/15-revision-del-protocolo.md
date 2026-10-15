# Paso 15: revisión técnica del protocolo y casos especiales

Actualización: el autor seleccionó OMS y MSPAS Guatemala y confirmó que la decisión final corresponde al médico. La consolidación posterior está documentada en `16-consolidacion-oms-mspas.md`; los pendientes descritos aquí reflejan el estado de este paso.

En **Configuración → Patrones nutricionales → Revisar propuesta** aparece ahora **Revisión de casos especiales**. Cada caso explica el comportamiento del software y la decisión que queda pendiente. La API entrega esta matriz en `protocolo.casos`; también identifica la versión técnica `REVISION-TECNICA-1` y deja explícitos el protocolo local y responsable clínico todavía sin confirmar.

## Alcance de esta revisión

Esta etapa verifica el comportamiento técnico existente. No certifica un protocolo clínico ni habilita guardar clasificaciones. `permite_persistir: false` describe el estado del borrador: no es un mecanismo de autorización para un futuro endpoint de escritura. Ese endpoint todavía no existe y deberá aplicar sus propias validaciones.

Las tablas de crecimiento y un protocolo de atención cumplen funciones distintas. Como referencia para la revisión profesional, la [guía OMS de 2023 sobre emaciación y edema nutricional](https://www.who.int/publications/i/item/9789240082830) abarca menores de cinco años y sustituye la guía de manejo de desnutrición aguda severa de 2013. No se ha declarado que el proyecto implemente esa guía ni se ha seleccionado un protocolo del MSPAS sin confirmación del autor del proyecto.

## Matriz revisada

| Caso | Comportamiento comprobado/documentado | Decisión pendiente |
| --- | --- | --- |
| Edema presente | P_E, P_T e IMC_E no disponibles; T_E puede calcularse por separado. | Evaluación clínica y derivación; T_E no debe usarse como resumen tranquilizador. |
| Edema desconocido | No se interpreta como ausencia. Se omiten indicadores dependientes del peso. | Confirmar evaluación y registro. |
| Edad fuera de cobertura | El motor usa su contrato de edad en días: 1826 todavía dentro, 1827 fuera. No extrapola. | Seleccionar referencia alternativa y confirmar alcance por edad del protocolo. Este umbral computacional no sustituye reglas clínicas por cumpleaños. |
| Talla fuera de cobertura | P_T queda no disponible; otros indicadores mantienen su cálculo independiente. | Revisar medida y método; no sustituir indicadores automáticamente. |
| Referencias ausentes o alteradas | El motor informa referencia ausente; la API exige verificar el conjunto antes de calcular. | Restaurar y verificar la fuente. |
| Medidas inválidas | No se produce un puntaje utilizable para medidas no positivas; entradas no finitas se rechazan. | Corregir la medición original. |
| Calidad marcada o desconocida | La función de revisión del borrador no asigna categoría. | Definir responsable de confirmar o corregir los datos. |
| Método marcado | Al recibir la marca del motor, el borrador no asigna categoría. | Revisar método, sin perder la medida original ni su ajuste. |
| Indicadores distintos | No se sintetizan en un diagnóstico único. | Definir interpretación conjunta y criterios adicionales, especialmente por grupos de edad. |

Un valor `null` con un motivo significa **no disponible**, nunca “normal”. Un puntaje con bandera puede mostrarse para investigar el dato, pero eso no equivale a aceptar su clasificación.

## Cómo lo comprobamos

`backend/src/nutrition/protocol-review.spec.ts` añade ocho pruebas: edema presente/desconocido, borde de edad, cobertura independiente de P_T, marca del método, calidad marcada/desconocida y estado pendiente del protocolo. Usa las referencias locales verificadas y el motor real. Las pruebas del motor y del borrador existentes cubren las medidas inválidas, referencias ausentes y límites de intervalos.

La función `reviewDraftScore()` continúa reservada para pruebas del borrador; no se ha conectado al expediente. La prueba de integración de patrones comprueba que la API entrega los nueve casos y mantiene la persistencia deshabilitada en la propuesta.

Desde `backend`:

```bash
npm test -- --runInBand
npm run test:patrones
npm run classification:review
```

## Información necesaria para cerrar la revisión clínica

Registrar el título, versión y enlace del protocolo aplicable, nombre/rol del revisor, fecha de revisión y decisiones sobre etiquetas, edema, menores de seis meses, calidad, método y prioridades. Si se requieren otros datos para aplicar el protocolo, habrá que revisar su captura antes de implementar decisiones basadas en ellos. No se completan estos campos con supuestos.

Una vez resueltas esas decisiones, el siguiente desarrollo será diseñar la persistencia con trazabilidad: puntaje sin redondear, versión del motor, referencias y reglas usadas. En este paso no se cambiaron tablas, no se guardaron clasificaciones y no se activaron alertas.
