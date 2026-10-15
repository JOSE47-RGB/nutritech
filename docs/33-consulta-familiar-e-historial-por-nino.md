# Consulta familiar e historial por niño

## Cómo usarlo

- **Consulta sin registro** está visible en el menú de trabajo. Completa nacimiento, fecha de medición, sexo, peso, longitud/talla, método y evaluación del edema. Calcula y abre el reporte temporal sin crear expediente, evaluación guardada ni alertas de seguimiento.
- **Registrar al bebé y guardar evaluación** inicia el registro opcional desde ese resultado. Conserva las medidas, pide los datos del expediente y responsables y luego confirma la fecha/hora de la evaluación. Crear el expediente y guardar la medición son pasos separados y explícitos.
- **Evaluar a un niño registrado** guarda una medición. En la confirmación se puede consultar el resultado, guardar la orientación y generar el reporte. El enlace al historial lleva únicamente a ese niño.
- **Historial de un niño** primero pide buscar y seleccionar un expediente. No carga ni muestra una lista global de evaluaciones. «Cambiar de niño» desmonta el historial anterior antes de consultar otro.
- El correo del responsable es opcional. Si se escribe uno, debe tener formato válido.

## Explicación para la familia

El resultado muestra una explicación breve, la acción sugerida y factores generales que puede revisar el personal de salud. Los puntajes, motivos y fuentes técnicas quedan en un desplegable. Los reportes nuevos incluyen una sección para la madre, el padre o responsable antes del detalle clínico.

La capa `family-guidance.ts` interpreta las reglas ya calculadas; no recalcula umbrales, no redondea para clasificar y no convierte peso alto para la edad en obesidad. Edema presente/desconocido, datos fuera de cobertura y banderas de calidad conservan mensajes de revisión. No se infiere una causa individual de estas medidas. Las valoraciones médicas siguen separadas.

Fuentes de la explicación educativa, consultadas el 28/09/2026:
- OMS, Malnutrición: https://www.who.int/es/news-room/fact-sheets/detail/malnutrition
- OMS, Obesidad y sobrepeso: https://www.who.int/es/news-room/fact-sheets/detail/obesity-and-overweight

Se conserva el protocolo OMS/MSPAS existente. Los documentos generados anteriormente no se reescriben: una nueva generación incorpora el resumen familiar. Una orientación anterior puede requerir volver a calcular para mostrar el resumen en pantalla.

## Permisos y verificación

La búsqueda `GET /evaluaciones/pacientes-historial` exige `evaluaciones.ver` y devuelve hasta 20 niños con evaluaciones (incluidos expedientes inactivos). La lista usa `nino_codigo` en la consulta del servidor. Esto evita mezclar pacientes en la pantalla; no cambia la autorización administrativa para consultar otros expedientes.

Verificación: 70 pruebas unitarias y 22 pruebas de integración de evaluaciones aprobadas, incluyendo aislamiento del filtro, permisos, consulta temporal sin escrituras clínicas y reporte ligado a su evaluación. Compilaciones de backend/frontend y lint de archivos modificados aprobados.

El PDF continúa usando «Imprimir / Guardar como PDF» del navegador; no se cambió su mecanismo de descarga.
