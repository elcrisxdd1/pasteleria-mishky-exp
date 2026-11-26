PASTELERÍA MISHKY — IMPLEMENTACIÓN ACTUALIZADA

1. Abre esta carpeta completa en Visual Studio Code.
2. Ejecuta catalogo.html con Live Server. Esta es la página inicial y muestra el hero y el catálogo.
3. El enlace “Diseña tu torta” abre disenador.html, una página independiente para el personalizador 3D.
4. No cambies las carpetas css, js, data ni img de ubicación: los archivos usan rutas relativas.

CAMBIOS INCLUIDOS
- Personalizador movido a disenador.html; ya no aparece al cargar el catálogo.
- Botón “Restablecer torta”: recupera forma, pisos, medidas, sabor, relleno, color y toppings iniciales.
- Enlaces de catálogo/contacto con margen de desplazamiento para que la cabecera fija no tape los títulos.
- Ajustes responsive para teléfonos: cabecera, navegación, hero, filtros, diseñador, controles y carrito.
- La ruleta gira continuamente y desacelera para detenerse en el premio seleccionado.
- Ganar un cupón solo lo guarda. No se aplica hasta pegar el código en el carrito y pulsar “Aplicar”.
- El carrito informa los productos y montos concretos que reciben el descuento porcentual.
- Los presets guardan el nombre y la torta aparece en el carrito con ese nombre.
- Se retiraron los botones “Ya envié mi pedido” y “Todavía no lo envié”. WhatsApp se abre con el pedido y el carrito se conserva, porque el navegador no puede verificar si se envió el mensaje.

REGLAS DE CUPONES
- Solo puedes aplicar desde esta interfaz el código que la ruleta guardó en este navegador.
- El cupón ganado no se aplica automáticamente.
- Puedes retirar un cupón aplicado con “Quitar cupón”.
- Los datos se guardan en localStorage del navegador.

NOTAS
- Three.js se carga desde jsDelivr; se requiere conexión a Internet para la vista 3D.
- Las reglas de estabilidad y el precio son orientativos. La pastelería debe confirmar precio, armado y transporte.
- Para probar las dos páginas, usa el mismo origen de Live Server (no abras los HTML con file://), así compartirán localStorage.
