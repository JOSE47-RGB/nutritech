# Paso 6: detalle del expediente y responsables familiares

## Probar la pantalla

1. Entrar a Niños → Listado de niños.
2. Pulsar Ver expediente en un registro.
3. En Responsables familiares, pulsar Vincular responsable.
4. Buscar por nombre, apellido o teléfono para reutilizar una persona existente;
   si no existe, elegir Registrar nuevo.
5. Seleccionar parentesco, principal y autorización de contacto, y guardar.
6. Probar Marcar como principal en otro responsable vinculado.

La búsqueda requiere al menos tres caracteres y devuelve hasta 20 resultados.
No se envían mensajes ni se llama al contacto: la autorización solo se registra.

## Lo que aprendemos con tres tablas

responsables guarda los datos de la persona. ninos guarda los del niño.
nino_responsable guarda la relación entre ambos: parentesco, principal,
autorización de contacto y usuario que registró el vínculo.

Esta separación permite que una misma persona sea responsable de varios niños.
La clave compuesta de la relación evita vincular dos veces a la misma persona
con el mismo niño. No se deduplican personas por nombre o teléfono: ambos pueden
coincidir entre personas diferentes. Por eso se ofrece buscar antes de crear.

## Rutas y permisos

Las rutas siguientes son las de NestJS; React añade el prefijo /api de Vite.

| Ruta | Permiso |
| --- | --- |
| GET /ninos/:codigo | ninos.ver |
| GET /ninos/responsables/buscar?busqueda=... | ninos.editar |
| POST /ninos/:codigo/responsables | ninos.editar |
| POST /ninos/:codigo/responsables/:responsable/principal | ninos.editar |

Se usan códigos públicos ULID y se validan sus formatos. La sesión identifica
al autor de los cambios. Los campos adicionales del cliente se rechazan.
El detalle mantiene ocultos certificado completo, hash, cifrado e IDs internos.
Los datos de contacto se consultan con ninos.ver; la autorización de contacto
indica si se permite contactar a la persona, no si el dato puede consultarse.

## Transacciones y principal

La API bloquea la fila del niño con SELECT ... FOR UPDATE antes de cambiar
sus responsables. Mientras una transacción cambia el principal, otra espera.
Si se elige otro principal, el anterior conserva su vínculo pero pierde la marca.
La creación de persona, vínculo y auditoría se confirma junta o se revierte.

Se permite tener cero principales. Como máximo habrá uno al usar estas rutas
sobre datos consistentes. La protección se aplica en la API; no se añadió una
restricción SQL para impedir cambios manuales inconsistentes en phpMyAdmin.
Las pruebas verifican solicitudes concurrentes.

Los niños inactivos o archivados solo se pueden consultar. No se pueden
vincular personas inactivas ni marcarlas como principales. No se añadieron
rutas para eliminar vínculos, editar contactos o desactivar responsables.

## Archivos

- backend/src/ninos/guardian.dto.ts: valida búsqueda, códigos y formulario.
- backend/src/ninos/guardians.service.ts: búsqueda, transacciones y principal.
- backend/src/ninos/ninos.service.ts: consulta del detalle.
- backend/src/ninos/ninos.controller.ts: rutas y permisos.
- frontend/src/components/NinoDetail.tsx: expediente y responsables.
- frontend/src/components/GuardianForm.tsx: búsqueda, registro y vínculo.
- frontend/src/components/NinosList.tsx: botón Ver expediente.

## Comprobaciones

Compilación y análisis de código correctos en backend y frontend.
10 pruebas unitarias y 30 pruebas de integración: 14 de niños/responsables y
16 de autenticación/permisos. Las pruebas usan personas y niños sintéticos,
y eliminan sus vínculos, auditorías y cuentas al terminar. No se alteran
los datos de los usuarios reales.

```bash
npm test -- --runInBand
npm run test:ninos
npm run test:auth
```

No se necesitaron migraciones de tablas para esta etapa.
La siguiente etapa puede abordar las evaluaciones manuales de peso y talla.
