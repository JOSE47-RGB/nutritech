# Crecimiento: navegación y gráfica interactivas

Revisión: 7 de octubre de 2026. Este cambio corresponde a la petición de hacer las vistas de crecimiento más fáciles de explorar.

## Qué cambió

- Dos recorridos visibles: consultar las visitas de un niño o consultar la referencia por edad.
- Búsqueda mientras se escribe, selección mediante tarjetas y mensajes para búsquedas vacías o fallidas.
- Gráfica por día inicialmente. Día, mes y año actualizan la consulta al seleccionarlos.
- Se explica cuándo varios registros quedan agrupados y se ofrece volver a verlos por día.
- Filtros de todo el historial, año actual y fechas personalizadas; los intervalos inválidos tienen un mensaje junto al formulario.
- Selección de puntos con ratón, teclado o controles anterior/siguiente. El detalle incluye fecha, edad, peso, talla y avisos de esa medición.
- El selector permite recorrer también las mediciones individuales que no sean el último registro del período agrupado.
- La referencia OMS puede mostrarse u ocultarse. Los datos señalados para revisión tienen un símbolo y un color diferente; no se conectan como una tendencia interpretable.
- La referencia por edad se actualiza al completar fechas y sexo. Una fecha inválida retira el resultado anterior.
- Gráfica adaptable a pantallas pequeñas, controles con foco visible y respeto a la preferencia de reducir movimiento.

El componente se comparte entre administración, usuario normal y la vista de crecimiento integrada en Inicio. Se mantienen la paleta acordada, las referencias existentes y los límites de acceso del servidor. No se cambiaron los algoritmos clínicos ni las mediciones históricas.

## Archivos

- [Growth.tsx](../frontend/src/components/Growth.tsx): recorridos, selección y filtros.
- [GrowthChart.tsx](../frontend/src/components/GrowthChart.tsx): gráfica adaptable e interacción.
- [growth-data.ts](../frontend/src/components/growth-data.ts): tipos, formatos y consultas cancelables.
- [growth.css](../frontend/src/components/growth.css): estilos y adaptación a distintos anchos.

## Verificación realizada

`npm run verify` terminó correctamente: tipos y lint del backend, 78 pruebas unitarias en 13 suites, 5 pruebas de referencias, compilación y lint del frontend. La prueba de importación con MariaDB de ese comando quedó omitida; no equivale a ejecutar `npm run verify:db`.

En navegador se comprobó una cuenta normal temporal con dos niños y cuatro mediciones ficticias: búsqueda, cambio de niño, agrupación por día/mes/año, selección individual, teclado, referencia visible/oculta, filtro sin resultados y consulta por edad. Se comprobó también la vista administrativa y un ancho móvil de 390 píxeles sin desbordamiento horizontal de la página.

Los registros y las cuentas temporales se eliminaron al finalizar. No se modificaron expedientes históricos. La revisión general posterior detectó un problema de permisos en la API de alertas, separado del aislamiento de las rutas de crecimiento: véase [revisión general](43-revision-general-y-pendientes.md).
