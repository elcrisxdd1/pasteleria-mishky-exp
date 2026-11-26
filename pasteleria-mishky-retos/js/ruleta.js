(() => {
    "use strict";

    const CLAVE_CUPON = "mishky_cupon";

    const REDUCIR_MOVIMIENTO = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DURACION_GIRO = REDUCIR_MOVIMIENTO ? 360 : 4200;

    const PREMIOS = [
        {
            codigo: "DULCE5",
            tipo: "porcentaje",
            valor: 5,
            descripcion: "5% de descuento en productos"
        },
        {
            codigo: "MISHKY10",
            tipo: "porcentaje",
            valor: 10,
            descripcion: "10% de descuento en productos"
        },
        {
            codigo: "ENVIOGRATIS",
            tipo: "envio_gratis",
            valor: 0,
            descripcion: "Envío gratis en tu compra"
        }
    ];

    const botonAbrir = document.querySelector("#abrir-ruleta");
    const modal = document.querySelector("#modal-ruleta");
    const botonCerrar = document.querySelector("#cerrar-ruleta");
    const botonGirar = document.querySelector("#girar-ruleta");
    const rueda = document.querySelector("#ruleta-rueda");
    const mensaje = document.querySelector("#ruleta-mensaje");
    const panelCupon = document.querySelector("#ruleta-cupon");
    const codigoCupon = document.querySelector("#ruleta-codigo");
    const descripcionCupon = document.querySelector("#ruleta-descripcion");
    const botonCopiar = document.querySelector("#copiar-cupon");

    let girando = false;
    let cuponActual = null;
    let anguloRueda = 0;
    let frameGiro = 0;

    function leerCuponGuardado() {
        try {
            const guardado = localStorage.getItem(CLAVE_CUPON);

            if (guardado === null) {
                return {
                    estado: "disponible",
                    cupon: null
                };
            }

            const cupon = JSON.parse(guardado);

            if (
                !cupon ||
                typeof cupon.codigo !== "string" ||
                typeof cupon.tipo !== "string" ||
                typeof cupon.valor !== "number" ||
                typeof cupon.descripcion !== "string"
            ) {
                return {
                    estado: "invalido",
                    cupon: null
                };
            }

            return {
                estado: "girada",
                cupon
            };

        } catch (error) {
            return {
                estado: "error",
                cupon: null
            };
        }
    }

    function mostrarCupon(cupon) {
        cuponActual = cupon;

        codigoCupon.textContent = cupon.codigo;
        descripcionCupon.textContent = cupon.descripcion;

        panelCupon.hidden = false;

        botonGirar.disabled = true;

        botonGirar.textContent = cupon.usado
            ? "Cupón canjeado"
            : "Giro utilizado";

        botonAbrir.textContent = cupon.usado
            ? "🎁 Cupón utilizado"
            : "🎁 Ver mi cupón";

        botonCopiar.disabled = cupon.usado === true;
    }

    function actualizarInterfaz() {
        const resultado = leerCuponGuardado();

        if (resultado.estado === "girada") {
            mostrarCupon(resultado.cupon);

            mensaje.textContent = resultado.cupon.usado
                ? "Este cupón ya fue canjeado en un pedido."
                : "Ya utilizaste tu giro. Este es tu cupón guardado:";

            return;
        }

        if (
            resultado.estado === "error" ||
            resultado.estado === "invalido"
        ) {
            botonGirar.disabled = true;

            mensaje.textContent =
                "No se pudo leer el cupón guardado en este navegador.";

            return;
        }

        cuponActual = null;

        panelCupon.hidden = true;

        botonGirar.disabled = false;

        botonGirar.textContent = "Girar ruleta";

        botonAbrir.textContent = "🎁 Gira y gana un cupón";

        mensaje.textContent =
            "Presiona el botón para descubrir tu premio.";
    }

    function guardarCupon(cupon) {
        try {
            if (localStorage.getItem(CLAVE_CUPON) !== null) {
                return false;
            }

            localStorage.setItem(
                CLAVE_CUPON,
                JSON.stringify(cupon)
            );

            return true;

        } catch (error) {
            return false;
        }
    }

    function finalizarGiro(cupon) {
        if (!girando) {
            return;
        }

        girando = false;

        mostrarCupon(cupon);

        mensaje.textContent =
            `¡Felicidades! Ganaste ${cupon.descripcion}. Copia el código y pégalo en el carrito para decidir cuándo aplicarlo.`;

        botonCopiar.focus();
    }

    function girarRuleta() {
        if (
            girando ||
            leerCuponGuardado().estado !== "disponible"
        ) {
            actualizarInterfaz();
            return;
        }

        const indice = Math.floor(
            Math.random() * PREMIOS.length
        );

        const premio = PREMIOS[indice];

        const cupon = {
            codigo: premio.codigo,
            tipo: premio.tipo,
            valor: premio.valor,
            descripcion: premio.descripcion,
            activo: false,
            usado: false,
            fechaCreacion: new Date().toISOString()
        };

        if (!guardarCupon(cupon)) {
            botonGirar.disabled = true;

            mensaje.textContent =
                "No se pudo guardar el cupón. Revisa el almacenamiento del navegador.";

            return;
        }

        girando = true;

        botonGirar.disabled = true;

        mensaje.textContent = "La ruleta está girando…";

        const anguloCentro = indice * 120 + 60;
        const anguloDestino = (360 - anguloCentro + 360) % 360;

        if (REDUCIR_MOVIMIENTO) {
            anguloRueda = anguloDestino + 360;
            rueda.style.transition = "transform .35s ease-out";
            rueda.style.transform = `rotate(${anguloRueda}deg)`;
            window.setTimeout(() => finalizarGiro(cupon), DURACION_GIRO);
            return;
        }

        // La rueda no se detiene antes del resultado: gira continuamente hasta entrar
        // en una fase de desaceleración que termina exactamente en el premio ganador.
        rueda.style.transition = "none";
        rueda.classList.add("is-spinning");
        anguloRueda = 0;
        rueda.style.transform = "rotate(0deg)";

        let ultimoFrame = 0;
        const animarContinuo = (ahora) => {
            if (!girando) return;
            const deltaFrames = ultimoFrame ? Math.min((ahora - ultimoFrame) / 16.67, 2) : 1;
            ultimoFrame = ahora;
            anguloRueda += 8 * deltaFrames;
            rueda.style.transform = `rotate(${anguloRueda}deg)`;
            frameGiro = window.requestAnimationFrame(animarContinuo);
        };
        frameGiro = window.requestAnimationFrame(animarContinuo);

        window.setTimeout(() => {
            window.cancelAnimationFrame(frameGiro);
            rueda.classList.remove("is-spinning");

            const actualNormalizado = ((anguloRueda % 360) + 360) % 360;
            const avanceHastaPremio = (anguloDestino - actualNormalizado + 360) % 360;
            const anguloFinal = anguloRueda + 360 + avanceHastaPremio;
            const anguloInicial = anguloRueda;
            const inicio = performance.now();
            const duracionFrenado = 2600;

            const desacelerar = (ahora) => {
                const progreso = Math.min(1, (ahora - inicio) / duracionFrenado);
                const easeOut = 1 - Math.pow(1 - progreso, 2);
                anguloRueda = anguloInicial + (anguloFinal - anguloInicial) * easeOut;
                rueda.style.transform = `rotate(${anguloRueda}deg)`;

                if (progreso < 1) {
                    frameGiro = window.requestAnimationFrame(desacelerar);
                } else {
                    anguloRueda = anguloFinal;
                    rueda.style.transform = `rotate(${anguloFinal}deg)`;
                    finalizarGiro(cupon);
                }
            };
            frameGiro = window.requestAnimationFrame(desacelerar);
        }, DURACION_GIRO);
    }

    async function copiarCupon() {
        if (!cuponActual) {
            return;
        }

        try {
            await navigator.clipboard.writeText(
                cuponActual.codigo
            );

            mensaje.textContent =
                `Código ${cuponActual.codigo} copiado.`;

        } catch (error) {
            mensaje.textContent =
                "No se pudo copiar automáticamente. Selecciona el código para copiarlo.";
        }
    }

    botonAbrir.addEventListener("click", () => {
        actualizarInterfaz();
        modal.showModal();
    });

    botonCerrar.addEventListener("click", () => {
        modal.close();
    });

    modal.addEventListener("click", (evento) => {
        if (evento.target === modal) {
            modal.close();
        }
    });

    botonGirar.addEventListener("click", girarRuleta);

    botonCopiar.addEventListener("click", copiarCupon);

    window.addEventListener("storage", (evento) => {
        if (
            evento.key === CLAVE_CUPON ||
            evento.key === null
        ) {
            actualizarInterfaz();
        }
    });

    window.addEventListener(
        "mishky:cupon-actualizado",
        actualizarInterfaz
    );

    actualizarInterfaz();

})();