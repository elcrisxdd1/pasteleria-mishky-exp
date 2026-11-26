(() => {
    "use strict";

    const CLAVES = {
        carrito: "mishky_carrito",
        cupon: "mishky_cupon"
    };

    const RUTA_PRODUCTOS = "data/productos.json";
    const COSTO_ENVIO = 8;
    // Se unificó el teléfono con el número mostrado en el catálogo y el personalizador.
    const TELEFONO_PEDIDOS = "51984000111";

    const CUPONES = {
        DULCE5: { tipo: "porcentaje", valor: 5, descripcion: "5% de descuento en productos" },
        MISHKY10: { tipo: "porcentaje", valor: 10, descripcion: "10% de descuento en productos" },
        ENVIOGRATIS: { tipo: "envio_gratis", valor: 0, descripcion: "Envío gratis en tu compra" }
    };

    const $ = selector => document.querySelector(selector);
    const ui = {
        abrir: $("#abrir-carrito"),
        contador: $("#carrito-contador"),
        modal: $("#modal-carrito"),
        cerrar: $("#cerrar-carrito"),
        lista: $("#carrito-lista"),
        estado: $("#carrito-estado"),
        subtotal: $("#carrito-subtotal"),
        descuento: $("#carrito-descuento"),
        envio: $("#carrito-envio"),
        total: $("#carrito-total"),
        cupon: $("#carrito-cupon-estado"),
        cuponInput: $("#carrito-cupon-input"),
        aplicarCupon: $("#carrito-aplicar-cupon"),
        quitarCupon: $("#carrito-quitar-cupon"),
        cuponDetalle: $("#carrito-cupon-detalle"),
        irRuleta: $("#carrito-ir-ruleta"),
        entrega: $("#carrito-entrega"),
        nombre: $("#carrito-nombre"),
        direccion: $("#carrito-direccion"),
        finalizar: $("#carrito-finalizar"),
        toast: $("#carrito-toast")
    };

    const soles = new Intl.NumberFormat("es-PE", {
        style: "currency",
        currency: "PEN"
    });

    let productos = [];
    let carrito = leerCarrito();
    let inventarioListo = false;
    let toastTimer = 0;

    function esTortaPersonalizada(item) {
        return Boolean(item && item.tipo === "torta-personalizada");
    }

    function leerCarrito() {
        try {
            const datos = JSON.parse(localStorage.getItem(CLAVES.carrito) || "[]");
            if (!Array.isArray(datos)) return [];

            return datos.filter(item => {
                if (!item || !Number.isInteger(item.cantidad) || item.cantidad < 1) return false;

                if (esTortaPersonalizada(item)) {
                    return typeof item.id === "string" &&
                        item.id.length > 0 &&
                        Number.isFinite(item.precio) && item.precio > 0 &&
                        typeof item.nombre === "string";
                }

                // Compatibilidad con el formato anterior: { id: número, cantidad: número }.
                return Number.isInteger(item.id);
            });
        } catch {
            return [];
        }
    }

    function guardarCarrito() {
        try {
            localStorage.setItem(CLAVES.carrito, JSON.stringify(carrito));
            window.dispatchEvent(new CustomEvent("mishky:carrito-actualizado"));
            return true;
        } catch (error) {
            console.error("No se pudo guardar el carrito:", error);
            toast("No se pudo guardar el carrito en este navegador.");
            return false;
        }
    }

    function productoPorId(id) {
        return productos.find(producto => producto.id === Number(id));
    }

    function normalizarCarrito() {
        const cantidades = new Map();
        const tortas = [];

        carrito.forEach(item => {
            if (esTortaPersonalizada(item)) {
                tortas.push(item);
                return;
            }

            const producto = productoPorId(item.id);
            if (!producto || producto.stock <= 0) return;

            cantidades.set(
                producto.id,
                Math.min(producto.stock, (cantidades.get(producto.id) || 0) + item.cantidad)
            );
        });

        carrito = [
            ...Array.from(cantidades, ([id, cantidad]) => ({ id, cantidad })),
            ...tortas
        ];
        guardarCarrito();
    }

    async function cargarInventario() {
        try {
            const respuesta = await fetch(RUTA_PRODUCTOS, { cache: "no-store" });
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

            const datos = await respuesta.json();
            if (!Array.isArray(datos)) throw new Error("El inventario no contiene una lista válida.");

            productos = datos.filter(producto =>
                producto &&
                Number.isInteger(producto.id) &&
                Number.isFinite(producto.precio) && producto.precio > 0 &&
                Number.isInteger(producto.stock) && producto.stock >= 0
            );
            inventarioListo = true;
            normalizarCarrito();
            actualizarBotones();
            renderizar();
        } catch (error) {
            console.error("No se pudo cargar el inventario:", error);
            inventarioListo = false;
            ui.estado.textContent = "No se pudo cargar el inventario del catálogo. Las tortas personalizadas guardadas siguen disponibles.";
            actualizarBotones();
            renderizarLista();
            renderizarResumen();
        }
    }

    function toast(texto) {
        if (!ui.toast) return;
        ui.toast.textContent = texto;
        ui.toast.hidden = false;
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            ui.toast.hidden = true;
        }, 2800);
    }

    function claveItem(item) {
        return String(item.id);
    }

    function obtenerDetalleItem(item) {
        if (esTortaPersonalizada(item)) {
            return {
                nombre: item.nombre || "Torta personalizada",
                precio: item.precio,
                detalle: item.detalle || "Diseño personalizado",
                imagen: null,
                esTorta: true
            };
        }

        const producto = productoPorId(item.id);
        if (!producto) {
            return {
                nombre: `Producto #${item.id}`,
                precio: 0,
                detalle: inventarioListo ? "Producto no disponible en el inventario." : "Cargando detalle del producto...",
                imagen: "img/sin-imagen.jpg",
                esTorta: false
            };
        }

        return {
            nombre: producto.nombre,
            precio: producto.precio,
            detalle: producto.descripcion || "Producto artesanal Mishky",
            imagen: producto.imagen,
            stock: producto.stock,
            esTorta: false
        };
    }

    function actualizarContador() {
        const cantidad = carrito.reduce((sum, item) => sum + item.cantidad, 0);
        ui.contador.textContent = String(cantidad);
        ui.abrir.setAttribute("aria-label", `Abrir carrito, ${cantidad} productos`);
    }

    function actualizarBotones() {
        document.querySelectorAll("#grilla .tarjeta[data-id]").forEach(tarjeta => {
            const id = Number(tarjeta.dataset.id);
            const producto = productoPorId(id);
            const cuerpo = tarjeta.querySelector(".tarjeta__cuerpo");
            if (!cuerpo) return;

            let boton = cuerpo.querySelector("[data-agregar-carrito]");
            if (!boton) {
                boton = document.createElement("button");
                boton.type = "button";
                boton.className = "tarjeta__agregar";
                boton.dataset.agregarCarrito = "true";
                boton.addEventListener("click", event => {
                    event.preventDefault();
                    event.stopPropagation();
                    agregarProducto(Number(boton.dataset.id));
                });
                cuerpo.append(boton);
            }

            boton.dataset.id = String(id);
            if (!inventarioListo) {
                boton.disabled = true;
                boton.textContent = "Cargando…";
            } else if (!producto || producto.stock <= 0) {
                boton.disabled = true;
                boton.textContent = "Agotado";
            } else {
                boton.disabled = false;
                boton.textContent = "Agregar al carrito";
            }
        });
    }

    function agregarProducto(id) {
        if (!inventarioListo) return toast("El inventario todavía se está cargando.");
        const producto = productoPorId(id);
        if (!producto || producto.stock <= 0) return toast("Este producto no está disponible.");

        const item = carrito.find(current => !esTortaPersonalizada(current) && current.id === producto.id);
        const cantidadActual = item ? item.cantidad : 0;
        if (cantidadActual >= producto.stock) {
            return toast(`Solo hay ${producto.stock} unidades disponibles de ${producto.nombre}.`);
        }

        if (item) item.cantidad += 1;
        else carrito.push({ id: producto.id, cantidad: 1 });

        if (!guardarCarrito()) {
            if (item) item.cantidad -= 1;
            else carrito.pop();
            return;
        }
        renderizar();
        toast(`${producto.nombre} se agregó al carrito.`);
    }

    function agregarTortaPersonalizada(event) {
        const data = event.detail;
        if (!data || !Number.isFinite(data.precio) || data.precio <= 0 || typeof data.detalle !== "string") {
            toast("No se pudo añadir esta torta. Vuelve a revisar el diseño.");
            return;
        }

        const id = `torta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const item = {
            tipo: "torta-personalizada",
            id,
            cantidad: 1,
            nombre: typeof data.nombre === "string" && data.nombre.trim()
                ? data.nombre.trim().slice(0, 60)
                : "Torta personalizada",
            precio: Math.round(data.precio * 100) / 100,
            detalle: data.detalle,
            configuracion: data.configuracion || null,
            fecha: new Date().toISOString()
        };

        carrito.push(item);
        if (!guardarCarrito()) {
            carrito = carrito.filter(current => current.id !== id);
            return;
        }

        renderizar();
        toast("Tu torta personalizada se añadió al carrito.");
    }

    function cambiarCantidad(id, cambio) {
        const item = carrito.find(current => claveItem(current) === id);
        if (!item) return;

        const nuevaCantidad = item.cantidad + cambio;
        if (nuevaCantidad <= 0) {
            carrito = carrito.filter(current => claveItem(current) !== id);
        } else if (esTortaPersonalizada(item)) {
            if (nuevaCantidad > 10) return toast("Puedes solicitar hasta 10 unidades de este diseño por pedido.");
            item.cantidad = nuevaCantidad;
        } else {
            const producto = productoPorId(item.id);
            if (!producto) return;
            if (nuevaCantidad > producto.stock) return toast(`Stock máximo disponible: ${producto.stock}.`);
            item.cantidad = nuevaCantidad;
        }

        guardarCarrito();
        renderizar();
    }

    function leerCuponGanado() {
        try {
            const texto = localStorage.getItem(CLAVES.cupon);
            if (!texto) return { estado: "ninguno", cupon: null };

            const guardado = JSON.parse(texto);
            const definicion = guardado && CUPONES[guardado.codigo];
            if (!definicion || guardado.tipo !== definicion.tipo || guardado.valor !== definicion.valor) {
                return { estado: "invalido", cupon: null };
            }
            if (guardado.usado === true) return { estado: "usado", cupon: guardado };

            return { estado: "ganado", cupon: { codigo: guardado.codigo, ...definicion } };
        } catch {
            return { estado: "invalido", cupon: null };
        }
    }

    function leerCuponAplicado() {
        const ganado = leerCuponGanado();
        if (ganado.estado !== "ganado" || !ganado.cupon) {
            return { estado: ganado.estado, cupon: null };
        }

        try {
            const codigoAplicado = (localStorage.getItem("mishky_cupon_aplicado") || "").trim().toUpperCase();
            if (codigoAplicado && codigoAplicado === ganado.cupon.codigo) {
                return { estado: "aplicado", cupon: ganado.cupon };
            }
            return { estado: "ganado", cupon: ganado.cupon };
        } catch {
            return { estado: "ganado", cupon: ganado.cupon };
        }
    }

    function aplicarCupon() {
        const codigo = String(ui.cuponInput?.value || "").trim().toUpperCase();
        if (!codigo) {
            ui.cupon.textContent = "Pega el código que ganaste y pulsa Aplicar.";
            ui.cuponInput?.focus();
            return;
        }

        const ganado = leerCuponGanado();
        if (ganado.estado === "usado") {
            ui.cupon.textContent = "Este cupón ya fue utilizado y no se puede volver a aplicar.";
            return;
        }
        if (ganado.estado !== "ganado" || !ganado.cupon || codigo !== ganado.cupon.codigo) {
            ui.cupon.textContent = "Ese código no coincide con el cupón que ganaste en esta ruleta. Revisa el código y vuelve a intentarlo.";
            return;
        }

        try {
            localStorage.setItem("mishky_cupon_aplicado", codigo);
            ui.cuponInput.value = codigo;
            renderizarResumen();
            toast(`Cupón ${codigo} aplicado. Puedes quitarlo cuando quieras.`);
        } catch (error) {
            console.error("No se pudo aplicar el cupón:", error);
            ui.cupon.textContent = "No se pudo guardar la aplicación del cupón en este navegador.";
        }
    }

    function quitarCupon() {
        try {
            localStorage.removeItem("mishky_cupon_aplicado");
            if (ui.cuponInput) ui.cuponInput.value = "";
            renderizarResumen();
            toast("Cupón retirado. El precio volvió a su importe normal.");
        } catch (error) {
            console.error("No se pudo retirar el cupón:", error);
        }
    }

    function resumenCompra() {
        const subtotal = Math.round(carrito.reduce((sum, item) => {
            const detalle = obtenerDetalleItem(item);
            return sum + detalle.precio * item.cantidad;
        }, 0) * 100) / 100;

        const cuponInfo = leerCuponAplicado();
        const cupon = cuponInfo.estado === "aplicado" ? cuponInfo.cupon : null;
        const entrega = ui.entrega.value;
        let descuento = 0;
        let envio = entrega === "delivery" ? COSTO_ENVIO : 0;
        const desglose = [];

        if (cupon?.tipo === "porcentaje") {
            carrito.forEach(item => {
                const detalle = obtenerDetalleItem(item);
                const importeLinea = detalle.precio * item.cantidad;
                const descuentoLinea = Math.round(importeLinea * cupon.valor) / 100;
                if (descuentoLinea > 0) {
                    descuento += descuentoLinea;
                    desglose.push({
                        nombre: detalle.nombre,
                        cantidad: item.cantidad,
                        porcentaje: cupon.valor,
                        descuento: descuentoLinea
                    });
                }
            });
            descuento = Math.round(descuento * 100) / 100;
        }
        if (cupon?.tipo === "envio_gratis" && entrega === "delivery") envio = 0;

        const total = Math.max(0, Math.round((subtotal - descuento + envio) * 100) / 100);
        return { subtotal, descuento, envio, total, cupon, cuponInfo, entrega, desglose };
    }

    function botonAccion(texto, accion, id, clase, disabled = false) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = texto;
        button.dataset.accion = accion;
        button.dataset.id = id;
        button.className = clase;
        button.disabled = disabled;
        return button;
    }

    function crearItemCarrito(item) {
        const detalle = obtenerDetalleItem(item);
        const article = document.createElement("article");
        article.className = "carrito-item";
        article.dataset.itemId = claveItem(item);

        if (detalle.esTorta) {
            const visual = document.createElement("div");
            visual.className = "carrito-item__visual";
            visual.setAttribute("aria-hidden", "true");
            visual.textContent = "🎂";
            article.append(visual);
        } else {
            const image = document.createElement("img");
            image.src = detalle.imagen || "img/sin-imagen.jpg";
            image.alt = detalle.nombre;
            image.loading = "lazy";
            image.onerror = () => {
                image.onerror = null;
                image.src = "img/sin-imagen.jpg";
            };
            article.append(image);
        }

        const info = document.createElement("div");
        info.className = "carrito-item__info";

        const name = document.createElement("h3");
        name.textContent = detalle.nombre;

        const price = document.createElement("p");
        price.textContent = `${soles.format(detalle.precio)} c/u`;

        const description = document.createElement("p");
        description.className = "carrito-item__detalle";
        description.textContent = detalle.detalle;

        const actions = document.createElement("div");
        actions.className = "carrito-item__acciones";
        const key = claveItem(item);
        const minus = botonAccion("−", "menos", key, "carrito-cantidad__boton", item.cantidad <= 1);
        minus.setAttribute("aria-label", `Disminuir cantidad de ${detalle.nombre}`);
        const quantity = document.createElement("span");
        quantity.className = "carrito-cantidad__valor";
        quantity.textContent = String(item.cantidad);
        const max = detalle.esTorta ? 10 : (detalle.stock || 0);
        const plus = botonAccion("+", "mas", key, "carrito-cantidad__boton", item.cantidad >= max);
        plus.setAttribute("aria-label", `Aumentar cantidad de ${detalle.nombre}`);
        const remove = botonAccion("Quitar", "eliminar", key, "carrito-item__eliminar");
        actions.append(minus, quantity, plus, remove);

        info.append(name, price, description, actions);

        const lineTotal = document.createElement("p");
        lineTotal.className = "carrito-item__line-total";
        lineTotal.textContent = soles.format(detalle.precio * item.cantidad);
        article.append(info, lineTotal);
        return article;
    }

    function renderizarLista() {
        ui.lista.replaceChildren();
        const fragment = document.createDocumentFragment();

        carrito.forEach(item => {
            if (!esTortaPersonalizada(item) && !productoPorId(item.id) && !inventarioListo) {
                // Conserva el producto antiguo hasta que el inventario vuelva a cargar.
                fragment.append(crearItemCarrito(item));
                return;
            }
            if (!esTortaPersonalizada(item) && !productoPorId(item.id)) return;
            fragment.append(crearItemCarrito(item));
        });
        ui.lista.append(fragment);

        if (carrito.length === 0) {
            const empty = document.createElement("div");
            empty.className = "carrito-vacio";
            empty.innerHTML = '<span class="carrito-vacio__icon" aria-hidden="true">🧁</span><h4>Tu carrito está esperando algo rico</h4><p>Explora el catálogo o crea una torta a tu gusto.</p>';
            ui.lista.append(empty);
        }

        const unidades = carrito.reduce((sum, item) => sum + item.cantidad, 0);
        if (carrito.length === 0) {
            ui.estado.textContent = "Todavía no has añadido productos a tu carrito.";
        } else if (!inventarioListo && carrito.some(item => !esTortaPersonalizada(item))) {
            ui.estado.textContent = `Tienes ${unidades} unidad(es). Algunos detalles se están cargando.`;
        } else {
            ui.estado.textContent = `Tienes ${unidades} unidad(es) listas para revisar.`;
        }

        const itemsListos = carrito.every(item => esTortaPersonalizada(item) || Boolean(productoPorId(item.id)));
        ui.finalizar.disabled = carrito.length === 0 || !itemsListos;
        actualizarContador();
    }

    function renderizarResumen() {
        const resumen = resumenCompra();
        ui.subtotal.textContent = soles.format(resumen.subtotal);
        ui.descuento.textContent = `− ${soles.format(resumen.descuento)}`;
        ui.envio.textContent = soles.format(resumen.envio);
        ui.total.textContent = soles.format(resumen.total);

        const ganado = leerCuponGanado();
        ui.quitarCupon.hidden = !resumen.cupon;
        ui.aplicarCupon.disabled = resumen.cupon !== null;
        if (resumen.cupon) {
            ui.cuponInput.value = resumen.cupon.codigo;
            if (resumen.cupon.tipo === "porcentaje") {
                ui.cupon.textContent = `Cupón ${resumen.cupon.codigo} aplicado: ${resumen.cupon.valor}% de descuento.`;
            } else {
                ui.cupon.textContent = resumen.entrega === "delivery"
                    ? `Cupón ${resumen.cupon.codigo} aplicado: envío gratis.`
                    : `Cupón ${resumen.cupon.codigo} aplicado. El envío gratis se activará al elegir delivery.`;
            }
        } else if (ganado.estado === "ganado") {
            ui.cupon.textContent = `Tienes ${ganado.cupon.codigo} disponible (${ganado.cupon.descripcion}). Pega el código y pulsa Aplicar cuando quieras usarlo.`;
            if (document.activeElement !== ui.cuponInput) ui.cuponInput.value = "";
        } else if (ganado.estado === "usado") {
            ui.cupon.textContent = `El cupón ${ganado.cupon.codigo} ya fue utilizado.`;
            ui.cuponInput.value = "";
        } else if (ganado.estado === "invalido") {
            ui.cupon.textContent = "No se pudo validar el cupón guardado en este navegador.";
            ui.cuponInput.value = "";
        } else {
            ui.cupon.textContent = "El descuento solo se aplicará cuando pegues y apliques un cupón que hayas ganado.";
        }

        ui.cuponDetalle.replaceChildren();
        if (resumen.desglose.length) {
            const heading = document.createElement("strong");
            heading.textContent = "Descuento aplicado a:";
            const list = document.createElement("ul");
            resumen.desglose.forEach(linea => {
                const li = document.createElement("li");
                li.textContent = `${linea.nombre}${linea.cantidad > 1 ? ` × ${linea.cantidad}` : ""}: ${linea.porcentaje}% · − ${soles.format(linea.descuento)}`;
                list.append(li);
            });
            ui.cuponDetalle.append(heading, list);
        } else if (resumen.cupon?.tipo === "porcentaje") {
            ui.cuponDetalle.textContent = "El descuento se mostrará por producto cuando agregues artículos al carrito.";
        } else {
            ui.cuponDetalle.textContent = "";
        }
        ui.irRuleta.hidden = ganado.estado === "ganado" || ganado.estado === "usado";
    }

    function renderizar() {
        renderizarLista();
        renderizarResumen();
    }

    function actualizarDireccion() {
        const delivery = ui.entrega.value === "delivery";
        ui.direccion.required = delivery;
        ui.direccion.disabled = !delivery;
        $("label[for='carrito-direccion']").textContent = delivery
            ? "Dirección de entrega"
            : "Dirección de entrega (no necesaria para recojo)";
        ui.direccion.placeholder = delivery ? "Distrito, calle y número" : "No se necesita dirección para recojo";
        renderizarResumen();
    }

    function mensajePedido(resumen) {
        const lineas = carrito.map(item => {
            const detalle = obtenerDetalleItem(item);
            const total = detalle.precio * item.cantidad;
            const prefix = `• ${item.cantidad} x ${detalle.nombre} — ${soles.format(total)}`;
            return esTortaPersonalizada(item)
                ? `${prefix}\n  Diseño: ${detalle.detalle}`
                : prefix;
        });

        const entrega = resumen.entrega === "delivery"
            ? `Delivery: ${soles.format(resumen.envio)}\nDirección: ${ui.direccion.value.trim()}`
            : "Recojo en tienda: Av. El Sol 845, Cusco";

        const detalleDescuento = resumen.desglose.length
            ? ["Descuento por producto:", ...resumen.desglose.map(linea => `  • ${linea.nombre}${linea.cantidad > 1 ? ` × ${linea.cantidad}` : ""}: − ${soles.format(linea.descuento)}`)]
            : [];

        return [
            "Hola, Pastelería Mishky. Quiero coordinar este pedido:",
            "",
            ...lineas,
            "",
            `Subtotal: ${soles.format(resumen.subtotal)}`,
            `Cupón: ${resumen.cupon ? resumen.cupon.codigo : "ninguno"}`,
            `Descuento: ${soles.format(resumen.descuento)}`,
            ...detalleDescuento,
            entrega,
            `TOTAL ESTIMADO: ${soles.format(resumen.total)}`,
            "",
            `Nombre: ${ui.nombre.value.trim()}`,
            "Por favor, confirmen disponibilidad y tiempo de preparación."
        ].join("\n");
    }

    function finalizarCompra() {
        if (!carrito.length) return;
        if (!ui.nombre.reportValidity()) return;
        if (ui.entrega.value === "delivery" && !ui.direccion.reportValidity()) return;

        const resumen = resumenCompra();
        const url = `https://wa.me/${TELEFONO_PEDIDOS}?text=${encodeURIComponent(mensajePedido(resumen))}`;
        const nuevaVentana = window.open(url, "_blank");
        if (nuevaVentana) {
            nuevaVentana.opener = null;
            ui.estado.textContent = "WhatsApp se abrió con el resumen del pedido. Envía el mensaje desde WhatsApp; tu carrito se conserva aquí.";
            toast("Se abrió WhatsApp. Recuerda pulsar Enviar en la conversación.");
        } else {
            ui.estado.textContent = "El navegador bloqueó la ventana de WhatsApp. Permite las ventanas emergentes y vuelve a intentarlo.";
            toast("No se pudo abrir WhatsApp. Revisa el bloqueo de ventanas emergentes.");
        }
    }

    function abrirCarrito() {
        renderizar();
        if (!ui.modal.open) ui.modal.showModal();
    }

    ui.abrir.addEventListener("click", abrirCarrito);
    ui.cerrar.addEventListener("click", () => ui.modal.close());
    ui.modal.addEventListener("click", event => {
        if (event.target === ui.modal) ui.modal.close();
    });

    ui.lista.addEventListener("click", event => {
        const button = event.target.closest("button[data-accion]");
        if (!button) return;
        const id = button.dataset.id;
        if (button.dataset.accion === "mas") cambiarCantidad(id, 1);
        if (button.dataset.accion === "menos") cambiarCantidad(id, -1);
        if (button.dataset.accion === "eliminar") {
            carrito = carrito.filter(item => claveItem(item) !== id);
            guardarCarrito();
            renderizar();
            toast("Producto eliminado del carrito.");
        }
    });

    ui.entrega.addEventListener("change", actualizarDireccion);
    ui.finalizar.addEventListener("click", finalizarCompra);
    ui.aplicarCupon.addEventListener("click", aplicarCupon);
    ui.quitarCupon.addEventListener("click", quitarCupon);
    ui.cuponInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            aplicarCupon();
        }
    });

    ui.irRuleta.addEventListener("click", () => {
        ui.modal.close();
        $("#abrir-ruleta").click();
    });

    $("#carrito-volver-catalogo").addEventListener("click", () => ui.modal.close());

    window.addEventListener("mishky:agregar-torta-carrito", agregarTortaPersonalizada);
    window.addEventListener("storage", event => {
        if ([CLAVES.carrito, CLAVES.cupon, "mishky_cupon_aplicado", null].includes(event.key)) {
            carrito = leerCarrito();
            renderizar();
        }
    });
    window.addEventListener("mishky:cupon-actualizado", renderizar);

    const grid = $("#grilla");
    if (grid) {
        const observer = new MutationObserver(actualizarBotones);
        observer.observe(grid, { childList: true });
    }

    actualizarDireccion();
    actualizarBotones();
    renderizarLista();
    renderizarResumen();
    cargarInventario();
})();
