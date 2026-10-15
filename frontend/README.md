# NutriTech — Frontend

React, TypeScript, Vite y Tailwind CSS 4.

## Iniciar

```bash
npm install
npm run dev
```

Abrir http://localhost:5173. Mantener NestJS iniciado en el puerto 3017.
El botón de conexión consulta el endpoint inicial de NestJS a través del proxy
`/api/` de Vite. Espera la respuesta `Hello World!` del backend inicial.

Para cambiar el destino, copiar `.env.example` a `.env`, ajustar
`API_PROXY_TARGET` y reiniciar Vite. Este proxy es solo para desarrollo;
el despliegue tendrá su configuración de Nginx.

## Verificar

```bash
npm run build
npm run lint
```

Inicio de sesión, consulta de perfil y cierre de sesión conectados a NestJS. Las cookies de sesión son HttpOnly; no se almacenan JWT en JavaScript. Consulta `../docs/03-inicio-de-sesion.md` para crear tu administrador.

## Paleta de NutriTech

Los códigos aprobados se definen en `src/index.css` como tokens de Tailwind.
Usar los códigos escritos en la referencia, sin muestrear los círculos.

| Token | Código | Uso |
| --- | --- | --- |
| institucional | #2563A6 | Encabezados, menú y botones principales |
| azul-claro | #E8F1FA | Fondos secundarios y selección |
| salud | #2E8B70 | Confirmaciones y estados correctos |
| verde-claro | #E8F5EF | Fondos de mensajes positivos |
| advertencia | #E89532 | Advertencias |
| alerta | #D9534F | Errores y alertas |
| fondo | #F4F6F8 | Fondo general |
| texto | #2F3A45 | Texto principal |
| secundario | #6B7280 | Texto secundario |

Los estados también se describen con texto. En mensajes, utilizar texto oscuro
sobre fondos claros y el color del estado en el borde para mantener legibilidad.
