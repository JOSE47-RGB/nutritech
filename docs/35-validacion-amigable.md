# Validación de formularios y ayudas de captura

29/09/2026

`ValidatedForm` conserva las restricciones HTML nativas y añade un resumen en español con enlaces que enfocan los campos inválidos. Marca los campos con `aria-invalid`, anuncia el resumen al intentar enviar y elimina cada mensaje al corregir su campo. Se aplica a consulta temporal, expediente, responsables, búsqueda e ingreso de evaluaciones. Las validaciones del servidor permanecen vigentes.

Mejoras de captura:
- Fecha de nacimiento del expediente limitada a hoy en Guatemala.
- Fecha de consulta limitada entre nacimiento y hoy. La edad/cobertura sigue comprobándose antes de enviar.
- Nombres obligatorios recortados; espacios solos no satisfacen el requisito.
- Campos opcionales identificados, incluyendo comunidad y dirección.
- Ayudas de unidades para peso/talla, asociadas con `aria-describedby`.
- Fecha/hora y centro de la evaluación identificados en el resumen de errores.

Validación visual del componente real, mediante una página temporal ya eliminada: campos vacíos, fecha futura y peso cero producen mensajes; un enlace enfoca el peso; corregir campos elimina los avisos manteniendo los valores. No se guardaron registros. La prueba con sesión autenticada quedó pendiente al encontrarse la sesión cerrada. Compilación y lint del frontend revisados.
