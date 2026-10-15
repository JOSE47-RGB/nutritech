# Interfaz general y estado de módulos

Inicio compacto con seis accesos según las rutas autorizadas, iconos con etiquetas, menú lateral sin encabezados repetidos, acceso de vuelta a Inicio y configuración agrupada. Se elimina el banner grande. Los conteos mantienen sus definiciones originales en ayudas desplegables. Nuevo módulo de Ayuda rápida con recorridos de consulta, registro, historial y alertas. No modifica permisos ni reglas clínicas.

## Inventario comprobado

Existen pantallas y servicios para expedientes y responsables, evaluaciones, orientaciones, valoración médica, alertas, reportes, usuarios, roles, menú, auditoría, respaldos y referencias nutricionales. También existen archivos de Docker/Nginx; las notas iniciales que los marcaban pendientes son históricas.

La consulta de comunidades existe en NinosController/NinosService, pero falta una pantalla dedicada para administrar ese catálogo. Es un siguiente módulo concreto; requiere definir permisos administrativos y operaciones auditadas antes de permitir cambios. La ayuda rápida incorporada en esta revisión ya es accesible desde el menú.

## Verificación y límites

Build y lint del frontend correctos. Inicio revisado visualmente con su componente real en una página temporal, eliminada después. La sesión de la aplicación estaba vencida, por lo que no se verificó la navegación autenticada completa ni los conteos con datos reales en esta revisión. No se crearon ni modificaron expedientes.

No se declara terminada la validación institucional ni el despliegue público. La verificación previa de contenedores está documentada en 25-entrega-y-verificacion.md.
