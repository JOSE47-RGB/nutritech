# Padres y responsables durante el registro

La ubicación original sigue disponible: Listado de niños → abrir expediente → Responsables familiares → Vincular responsable. Usuarios administra cuentas de acceso; no corresponde al registro de los padres.

Ahora, después de guardar el expediente, el propio formulario de registro muestra Padres y responsables. Permite buscar una persona existente o registrar una nueva, elegir parentesco y contacto principal, añadir a ambos padres y finalizar. En el portal de Usuario normal este paso aparece antes de continuar con la evaluación. Si no se dispone de los datos, Cancelar cierra el formulario de vínculo y permite continuar sin asociarlo. El expediente creado y los vínculos ya guardados permanecen si se abandona la pantalla.

La búsqueda admite DPI completo de 13 dígitos, nombres o teléfono. El DPI es opcional al registrar; solo se valida su formato, sin afirmar validación ante RENAP. Para DPI se usa coincidencia exacta, no parcial. La interfaz envía la búsqueda por POST para no incluir identificadores en la URL. Las respuestas muestran solo los últimos cuatro dígitos. Se almacena una huella HMAC con contexto independiente y se reutiliza la clave de certificados; no se guarda el DPI completo ni se registra en auditoría. Conservar esa clave es necesario para búsquedas posteriores. El índice único rechaza duplicados con DPI; sin DPI no se garantiza deduplicación por identidad. Los responsables antiguos quedan sin DPI.

Migración aditiva: 007-responsables-dpi.sql, con columnas opcionales dpi_hash y dpi_ultimos4 y un índice único. Ejecutar desde backend: node scripts/migrate-guardian-dpi.cjs; npm run db:generate; npm run build. Reiniciar backend.

Permisos: el administrador reutiliza ninos.editar. El portal utiliza evaluaciones.crear y ninos.buscar para la búsqueda, y solo permite vincular responsables a expedientes creados por la cuenta autenticada. No habilita la edición de personas o de expedientes ajenos.

Verificación: frontend y backend compilados; lint de cambios correcto; 64 pruebas unitarias, 16 pruebas de integración de niños y 22 de evaluaciones aprobadas. La prueba nueva verifica formato, búsqueda exacta por DPI, respuesta sin DPI completo, índice ant duplicados, vínculo del mismo padre a dos niños, ausencia del DPI en auditoría y acceso del portal. La migración se aplicó a la base local y el backend quedó iniciado. No se registraron padres reales durante la verificación.
