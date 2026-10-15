# Paso 10: referencias cargadas en MariaDB

Se aplicó el importador preparado al patrón `OMS-2006`. El registro de verificación incluye la fecha y hora UTC de la operación en `database/references/anthro-1.1.0/import-summary.json`.

## Resultado

| Destino | Filas |
| --- | ---: |
| `parametros_lms_edad` | 10,962 |
| `parametros_lms_talla` | 2,404 |
| Total | 13,366 |

El patrón permanece inactivo. No se crearon reglas de clasificación. La operación dejó una auditoría de importación con el commit de origen, las huellas SHA-256 y las cantidades.

## Qué hicimos y por qué

1. Ejecutamos de nuevo la simulación para comprobar los archivos y el estado del destino. Respondió `LISTO_PARA_IMPORTAR`.
2. Aplicamos la importación dentro de una transacción. Todos los lotes forman una única operación: un fallo habría revertido la carga completa.
3. El importador leyó y comparó todas las claves y coeficientes guardados antes de confirmar la transacción.
4. Repetimos la verificación desde otra ejecución. Respondió `YA_COINCIDE`, confirmando que la base tiene exactamente la carga esperada.
5. Comprobamos las cantidades, el estado inactivo, la ausencia de reglas y el registro de auditoría.

## Cómo verlo en la aplicación

Entra como administrador a **Configuración → Patrones nutricionales** y pulsa **Actualizar datos**. Si la opción no aparece, pulsa primero **Actualizar menú**.

Los totales por indicador deben ser:

- Peso para la edad: 3654 referencias por edad.
- Longitud/talla para la edad: 3654 referencias por edad.
- IMC para la edad: 3654 referencias por edad.
- Peso para longitud/talla: 2404 referencias, desglosadas por sexo y método.

En phpMyAdmin puedes consultar `parametros_lms_edad`, `parametros_lms_talla` y `registros_auditoria`. No necesitas volver a importar el SQL inicial.

## Evidencias conservadas

- `database/references/anthro-1.1.0/import-plan.json`: simulación de la preparación previa.
- `database/references/anthro-1.1.0/import-applied.json`: resultado de la carga aplicada.
- `database/references/anthro-1.1.0/import-verification.json`: comparación posterior, `YA_COINCIDE`.
- `database/references/anthro-1.1.0/import-summary.json`: cantidades, estado y auditoría comprobados.

Para repetir la comprobación sin escribir datos, ejecuta `npm run references:plan` desde `backend`.

## Próximo paso

Implementar y validar el cálculo de indicadores frente a casos de la herramienta oficial. Deben documentarse la selección de referencias, los ajustes por método de medición y el tratamiento de casos fuera de cobertura. La activación del patrón y las reglas de clasificación vendrán después de esas comprobaciones.
