# Asistente de explicación con IA y MCP

Estado: propuesta de integración, pendiente de elegir proveedor y configurar el modelo. Revisada el 06/10/2026. No se ha instalado un modelo, activado un agente ni enviado información de pacientes a servicios externos.

## Qué verá el usuario

Al terminar una evaluación, NutriTech conservará el resultado actual y podrá añadir «Explicación con IA»: un resumen breve de lo que muestran las medidas, los avisos que requieren atención y preguntas para la consulta con el personal de salud. La misma función estará disponible para administrador y usuario normal, respetando el acceso actual a cada evaluación.

El reporte conservará las cifras y las fuentes originales. La explicación generada deberá distinguirse del resultado calculado y de una valoración médica. Si el modelo no está disponible, se agota la cuota o tarda demasiado, seguirá funcionando el reporte actual con su guía familiar.

## Cómo se conecta

1. React envía la evaluación al backend NestJS, como ahora.
2. El backend valida medidas, edad exacta, sexo, método de medición y estado de edema; usa el motor OMS existente para obtener los indicadores y avisos.
3. Un servidor MCP ofrece herramientas limitadas para consultar ese resultado y las fuentes ya verificadas. MCP es el protocolo de conexión; el modelo de IA es quien redacta la explicación.
4. El agente recibe únicamente la información necesaria para explicar el resultado. La clasificación, los puntajes y las alertas proceden del motor existente.
5. El backend valida la estructura de la respuesta y la devuelve como contenido generado por IA. La evaluación médica y las decisiones de tratamiento siguen correspondiendo al profesional.

Una API directa del backend al modelo también permitiría esta función. MCP aporta valor si se quiere reutilizar las herramientas de NutriTech desde varios agentes; no es requisito de una API gratuita.

## Datos y herramientas propuestos

- `consultar_resultado_actual`: indicadores calculados, clasificación orientativa, motivos de revisión y avisos de la evaluación autorizada. El backend fija la evaluación y el usuario; el agente no puede seleccionar arbitrariamente expedientes de otros pacientes.
- `consultar_fuentes_nutricionales`: títulos, versiones y enlaces de las referencias utilizadas en ese resultado; sin búsqueda abierta ni fuentes inventadas.
- Un modo de demostración utilizará casos completamente ficticios, separados de los expedientes existentes.

La entrada mínima de cálculo incluye edad en días, sexo, peso en kg, longitud/talla en cm, método de medición y edema (sí/no/desconocido). Peso y talla por sí solos no permiten evaluar todos los indicadores ni determinar la causa de un hallazgo.

El contexto destinado al modelo excluirá nombres, DPI, códigos de expediente, dirección, fecha completa de nacimiento, credenciales, notas libres e información de familiares. La reducción de campos no convierte automáticamente las medidas de salud en información anónima.

El servidor MCP propuesto no tendrá herramientas para escribir SQL, editar expedientes, cerrar alertas, prescribir, cambiar clasificaciones ni registrar decisiones médicas. Las claves del proveedor permanecerán en el backend. Las consultas temporales conservarán su carácter temporal.

## Opciones verificadas

| Opción | Coste y operación | Uso inicial propuesto |
| --- | --- | --- |
| Ollama con un modelo descargado y ejecución exclusivamente local | Sin tarifa de una API remota por consulta; requiere memoria, almacenamiento y recursos del equipo. Su API local no exige clave. | Primera opción para mantener los datos en el equipo. Falta instalarlo, seleccionar modelo y medir calidad y velocidad en español. |
| GroqCloud, plan gratuito | Tiene cuotas de peticiones y tokens que varían por modelo y cuenta; no es ilimitado. Requiere cuenta y clave de API. | Demostración con casos ficticios. El uso con datos reales requiere revisar las condiciones, la configuración de retención y la autorización correspondiente. |

Groq permite configurar Zero Data Retention, pero también documenta supuestos de retención y condiciones de uso: el nivel gratuito por sí solo no acredita que el servicio sea apropiado para datos clínicos.

Gemini API no se propone para esta función clínica: sus términos consultados restringen el uso en práctica clínica y asesoramiento médico. En servicios gratuitos también indican que no se envíe información sensible, confidencial o personal.

## Puntos existentes de integración

- `backend/src/evaluaciones/evaluation-calculation.service.ts`: cálculo verificado y salida con `orientacion`, `guia_familiar`, referencias y versiones.
- `backend/src/nutrition/family-guidance.ts`: explicación determinista que seguirá disponible sin IA.
- `backend/src/user-portal/user-portal.module.ts`: consultas temporales y comprobación de propiedad de evaluaciones del usuario normal.
- `frontend/src/components/UserResult.tsx`: presentación del resultado guardado y acceso al reporte.

## Validaciones antes de activar

Probar casos ficticios de intervalos centrales, peso bajo/elevado, edema presente/desconocido, edad fuera de cobertura y medidas dudosas. Una respuesta del modelo no debe convertir «requiere revisión» en «normal», eliminar avisos ni sustituir cifras o umbrales. Las indicaciones urgentes existentes se mostrarán sin esperar al modelo. No se habilitarán recomendaciones generadas para familias sólo por aprobar una validación de JSON; también se necesita revisar su contenido y comportamiento.

Comprobar aislamiento entre usuarios, ausencia de datos identificadores en el contexto, tiempo máximo de espera, cuota agotada, caída del proveedor y contenido inesperado. Para un proveedor remoto, no se probarán registros reales durante la demostración.

## Fuentes consultadas

- [MCP: introducción oficial](https://modelcontextprotocol.io/docs/getting-started/intro).
- [Ollama: API local y remota](https://docs.ollama.com/api/introduction).
- [Ollama: privacidad y modo exclusivamente local](https://docs.ollama.com/faq).
- [Groq: límites del plan gratuito](https://console.groq.com/docs/rate-limits).
- [Groq: tratamiento y retención de datos](https://console.groq.com/docs/your-data).
- [Groq: política de uso responsable](https://console.groq.com/docs/legal/ai-policy).
- [Gemini API: términos adicionales](https://ai.google.dev/gemini-api/terms).
- [OMS: patrones de crecimiento](https://www.who.int/tools/child-growth-standards/standards).
