# Paso 19: valoración médica de la orientación

En **Historial de evaluaciones → Ver últimas 20 guardadas**, despliega una orientación y pulsa **Consultar valoraciones y permisos**. Se muestra el historial y, si tienes autorización, el formulario para registrar una valoración.

## Formulario

- **Coincide con la orientación**: el profesional deja constancia de su interpretación.
- **Difiere de la orientación**: registra su valoración distinta y el fundamento.
- **Requiere información adicional**: documenta qué falta antes de decidir.
- **Valoración y fundamento** y **Acciones indicadas**: ambos obligatorios, de 10 a 4000 caracteres después de quitar espacios de los extremos.

No se rellenan automáticamente decisiones ni tratamientos. El sistema registra el texto ingresado por el profesional; no verifica su contenido clínico ni convierte la valoración en una firma digital certificada.

## Permisos

La lectura exige `evaluaciones.ver`. El registro exige además `evaluaciones.valorar`, permiso nuevo asignado por la migración al rol **MEDICO**. No se asigna automáticamente a ADMINISTRADOR ni a otros roles. Puede otorgarse explícitamente por el mecanismo de permisos existente a una cuenta autorizada; no se alteraron roles de personas reales en este paso.

Por eso una cuenta administradora puede ver el historial y no ver el formulario de registro. Los controles efectivos se comprueban en el servidor, aunque alguien intente llamar la API directamente. La cuenta debe estar activa y su sesión vigente.

## Historial y trazabilidad

La tabla `valoraciones_medicas` conserva orientación, autor, fecha, decisión, fundamento y acciones. Cada valoración es un registro nuevo. No hay edición ni eliminación desde la aplicación: una aclaración posterior se registra como otra valoración. La consulta muestra las últimas 20 y no oculta las opiniones anteriores ni pretende resolver automáticamente discrepancias entre profesionales.

La copia automática original y su hash no cambian. Su campo `revision_medica: PENDIENTE` representa el estado en el momento de guardar esa copia, no el estado actual del historial. La pantalla consulta las valoraciones por separado y ya no muestra ese campo como estado actual.

Un identificador de solicitud evita duplicados al reintentar el mismo envío. Reusar ese identificador con contenido distinto produce un conflicto. El formulario conserva el identificador ante un fallo de red; al cambiar contenido o completar un envío genera uno nuevo.

Antes de insertar se verifica que la orientación pertenezca a la evaluación de la ruta, que la evaluación no esté anulada y que la huella del contenido sea correcta. La inserción y su auditoría se ejecutan en una transacción. Una evaluación anulada conserva el historial para consulta, pero no admite nuevas valoraciones.

La auditoría guarda identificadores y decisión, sin duplicar el texto clínico en el registro general. No se generan alertas ni se cambia el estado de la evaluación al valorar.

## Instalación y API

La migración `004-valoraciones-medicas.sql` fue aplicada localmente. Para otra instalación, después de la migración 003, ejecutar desde `backend`:

```bash
npm run db:migrate:reviews
npm run db:generate
```

- `GET /evaluaciones/:codigo/orientaciones/:orientacion/valoraciones`: historial y capacidad de registrar.
- `POST` a la misma ruta: exige la protección de origen habitual y los campos `solicitud_id`, `decision`, `valoracion`, `acciones`.

Las pruebas verifican permisos, sesión, origen, validación, reintentos simultáneos, conflictos, historial, conservación del hash, correspondencia de la ruta y bloqueo tras anulación. Se completaron 56 pruebas unitarias y 15 de integración con MariaDB, además de validación Prisma, compilación y lint.

El siguiente módulo puede generar alertas vinculadas a orientaciones y mostrar su seguimiento, manteniendo aparte la decisión médica registrada aquí.
