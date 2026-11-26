(() => {
    "use strict";
    let THREE = null;
    const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

    const $ = (selector, scope = document) => scope.querySelector(selector);
    const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
    const PRESETS_KEY = "mishky_torta_presets";
    const WHATSAPP = "51984000111";
    const soles = new Intl.NumberFormat("es-PE", {
        style: "currency",
        currency: "PEN"
    });

    const ui = {
        section: $("#personalizador"),
        shape: $("#forma-torta"),
        floors: $("#cantidad-pisos"),
        tiers: $("#pisos-controles"),
        flavor: $("#sabor-bizcocho"),
        filling: $("#tipo-relleno"),
        colorPicker: $("#color-cobertura"),
        palette: $("#paleta-colores"),
        toppings: $("#decoraciones-torta"),
        stage: $("#pastel-3d"),
        status: $("#estado-estabilidad"),
        price: $("#precio-torta"),
        priceDetail: $("#precio-detalle"),
        add: $("#agregar-torta-carrito"),
        whatsapp: $("#consultar-whatsapp"),
        resetView: $("#reiniciar-vista-3d"),
        resetDesign: $("#restablecer-torta"),
        presetName: $("#nombre-preset"),
        presetList: $("#lista-presets"),
        savePreset: $("#guardar-preset"),
        loadPreset: $("#cargar-preset"),
        deletePreset: $("#eliminar-preset"),
        notice: $("#personalizador-aviso")
    };

    if (!ui.section) return;

    const DEFAULT_WIDTHS = [24, 17, 11, 7];
    const DEFAULT_HEIGHTS = [9, 8, 7, 6];
    const FILL_CAPACITY = {
        suave: { pisos: 1, label: "suave" },
        mousse: { pisos: 2, label: "mousse" },
        firme: { pisos: 3, label: "firme" }
    };
    const FLAVORS = {
        vainilla: { label: "Vainilla", extra: 0 },
        chocolate: { label: "Chocolate", extra: 8 },
        redvelvet: { label: "Red velvet", extra: 12 },
        lucuma: { label: "Lúcuma", extra: 10 }
    };
    const FILLINGS = {
        suave: { label: "Suave", extra: 0 },
        mousse: { label: "Mousse", extra: 8 },
        firme: { label: "Firme", extra: 5 }
    };
    const TOPPINGS = {
        frutas: { label: "Frutas frescas", extra: 16 },
        chispas: { label: "Chispas de colores", extra: 6 },
        velas: { label: "Velas", extra: 5 },
        chocolate: { label: "Drip de chocolate", extra: 12 },
        perlas: { label: "Perlas de azúcar", extra: 8 }
    };

    function createDefaultConfig() {
        return {
            shape: "redonda",
            floors: 2,
            tiers: [
                { width: DEFAULT_WIDTHS[0], height: DEFAULT_HEIGHTS[0] },
                { width: DEFAULT_WIDTHS[1], height: DEFAULT_HEIGHTS[1] }
            ],
            flavor: "chocolate",
            filling: "mousse",
            color: "#e8b8a8",
            toppings: ["frutas", "chispas"]
        };
    }

    let config = createDefaultConfig();
    let activeDesignName = "";
    let activePresetId = "";

    let renderer = null;
    let scene = null;
    let camera = null;
    let cakeRoot = null;
    let animationFrame = 0;
    let unstable = false;
    let tilt = 0;
    let dragging = false;
    let lastPointer = { x: 0, y: 0 };
    let toastTimer = 0;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function notify(message, kind = "success") {
        ui.notice.textContent = message;
        ui.notice.className = `personalizador-aviso personalizador-aviso--${kind}`;
        ui.notice.hidden = false;
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            ui.notice.hidden = true;
        }, 3000);
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function readConfig() {
        return clone(config);
    }

    function getTierDefaults(count) {
        return Array.from({ length: count }, (_, index) => ({
            width: DEFAULT_WIDTHS[index],
            height: DEFAULT_HEIGHTS[index]
        }));
    }

    function renderTierControls() {
        const fragment = document.createDocumentFragment();

        config.tiers.forEach((tier, index) => {
            const card = document.createElement("section");
            card.className = "piso-control";

            const header = document.createElement("div");
            header.className = "piso-control__header";

            const title = document.createElement("h4");
            title.textContent = index === 0
                ? "Piso base"
                : `Piso ${index + 1}`;

            const number = document.createElement("span");
            number.className = "piso-control__numero";
            number.textContent = `${index + 1} / ${config.floors}`;
            header.append(title, number);

            const widthLabel = document.createElement("label");
            widthLabel.className = "rango-label";
            widthLabel.htmlFor = `ancho-piso-${index}`;
            widthLabel.innerHTML = `<span>Ancho</span><strong data-width-value="${index}">${tier.width} cm</strong>`;

            const widthInput = document.createElement("input");
            widthInput.type = "range";
            widthInput.id = `ancho-piso-${index}`;
            widthInput.min = "10";
            widthInput.max = "32";
            widthInput.step = "1";
            widthInput.value = String(tier.width);
            widthInput.dataset.tier = String(index);
            widthInput.dataset.dimension = "width";
            widthInput.setAttribute("aria-label", `Ancho del piso ${index + 1} en centímetros`);

            const heightLabel = document.createElement("label");
            heightLabel.className = "rango-label";
            heightLabel.htmlFor = `altura-piso-${index}`;
            heightLabel.innerHTML = `<span>Altura</span><strong data-height-value="${index}">${tier.height} cm</strong>`;

            const heightInput = document.createElement("input");
            heightInput.type = "range";
            heightInput.id = `altura-piso-${index}`;
            heightInput.min = "6";
            heightInput.max = "14";
            heightInput.step = "1";
            heightInput.value = String(tier.height);
            heightInput.dataset.tier = String(index);
            heightInput.dataset.dimension = "height";
            heightInput.setAttribute("aria-label", `Altura del piso ${index + 1} en centímetros`);

            card.append(header, widthLabel, widthInput, heightLabel, heightInput);
            fragment.append(card);
        });

        ui.tiers.replaceChildren(fragment);
    }

    function syncPalette() {
        $$("[data-color]", ui.palette).forEach(button => {
            const selected = button.dataset.color.toLowerCase() === config.color.toLowerCase();
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
        ui.colorPicker.value = config.color;
    }

    function syncToppings() {
        $$('input[name="decoracion"]', ui.toppings).forEach(input => {
            input.checked = config.toppings.includes(input.value);
        });
    }

    function applyConfigToControls() {
        ui.shape.value = config.shape;
        ui.floors.value = String(config.floors);
        ui.flavor.value = config.flavor;
        ui.filling.value = config.filling;
        renderTierControls();
        syncPalette();
        syncToppings();
    }

    function readStability() {
        const reasons = [];
        const tiers = config.tiers;

        for (let index = 1; index < tiers.length; index += 1) {
            const lower = tiers[index - 1];
            const upper = tiers[index];
            if (upper.width > lower.width) {
                reasons.push(
                    `El piso ${index + 1} mide ${upper.width} cm y es más ancho que el piso ${index} (${lower.width} cm). Ningún piso superior puede ser más ancho que el piso que lo sostiene.`
                );
            }
        }

        const totalHeight = tiers.reduce((sum, tier) => sum + tier.height, 0);
        const baseWidth = tiers[0]?.width || 0;
        if (baseWidth > 0 && totalHeight > baseWidth * 1.55) {
            reasons.push(
                `La altura total es ${totalHeight} cm y supera el límite orientativo de ${(baseWidth * 1.55).toFixed(1)} cm para una base de ${baseWidth} cm. Amplía la base o reduce la altura de los pisos.`
            );
        }

        const fill = FILL_CAPACITY[config.filling];
        const floorsAboveBase = config.floors - 1;
        if (fill && floorsAboveBase > fill.pisos) {
            reasons.push(
                `El relleno ${fill.label} no está previsto para soportar ${floorsAboveBase} pisos encima de la base. Con este relleno utiliza como máximo ${fill.pisos + 1} piso(s) en total o cambia a un relleno más firme.`
            );
        }

        return { stable: reasons.length === 0, reasons, totalHeight, baseWidth };
    }

    function calculatePrice() {
        const isRound = config.shape === "redonda";
        const volume = config.tiers.reduce((sum, tier) => {
            const width = tier.width / 10;
            const height = tier.height / 10;
            const area = isRound ? (Math.PI * width * width) / 4 : width * width;
            return sum + area * height;
        }, 0);

        const toppingsExtra = config.toppings.reduce(
            (sum, topping) => sum + (TOPPINGS[topping]?.extra || 0),
            0
        );
        const flavorExtra = FLAVORS[config.flavor]?.extra || 0;
        const fillingExtra = FILLINGS[config.filling]?.extra || 0;
        const shapeExtra = isRound ? 0 : 8;
        const base = 34 + volume * 8.2 + config.floors * 8;
        return Math.ceil(Math.max(59, base + flavorExtra + fillingExtra + toppingsExtra + shapeExtra));
    }

    function formatDescription() {
        const toppingNames = config.toppings.map(key => TOPPINGS[key]?.label).filter(Boolean);
        return [
            `${config.shape === "redonda" ? "Forma redonda" : "Forma cuadrada"}`,
            `${config.floors} piso(s)`,
            `Bizcocho ${FLAVORS[config.flavor].label}`,
            `Relleno ${FILLINGS[config.filling].label}`,
            `Cobertura ${config.color.toUpperCase()}`,
            `Decoraciones: ${toppingNames.length ? toppingNames.join(", ") : "sin decoraciones"}`,
            `Medidas: ${config.tiers.map((tier, index) => `piso ${index + 1}: ${tier.width} × ${tier.height} cm`).join("; ")}`
        ].join(" · ");
    }

    function updateQuoteAndStatus() {
        const validation = readStability();
        const price = calculatePrice();
        unstable = !validation.stable;
        tilt = unstable ? 0.18 : 0;

        ui.price.textContent = soles.format(price);
        ui.priceDetail.textContent = `${config.floors} piso(s) · ${config.shape} · ${FLAVORS[config.flavor].label} · ${FILLINGS[config.filling].label}`;
        ui.add.disabled = unstable;
        ui.add.setAttribute("aria-disabled", String(unstable));
        ui.add.title = unstable ? "Corrige la estabilidad para poder añadir esta torta al carrito." : "Añadir esta torta al carrito";

        ui.status.classList.toggle("is-stable", validation.stable);
        ui.status.classList.toggle("is-unstable", !validation.stable);

        if (validation.stable) {
            ui.status.innerHTML = "<strong>Diseño estable</strong><span>Las proporciones cumplen las reglas de estabilidad configuradas.</span>";
        } else {
            const list = validation.reasons.map(reason => `<li>${escapeHTML(reason)}</li>`).join("");
            ui.status.innerHTML = `<strong>Atención: diseño inestable</strong><ul>${list}</ul><span>La vista se inclinará para mostrar el riesgo. Corrige las medidas o el relleno para habilitar la compra.</span>`;
        }
    }

    function escapeHTML(text) {
        return String(text).replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[character]);
    }

    function disposeGroup(group) {
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            child.traverse(object => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    materials.forEach(material => material.dispose());
                }
            });
        }
    }

    function material(color, roughness = 0.72, metalness = 0) {
        return new THREE.MeshStandardMaterial({ color, roughness, metalness });
    }

    function addMesh(parent, geometry, mat, x, y, z, castShadow = true) {
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    }

    function addSquareBorder(parent, width, y, mat) {
        const thickness = 0.055;
        const depth = 0.055;
        const edge = width / 2;
        const bars = [
            [0, y, edge, width, thickness, depth],
            [0, y, -edge, width, thickness, depth],
            [edge, y, 0, depth, thickness, width],
            [-edge, y, 0, depth, thickness, width]
        ];
        bars.forEach(([x, py, z, sx, sy, sz]) => {
            addMesh(parent, new THREE.BoxGeometry(sx, sy, sz), mat, x, py, z);
        });
    }

    function addTier(widthCm, heightCm, bottomY, index) {
        const width = widthCm / 10;
        const height = heightCm / 10;
        const isRound = config.shape === "redonda";
        const bodyMaterial = material(config.color, 0.55);
        const fillingColors = {
            suave: "#f8e5cb",
            mousse: "#9d614b",
            firme: "#f0d0a0"
        };
        const fillingMaterial = material(fillingColors[config.filling], 0.68);
        const trimMaterial = material("#fff1dc", 0.42);
        let geometry;

        if (isRound) {
            geometry = new THREE.CylinderGeometry(width / 2, width / 2, height, 64, 1);
        } else {
            geometry = new THREE.BoxGeometry(width, height, width);
        }

        const centerY = bottomY + height / 2;
        addMesh(cakeRoot, geometry, bodyMaterial, 0, centerY, 0);

        const fillingHeight = Math.min(0.09, height * 0.14);
        const fillingY = bottomY + height * 0.43;
        const seamGeometry = isRound
            ? new THREE.CylinderGeometry(width / 2 + 0.008, width / 2 + 0.008, fillingHeight, 64, 1)
            : new THREE.BoxGeometry(width + 0.012, fillingHeight, width + 0.012);
        addMesh(cakeRoot, seamGeometry, fillingMaterial, 0, fillingY, 0, false);

        const rimY = bottomY + height - 0.035;
        if (isRound) {
            const rim = new THREE.Mesh(
                new THREE.TorusGeometry(Math.max(0.1, width / 2 - 0.025), 0.025, 8, 64),
                trimMaterial
            );
            rim.rotation.x = Math.PI / 2;
            rim.position.y = rimY;
            rim.castShadow = true;
            cakeRoot.add(rim);
        } else {
            addSquareBorder(cakeRoot, width, rimY, trimMaterial);
        }

        return {
            width,
            height,
            topY: bottomY + height,
            topRadius: width / 2,
            topIndex: index
        };
    }

    function topPositions(width, count) {
        const isRound = config.shape === "redonda";
        if (isRound) {
            return Array.from({ length: count }, (_, index) => {
                const angle = (Math.PI * 2 * index) / count;
                return [Math.cos(angle) * width * 0.27, Math.sin(angle) * width * 0.27];
            });
        }
        const spread = width * 0.26;
        const candidates = [
            [-spread, -spread], [spread, -spread], [spread, spread], [-spread, spread],
            [0, 0], [0, -spread], [spread, 0], [0, spread], [-spread, 0]
        ];
        return candidates.slice(0, count);
    }

    function addToppings(top) {
        const y = top.topY + 0.05;
        const width = top.width;
        const positions = topPositions(width, 8);

        if (config.toppings.includes("frutas")) {
            positions.slice(0, 5).forEach(([x, z], index) => {
                const fruit = addMesh(
                    cakeRoot,
                    new THREE.SphereGeometry(0.115, 14, 12),
                    material(index % 2 ? "#c93443" : "#e34d54", 0.4),
                    x, y + 0.09, z
                );
                fruit.scale.set(0.82, 1.25, 0.82);
                const leaf = addMesh(
                    cakeRoot,
                    new THREE.ConeGeometry(0.055, 0.09, 5),
                    material("#4e8a54", 0.8),
                    x, y + 0.22, z,
                    false
                );
                leaf.rotation.z = 0.25;
            });
        }

        if (config.toppings.includes("chispas")) {
            const colors = ["#e35a5a", "#f0bd4d", "#5d9c85", "#8b6ab0", "#fff0d6"];
            for (let index = 0; index < 34; index += 1) {
                const angle = index * 2.399;
                const radius = width * (0.12 + (index % 5) * 0.075);
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                const sprinkle = addMesh(
                    cakeRoot,
                    new THREE.CapsuleGeometry(0.018, 0.065, 2, 5),
                    material(colors[index % colors.length], 0.45),
                    x, y + 0.025, z,
                    false
                );
                sprinkle.rotation.y = angle;
                sprinkle.rotation.z = (index % 2 ? 1 : -1) * 0.55;
            }
        }

        if (config.toppings.includes("perlas")) {
            positions.forEach(([x, z], index) => {
                addMesh(
                    cakeRoot,
                    new THREE.SphereGeometry(0.065, 10, 8),
                    material(index % 2 ? "#fff5dc" : "#d8b36e", 0.25, 0.1),
                    x * 0.83, y + 0.035, z * 0.83
                );
            });
        }

        if (config.toppings.includes("velas")) {
            const candlePositions = topPositions(width, 3);
            candlePositions.forEach(([x, z], index) => {
                const candle = addMesh(
                    cakeRoot,
                    new THREE.CylinderGeometry(0.035, 0.035, 0.48, 12),
                    material(index % 2 ? "#f5d67c" : "#fff3dc", 0.4),
                    x * 0.58, y + 0.25, z * 0.58
                );
                candle.rotation.z = (index - 1) * 0.045;
                addMesh(
                    cakeRoot,
                    new THREE.SphereGeometry(0.075, 10, 8),
                    material("#ff9d3d", 0.35),
                    x * 0.58, y + 0.53, z * 0.58,
                    false
                );
            });
        }

        if (config.toppings.includes("chocolate")) {
            const count = 12;
            for (let index = 0; index < count; index += 1) {
                const angle = (Math.PI * 2 * index) / count;
                const radius = config.shape === "redonda"
                    ? width * 0.48
                    : width * 0.49;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                const drip = addMesh(
                    cakeRoot,
                    new THREE.SphereGeometry(0.075, 10, 8),
                    material("#5b3027", 0.32),
                    x, y - (index % 3) * 0.035, z
                );
                drip.scale.set(0.75, 1.5 + (index % 3) * 0.25, 0.75);
            }
        }
    }

    function rebuildCake() {
        if (!cakeRoot) {
            updateQuoteAndStatus();
            return;
        }
        disposeGroup(cakeRoot);

        const plateMaterial = material("#f2dfc7", 0.38, 0.08);
        const baseWidth = config.tiers[0].width / 10;
        const plateWidth = baseWidth + 0.28;
        const plateHeight = 0.16;
        const plateGeometry = config.shape === "redonda"
            ? new THREE.CylinderGeometry(plateWidth / 2, plateWidth / 2, plateHeight, 64)
            : new THREE.BoxGeometry(plateWidth, plateHeight, plateWidth);
        addMesh(cakeRoot, plateGeometry, plateMaterial, 0, plateHeight / 2, 0);

        let bottomY = plateHeight;
        let topInfo = null;
        config.tiers.forEach((tier, index) => {
            topInfo = addTier(tier.width, tier.height, bottomY, index);
            bottomY += tier.height / 10;
        });
        if (topInfo) addToppings(topInfo);

        cakeRoot.position.y = 0.04;
        focusCamera();
        updateQuoteAndStatus();
    }

    function init3D() {
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: "high-performance"
            });
        } catch (error) {
            console.error("No se pudo iniciar la vista 3D:", error);
            ui.stage.innerHTML = '<div class="pastel-3d-error"><strong>Vista 3D no disponible</strong><span>Activa la aceleración por hardware o prueba con otro navegador. El cotizador y la personalización siguen funcionando.</span></div>';
            ui.resetView.disabled = true;
            return;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        ui.stage.querySelector(".pastel-3d-loading")?.remove();
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.setAttribute("aria-label", "Vista tridimensional de la torta. Arrastra con el mouse para girarla.");
        ui.stage.append(renderer.domElement);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        focusCamera();

        scene.add(new THREE.HemisphereLight(0xfff4e5, 0x9a7867, 2.0));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
        keyLight.position.set(-4, 8, 6);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffd6b5, 0.85);
        fillLight.position.set(4, 3, -4);
        scene.add(fillLight);

        cakeRoot = new THREE.Group();
        scene.add(cakeRoot);

        resizeRenderer();
        const observer = new ResizeObserver(resizeRenderer);
        observer.observe(ui.stage);
        window.addEventListener("resize", resizeRenderer, { passive: true });

        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerup", onPointerUp);
        renderer.domElement.addEventListener("pointercancel", onPointerUp);
        renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

        rebuildCake();
        animate();
    }

    function resizeRenderer() {
        if (!renderer || !camera) return;
        const width = Math.max(1, ui.stage.clientWidth);
        const height = Math.max(1, ui.stage.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function animate() {
        animationFrame = requestAnimationFrame(animate);
        if (!renderer || !scene || !camera || !cakeRoot) return;

        const time = performance.now() * 0.001;
        const reducedMotion = prefersReducedMotion;
        const wobble = unstable && !reducedMotion ? Math.sin(time * 7.2) * 0.045 : 0;
        cakeRoot.rotation.z += ((unstable ? tilt + wobble : 0) - cakeRoot.rotation.z) * 0.075;
        if (unstable) {
            const wobbleX = reducedMotion ? 0 : Math.sin(time * 5.1) * 0.025;
            cakeRoot.rotation.x += (wobbleX - cakeRoot.rotation.x) * 0.08;
        }
        renderer.render(scene, camera);
    }

    function onPointerDown(event) {
        if (!renderer) return;
        dragging = true;
        lastPointer = { x: event.clientX, y: event.clientY };
        renderer.domElement.setPointerCapture(event.pointerId);
        renderer.domElement.classList.add("is-dragging");
    }

    function onPointerMove(event) {
        if (!dragging || !cakeRoot) return;
        const dx = event.clientX - lastPointer.x;
        const dy = event.clientY - lastPointer.y;
        cakeRoot.rotation.y += dx * 0.009;
        cakeRoot.rotation.x = THREE.MathUtils.clamp(cakeRoot.rotation.x + dy * 0.004, -0.25, 0.25);
        lastPointer = { x: event.clientX, y: event.clientY };
    }

    function onPointerUp(event) {
        dragging = false;
        if (renderer?.domElement) {
            renderer.domElement.classList.remove("is-dragging");
            if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
                renderer.domElement.releasePointerCapture(event.pointerId);
            }
        }
    }

    function onWheel(event) {
        if (!camera) return;
        event.preventDefault();
        camera.position.z = THREE.MathUtils.clamp(camera.position.z + Math.sign(event.deltaY) * 0.35, 5.6, 11.5);
    }

    function focusCamera() {
        if (!camera) return;
        const totalHeight = config.tiers.reduce((sum, tier) => sum + tier.height, 0) / 10;
        const targetY = Math.max(1.0, totalHeight * 0.48 + 0.2);
        const distance = THREE.MathUtils.clamp(8.0 + totalHeight * 0.72, 8.2, 11.4);
        camera.position.set(0, targetY + 2.55, distance);
        camera.lookAt(0, targetY, 0);
    }

    function resetView() {
        if (!cakeRoot || !camera) return;
        cakeRoot.rotation.set(0, 0, 0);
        focusCamera();
    }

    function updateDesign() {
        rebuildCake();
    }

    function updateFloorDimension(event) {
        const input = event.target.closest("input[data-tier][data-dimension]");
        if (!input) return;
        const index = Number(input.dataset.tier);
        const dimension = input.dataset.dimension;
        if (!config.tiers[index]) return;
        config.tiers[index][dimension] = Number(input.value);
        const output = $(`[data-${dimension}-value="${index}"]`, ui.tiers);
        if (output) output.textContent = `${input.value} cm`;
        updateDesign();
    }

    function setFloorCount(count) {
        config.floors = count;
        const nextTiers = getTierDefaults(count);
        config.tiers = nextTiers.map((tier, index) => ({
            width: config.tiers[index]?.width ?? tier.width,
            height: config.tiers[index]?.height ?? tier.height
        }));
        renderTierControls();
        updateDesign();
    }

    function readToppings() {
        config.toppings = $$('input[name="decoracion"]:checked', ui.toppings).map(input => input.value);
        updateDesign();
    }

    function savePreset() {
        const name = ui.presetName.value.trim();
        if (!name) {
            ui.presetName.focus();
            notify("Escribe un nombre para guardar tu diseño.", "warning");
            return;
        }

        try {
            const presets = readPresets();
            const preset = {
                id: `preset-${Date.now()}`,
                name: name.slice(0, 40),
                config: readConfig(),
                updatedAt: new Date().toISOString()
            };
            presets.unshift(preset);
            localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.slice(0, 30)));
            ui.presetName.value = "";
            activeDesignName = preset.name;
            activePresetId = preset.id;
            renderPresetOptions(preset.id);
            notify(`Diseño “${preset.name}” guardado. Al añadirlo al carrito conservará este nombre.`);
        } catch (error) {
            console.error(error);
            notify("No se pudo guardar el preset. Revisa el espacio disponible del navegador.", "warning");
        }
    }

    function readPresets() {
        try {
            const data = JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]");
            return Array.isArray(data) ? data.filter(item => item && typeof item.id === "string" && item.config) : [];
        } catch {
            return [];
        }
    }

    function renderPresetOptions(selectedId = "") {
        const presets = readPresets();
        ui.presetList.replaceChildren();
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = presets.length ? "Elige un diseño guardado" : "Todavía no tienes diseños guardados";
        ui.presetList.append(placeholder);

        presets.forEach(preset => {
            const option = document.createElement("option");
            option.value = preset.id;
            option.textContent = preset.name;
            ui.presetList.append(option);
        });
        ui.presetList.value = selectedId;
        const hasPresets = presets.length > 0;
        ui.loadPreset.disabled = !hasPresets;
        ui.deletePreset.disabled = !hasPresets;
    }

    function loadPreset() {
        const selectedId = ui.presetList.value;
        const preset = readPresets().find(item => item.id === selectedId);
        if (!preset) {
            notify("Selecciona primero un diseño guardado.", "warning");
            return;
        }

        const incoming = preset.config;
        const shape = incoming.shape === "cuadrada" ? "cuadrada" : "redonda";
        const floors = Math.min(4, Math.max(1, Number(incoming.floors) || 1));
        const tiers = Array.isArray(incoming.tiers) ? incoming.tiers.slice(0, floors) : [];
        config = {
            shape,
            floors,
            tiers: getTierDefaults(floors).map((tier, index) => ({
                width: Math.min(32, Math.max(10, Number(tiers[index]?.width) || tier.width)),
                height: Math.min(14, Math.max(6, Number(tiers[index]?.height) || tier.height))
            })),
            flavor: FLAVORS[incoming.flavor] ? incoming.flavor : "vainilla",
            filling: FILLINGS[incoming.filling] ? incoming.filling : "firme",
            color: /^#[0-9a-f]{6}$/i.test(incoming.color) ? incoming.color : "#e8b8a8",
            toppings: Array.isArray(incoming.toppings) ? incoming.toppings.filter(key => TOPPINGS[key]) : []
        };
        activeDesignName = preset.name;
        activePresetId = preset.id;
        applyConfigToControls();
        updateDesign();
        notify(`Diseño “${preset.name}” cargado.`);
    }

    function deletePreset() {
        const selectedId = ui.presetList.value;
        if (!selectedId) {
            notify("Selecciona el diseño que deseas eliminar.", "warning");
            return;
        }
        const presets = readPresets();
        const selected = presets.find(item => item.id === selectedId);
        try {
            localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.filter(item => item.id !== selectedId)));
            if (activePresetId === selectedId) {
                activePresetId = "";
                activeDesignName = "";
            }
            renderPresetOptions();
            notify(`Se eliminó “${selected?.name || "el diseño"}”.`);
        } catch (error) {
            console.error(error);
            notify("No se pudo eliminar el diseño guardado.", "warning");
        }
    }

    function createCartItem() {
        const price = calculatePrice();
        return {
            nombre: activeDesignName || "Torta personalizada",
            precio: price,
            detalle: formatDescription(),
            configuracion: readConfig(),
            nombreDiseno: activeDesignName || ""
        };
    }

    function resetCakeToDefault() {
        config = createDefaultConfig();
        activeDesignName = "";
        activePresetId = "";
        ui.presetName.value = "";
        ui.presetList.value = "";
        applyConfigToControls();
        resetView();
        updateDesign();
        notify("La torta volvió a su diseño inicial. Se quitaron los cambios y decoraciones.");
    }

    function addToCart() {
        const validation = readStability();
        if (!validation.stable) {
            notify("Corrige la estabilidad antes de añadir la torta al carrito.", "warning");
            return;
        }
        const item = createCartItem();
        window.dispatchEvent(new CustomEvent("mishky:agregar-torta-carrito", { detail: item }));
    }

    function contactWhatsApp() {
        const validation = readStability();
        const price = calculatePrice();
        const lines = [
            "Hola, Pastelería Mishky. Tengo una consulta sobre esta torta personalizada:",
            `Diseño: ${activeDesignName || "Torta personalizada"}`,
            "",
            formatDescription(),
            `Precio estimado: ${soles.format(price)}`,
            validation.stable ? "Estado: diseño dentro de las reglas de estabilidad." : `Estado: diseño por revisar. ${validation.reasons.join(" ")}`,
            "",
            "¿Me podrían orientar, por favor?"
        ];
        const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`;
        window.open(url, "_blank", "noopener,noreferrer");
    }

    function bindEvents() {
        ui.shape.addEventListener("change", () => {
            config.shape = ui.shape.value;
            updateDesign();
        });

        ui.floors.addEventListener("change", () => setFloorCount(Number(ui.floors.value)));
        ui.tiers.addEventListener("input", updateFloorDimension);
        ui.tiers.addEventListener("change", updateFloorDimension);

        ui.flavor.addEventListener("change", () => {
            config.flavor = ui.flavor.value;
            updateDesign();
        });
        ui.filling.addEventListener("change", () => {
            config.filling = ui.filling.value;
            updateDesign();
        });

        ui.palette.addEventListener("click", event => {
            const button = event.target.closest("button[data-color]");
            if (!button) return;
            config.color = button.dataset.color;
            syncPalette();
            updateDesign();
        });

        ui.colorPicker.addEventListener("input", () => {
            config.color = ui.colorPicker.value;
            syncPalette();
            updateDesign();
        });

        ui.toppings.addEventListener("change", readToppings);
        ui.resetView.addEventListener("click", resetView);
        ui.resetDesign?.addEventListener("click", resetCakeToDefault);
        ui.savePreset.addEventListener("click", savePreset);
        ui.loadPreset.addEventListener("click", loadPreset);
        ui.deletePreset.addEventListener("click", deletePreset);
        ui.add.addEventListener("click", addToCart);
        ui.whatsapp.addEventListener("click", contactWhatsApp);
    }

    async function start() {
        applyConfigToControls();
        renderPresetOptions();
        bindEvents();

        try {
            THREE = await import(THREE_CDN);
            init3D();
        } catch (error) {
            console.error("No se pudo cargar Three.js desde el CDN:", error);
            ui.stage.innerHTML = '<div class="pastel-3d-error"><strong>No se pudo cargar la vista 3D</strong><span>Comprueba tu conexión a Internet y vuelve a cargar la página. Mientras tanto puedes personalizar, cotizar y guardar tus diseños.</span></div>';
            ui.resetView.disabled = true;
        }

        updateDesign();
    }

    start();
})();
