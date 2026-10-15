# Flujo guiado y automatización de la atención

Cambios del 28/09/2026:

- El resultado compartido por la consulta temporal, evaluación registrada y orientación guardada presenta una alerta principal con icono, texto y acción. No repite tarjetas sin conclusión. Las explicaciones y fuentes se consultan en desplegables.
- Consulta temporal: muestra edad calculada antes de enviar, conserva campos al corregir, ofrece reporte familiar y separa el registro opcional. Los datos permanecen en memoria de la pantalla, no en almacenamiento local ni historial. Salir de la pantalla descarta el borrador.
- Registrar niño: al completar expediente y responsables, abre la evaluación del niño recién creado si la cuenta dispone de esa pantalla. No obliga a buscarlo de nuevo.
- Evaluación registrada: «Guardar, calcular y ver alertas» guarda la medición y usa el proceso de orientación existente para conservar el cálculo y generar avisos de seguimiento. No se guarda una valoración médica automática. Si falla la orientación, se reintenta ese paso sin crear otra medición.
- La generación del reporte sigue siendo explícita. En la consulta temporal abre una versión familiar breve con detalle técnico desplegable; imprimir/PDF usa el diálogo del navegador.
- Inicio: acceso directo al cálculo temporal y explicación de las tareas. Alertas: estados «Por revisar», «En seguimiento», etc., y formularios con preguntas comprensibles. No se alteraron permisos ni transiciones permitidas.

Verificación: compilación y lint del frontend; 22 pruebas de integración de evaluaciones (incluyen permisos, orientación deduplicada, alertas, reportes y consulta temporal sin persistencia). En navegador se comprobó un ejemplo ficticio de medidas dudosas, conservación de todos los campos al corregir, un resultado de referencia para 730 días/12 kg/85 cm y la apertura del reporte familiar. No se crearon pacientes ni evaluaciones reales en esa comprobación visual.

La automatización cubre registro → evaluación → orientación/avisos y consulta → resultado/reporte. Datos identificativos, medidas observadas, evaluación del edema y decisiones clínicas siguen siendo aportados por las personas correspondientes. El sistema no inventa datos para omitir esos pasos.
