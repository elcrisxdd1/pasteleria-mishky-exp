
const RUTA_DATOS = "data/productos.json";
const TODAS = "Todas";
const EXT_VALIDAS = /\.(jpe?g|png|webp|avif)$/i;
const NUM_FANTASMAS = 8;

const contControles = document.querySelector("#controles");
const contFiltros = document.querySelector("#filtros");
const buscador = document.querySelector("#buscador");
const selOrden = document.querySelector("#orden");
const chkDisponibles = document.querySelector("#solo-disponibles");
const grilla = document.querySelector("#grilla");
const estado = document.querySelector("#estado");
const aviso = document.querySelector("#aviso");
const plantilla = document.querySelector("#tpl-producto");
const dialogo = document.querySelector("#detalle");

let productos = [];
let categoriaActiva = TODAS;
let tarjetaAbierta = null;

const soles = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN"
});

const SIZES = "(max-width: 600px) calc(100vw - 2rem), (max-width: 900px) 45vw, 280px";

function motivosInvalido(p, idsVistos) {
    const motivos = [];

    if (typeof p !== "object" || p === null) {
        return ["no es un objeto"];
    }

    if (typeof p.id !== "number" || !Number.isFinite(p.id)) {
        motivos.push("id no numérico");
    } else if (idsVistos.has(p.id)) {
        motivos.push("id repetido");
    }

    if (typeof p.precio !== "number" || !(p.precio > 0)) {
        motivos.push("precio no válido");
    }

    if (!Number.isInteger(p.stock) || p.stock < 0) {
        motivos.push("stock no válido");
    }

    if (typeof p.categoria !== "string" || p.categoria.trim() === "") {
        motivos.push("categoría vacía");
    }

    if (typeof p.imagen !== "string" || !EXT_VALIDAS.test(p.imagen)) {
        motivos.push("imagen sin extensión válida");
    }

    return motivos;
}

function validarProductos(lista) {
    const idsVistos = new Set();
    const validos = [];
    const descartados = [];

    lista.forEach((p, indice) => {
        const motivos = motivosInvalido(p, idsVistos);

        if (motivos.length === 0) {
            idsVistos.add(p.id);
            validos.push(p);
        } else {
            descartados.push({
                posicion: indice,
                id: p?.id,
                motivos: motivos.join(", ")
            });
        }
    });

    return { validos, descartados };
}

function mostrarAviso(descartados) {
    if (descartados.length === 0) {
        aviso.hidden = true;
        aviso.textContent = "";
        return;
    }

    console.warn(`Se descartaron ${descartados.length} producto(s) inválido(s):`);
    console.table(descartados);

    aviso.textContent =
        `Se descartaron ${descartados.length} producto(s) con datos inválidos (ver consola).`;

    aviso.hidden = false;
}

async function cargarProductos() {
    const respuesta = await fetch(RUTA_DATOS);

    if (!respuesta.ok) {
        const error = new Error(`HTTP ${respuesta.status}`);
        error.tipo = "http";
        error.status = respuesta.status;
        throw error;
    }

    let datos;

    try {
        datos = await respuesta.json();
    } catch (causa) {
        const error = new Error("JSON inválido");
        error.tipo = "json";
        error.causa = causa;
        throw error;
    }

    if (!Array.isArray(datos)) {
        const error = new Error("El JSON debe ser un arreglo");
        error.tipo = "formato";
        throw error;
    }

    return datos;
}

function mensajeError(error) {
    if (error.tipo === "http" && error.status === 404) {
        return "No se encontró el archivo de productos (error 404). Revise la ruta del JSON.";
    }

    if (error.tipo === "http") {
        return `El servidor respondió con un error (${error.status}). Intente nuevamente.`;
    }

    if (error.tipo === "json" || error.tipo === "formato") {
        return "El archivo de productos tiene un formato incorrecto. Avise al administrador.";
    }

    return "No se pudo cargar el catálogo. Verifique su conexión o use Live Server.";
}

function leerControles() {
    return {
        texto: buscador.value.trim().toLowerCase(),
        orden: selOrden.value,
        soloDisponibles: chkDisponibles.checked
    };
}

function coincide(p, controles) {
    const nombre = typeof p.nombre === "string"
        ? p.nombre.toLowerCase()
        : "";

    return nombre.includes(controles.texto) &&
        (!controles.soloDisponibles || p.stock > 0);
}

function ordenar(lista, criterio) {
    const copia = [...lista];

    if (criterio === "precio-asc") {
        copia.sort((a, b) => a.precio - b.precio);
    } else if (criterio === "precio-desc") {
        copia.sort((a, b) => b.precio - a.precio);
    } else if (criterio === "nombre") {
        copia.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    }

    return copia;
}

function obtenerVisibles() {
    const controles = leerControles();

    const filtrados = productos.filter((p) =>
        (categoriaActiva === TODAS || p.categoria === categoriaActiva) &&
        coincide(p, controles)
    );

    return ordenar(filtrados, controles.orden);
}

function obtenerCategorias(lista) {
    return [TODAS, ...new Set(lista.map((p) => p.categoria))];
}

function renderizarFiltros(categorias) {
    const fragmento = document.createDocumentFragment();

    categorias.forEach((cat) => {
        const boton = document.createElement("button");

        boton.type = "button";
        boton.className = "filtro";
        boton.dataset.categoria = cat;
        boton.setAttribute("aria-pressed", String(cat === categoriaActiva));

        fragmento.append(boton);
    });

    contFiltros.replaceChildren(fragmento);
    actualizarContadores();
}

function actualizarContadores() {
    const controles = leerControles();

    contFiltros.querySelectorAll(".filtro").forEach((boton) => {
        const categoria = boton.dataset.categoria;

        const total = productos.filter((p) =>
            (categoria === TODAS || p.categoria === categoria) &&
            coincide(p, controles)
        ).length;

        boton.textContent = `${categoria} (${total})`;
    });
}

function marcarBotonActivo() {
    contFiltros.querySelectorAll(".filtro").forEach((boton) => {
        boton.setAttribute(
            "aria-pressed",
            String(boton.dataset.categoria === categoriaActiva)
        );
    });
}

function categoriaDesdeHash(categorias) {
    const crudo = location.hash.slice(1);

    if (crudo === "") {
        return TODAS;
    }

    let categoria;

    try {
        categoria = decodeURIComponent(crudo);
    } catch {
        return TODAS;
    }

    return categorias.includes(categoria) ? categoria : TODAS;
}

function actualizarHash() {
    const nuevo = categoriaActiva === TODAS
        ? location.pathname + location.search
        : location.pathname + location.search + "#" + encodeURIComponent(categoriaActiva);

    history.replaceState(null, "", nuevo);
}

function variante(ruta, ancho) {
    return ruta.replace(/\.(\w+)$/, `-${ancho}.$1`);
}

function crearTarjeta(p) {
    const nodo = plantilla.content.cloneNode(true);
    const tarjeta = nodo.querySelector(".tarjeta");
    const img = nodo.querySelector("img");
    const etiqueta = nodo.querySelector(".etiqueta");

    tarjeta.dataset.id = p.id;
    tarjeta.tabIndex = 0;

    tarjeta.setAttribute(
        "aria-label",
        `${p.nombre}, ${soles.format(p.precio)}. Ver detalle`
    );

    img.addEventListener("load", () => {
        tarjeta.classList.add("foto-cargada");
    });

    img.onerror = () => {
        img.onerror = null;
        img.removeAttribute("srcset");
        img.src = "img/sin-imagen.jpg";
    };

    img.alt = p.nombre;
    img.sizes = SIZES;

    img.srcset =
        `${variante(p.imagen, 300)} 300w, ${variante(p.imagen, 600)} 600w, ${p.imagen} 900w`;

    img.src = p.imagen;

    if (img.complete && img.naturalWidth > 0) {
        tarjeta.classList.add("foto-cargada");
    }

    nodo.querySelector(".tarjeta__categoria").textContent = p.categoria;
    nodo.querySelector(".tarjeta__nombre").textContent = p.nombre;
    nodo.querySelector(".tarjeta__descripcion").textContent = p.descripcion;
    nodo.querySelector(".tarjeta__precio").textContent = soles.format(p.precio);

    nodo.querySelector(".tarjeta__porciones").textContent =
        p.porciones > 1
            ? `${p.porciones} porciones`
            : "1 unidad";

    if (p.stock === 0) {
        etiqueta.textContent = "Agotado";
        etiqueta.classList.add("etiqueta--agotado");
        etiqueta.hidden = false;
        tarjeta.classList.add("tarjeta--agotado");
    } else if (p.destacado) {
        etiqueta.textContent = "Favorito";
        etiqueta.hidden = false;
    }

    return nodo;
}

function textoEstado(cantidad) {
    const controles = leerControles();

    const partes = [
        `Mostrando ${cantidad} ${cantidad === 1 ? "producto" : "productos"}`
    ];

    partes.push(
        categoriaActiva === TODAS
            ? "en total"
            : `en «${categoriaActiva}»`
    );

    if (controles.texto) {
        partes.push(`con «${buscador.value.trim()}» en el nombre`);
    }

    if (controles.soloDisponibles) {
        partes.push("(solo disponibles)");
    }

    return partes.join(" ") + ".";
}

function renderizarCatalogo() {
    const lista = obtenerVisibles();

    if (lista.length === 0) {
        grilla.replaceChildren();
        estado.textContent = "No hay productos que coincidan con su búsqueda.";
        return;
    }

    const fragmento = document.createDocumentFragment();

    lista.forEach((p) => {
        fragmento.append(crearTarjeta(p));
    });

    grilla.replaceChildren(fragmento);
    estado.textContent = textoEstado(lista.length);
}

function refrescar() {
    renderizarCatalogo();
    actualizarContadores();
}

function mostrarFantasmas(cantidad = NUM_FANTASMAS) {
    const fragmento = document.createDocumentFragment();

    for (let i = 0; i < cantidad; i++) {
        const tarjeta = document.createElement("li");

        tarjeta.className = "tarjeta tarjeta--fantasma";
        tarjeta.setAttribute("aria-hidden", "true");

        const foto = document.createElement("div");
        foto.className = "tarjeta__foto";

        const cuerpo = document.createElement("div");
        cuerpo.className = "tarjeta__cuerpo";

        const linea1 = document.createElement("span");
        linea1.className = "fantasma__linea fantasma__linea--corta";

        const linea2 = document.createElement("span");
        linea2.className = "fantasma__linea";

        const linea3 = document.createElement("span");
        linea3.className = "fantasma__linea";

        cuerpo.append(linea1, linea2, linea3);
        tarjeta.append(foto, cuerpo);
        fragmento.append(tarjeta);
    }

    grilla.replaceChildren(fragmento);
}

function abrirDetalle(tarjeta) {
    const producto = productos.find(
        (p) => p.id === Number(tarjeta.dataset.id)
    );

    if (!producto) {
        return;
    }

    tarjetaAbierta = tarjeta;

    const img = document.querySelector("#detalle-img");

    img.onerror = () => {
        img.onerror = null;
        img.src = "img/sin-imagen.jpg";
    };

    img.src = producto.imagen;
    img.alt = producto.nombre;

    document.querySelector("#detalle-categoria").textContent = producto.categoria;
    document.querySelector("#detalle-titulo").textContent = producto.nombre;
    document.querySelector("#detalle-descripcion").textContent = producto.descripcion;
    document.querySelector("#detalle-precio").textContent = soles.format(producto.precio);

    document.querySelector("#detalle-stock").textContent =
        producto.stock === 0
            ? "Agotado"
            : `Stock: ${producto.stock} ${producto.stock === 1 ? "unidad" : "unidades"}`;

    dialogo.showModal();
}

function limpiarError() {
    estado.classList.remove("estado--error");
    estado.querySelector(".estado__reintentar")?.remove();
}

function mostrarError(error) {
    console.error(error.causa || error);

    grilla.replaceChildren();

    estado.classList.add("estado--error");
    estado.textContent = mensajeError(error) + " ";

    const boton = document.createElement("button");

    boton.type = "button";
    boton.className = "estado__reintentar";
    boton.textContent = "Reintentar";

    boton.addEventListener("click", iniciar);

    estado.append(boton);
    boton.focus();
}

contControles.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".filtro");

    if (!boton || boton.dataset.categoria === categoriaActiva) {
        return;
    }

    categoriaActiva = boton.dataset.categoria;

    marcarBotonActivo();
    actualizarHash();
    refrescar();
});

contControles.addEventListener("input", (evento) => {
    if (evento.target.matches("#buscador")) {
        refrescar();
    }
});

contControles.addEventListener("change", (evento) => {
    if (evento.target.matches("#orden, #solo-disponibles")) {
        refrescar();
    }
});

grilla.addEventListener("click", (evento) => {
    const tarjeta = evento.target.closest(".tarjeta[data-id]");

    if (tarjeta) {
        abrirDetalle(tarjeta);
    }
});

grilla.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter" && evento.key !== " ") {
        return;
    }

    const tarjeta = evento.target.closest(".tarjeta[data-id]");

    if (tarjeta && evento.target === tarjeta) {
        evento.preventDefault();
        abrirDetalle(tarjeta);
    }
});

dialogo.addEventListener("click", (evento) => {
    if (evento.target.closest("[data-cerrar]") || evento.target === dialogo) {
        dialogo.close();
    }
});

dialogo.addEventListener("close", () => {
    if (tarjetaAbierta) {
        tarjetaAbierta.focus();
    }

    tarjetaAbierta = null;
});

window.addEventListener("hashchange", () => {
    if (productos.length === 0) {
        return;
    }

    categoriaActiva = categoriaDesdeHash(obtenerCategorias(productos));

    marcarBotonActivo();
    refrescar();
});

async function iniciar() {
    limpiarError();

    grilla.setAttribute("aria-busy", "true");
    estado.textContent = "Cargando productos…";

    mostrarFantasmas();

    try {
        const datos = await cargarProductos();

        const resultado = validarProductos(datos);

        mostrarAviso(resultado.descartados);

        productos = resultado.validos;

        const categorias = obtenerCategorias(productos);

        categoriaActiva = categoriaDesdeHash(categorias);

        renderizarFiltros(categorias);
        marcarBotonActivo();
        refrescar();

    } catch (error) {
        mostrarError(error);

    } finally {
        grilla.setAttribute("aria-busy", "false");
    }
}

iniciar();
