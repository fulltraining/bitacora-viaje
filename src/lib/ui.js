/* ============================================================
   Bitácora de Viaje · lib/ui.js
   Notificaciones, diálogos de confirmación y visor de imágenes.
   ============================================================ */

import { crear, vaciar } from "./dom.js";

/* ---------------- Notificaciones ---------------- */

const ICONOS = {
  exito:
    '<path d="m5 13 4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  error:
    '<path d="M12 8v5m0 3.5v.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  info: '<path d="M12 11v5m0-8.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

export function notificar(mensaje, tipo = "info", duracion = 3800) {
  const capa = document.getElementById("capa-notificaciones");
  if (!capa) return;

  const nodo = crear("div", {
    class: `notificacion notificacion--${tipo}`,
    attrs: { role: tipo === "error" ? "alert" : "status" },
  });

  nodo.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" style="flex:none;margin-top:1px">${ICONOS[tipo] ?? ICONOS.info}</svg>`;
  nodo.append(crear("span", { text: mensaje, style: { flex: "1" } }));

  capa.append(nodo);

  const cerrar = () => {
    nodo.classList.add("entrando");
    setTimeout(() => nodo.remove(), 220);
  };

  nodo.addEventListener("click", cerrar);
  setTimeout(cerrar, duracion);
}

/* ---------------- Modal ---------------- */

let cerrarModalActual = null;

/**
 * Abre un modal genérico.
 * @param {{titulo:string, texto?:string, cuerpo?:Node, acciones?:Node[], alCerrar?:Function}} opciones
 */
export function abrirModal({ titulo, texto, cuerpo, acciones = [], alCerrar } = {}) {
  const capa = document.getElementById("capa-modal");
  if (!capa) return () => {};

  cerrarModalActual?.();

  const contenido = crear("div", {
    class: "modal",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": titulo ?? "Diálogo" },
  });

  if (titulo) contenido.append(crear("h2", { class: "modal__titulo", text: titulo }));
  if (texto) contenido.append(crear("p", { class: "modal__texto", text: texto }));
  if (cuerpo) contenido.append(cuerpo);

  if (acciones.length) {
    const fila = crear("div", { class: "modal__acciones" });
    for (const accion of acciones) fila.append(accion);
    contenido.append(fila);
  }

  vaciar(capa);
  capa.append(contenido);
  capa.hidden = false;
  document.body.style.overflow = "hidden";

  const cerrar = () => {
    capa.hidden = true;
    vaciar(capa);
    document.body.style.overflow = "";
    cerrarModalActual = null;
    document.removeEventListener("keydown", alPulsarTecla);
    alCerrar?.();
  };

  const alPulsarTecla = (evento) => {
    if (evento.key === "Escape") cerrar();
  };

  document.addEventListener("keydown", alPulsarTecla);
  capa.addEventListener("click", (evento) => {
    if (evento.target === capa) cerrar();
  });

  cerrarModalActual = cerrar;
  setTimeout(() => contenido.querySelector("button, input, textarea")?.focus(), 40);

  return cerrar;
}

export function cerrarModal() {
  cerrarModalActual?.();
}

/**
 * Diálogo de confirmación.
 * @returns {Promise<boolean>}
 */
export function confirmar({
  titulo = "¿Confirmas la acción?",
  texto = "",
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  peligro = false,
} = {}) {
  return new Promise((resolver) => {
    let resuelto = false;

    const botonCancelar = crear("button", {
      type: "button",
      class: "boton boton--contorno",
      text: textoCancelar,
    });

    const botonAceptar = crear("button", {
      type: "button",
      class: `boton ${peligro ? "boton--peligro" : "boton--principal"}`,
      text: textoConfirmar,
    });

    const cerrar = abrirModal({
      titulo,
      texto,
      acciones: [botonCancelar, botonAceptar],
      alCerrar: () => {
        if (!resuelto) {
          resuelto = true;
          resolver(false);
        }
      },
    });

    botonCancelar.addEventListener("click", () => {
      resuelto = true;
      resolver(false);
      cerrar();
    });

    botonAceptar.addEventListener("click", () => {
      resuelto = true;
      resolver(true);
      cerrar();
    });
  });
}

/* ---------------- Visor de imágenes ---------------- */

const SVG_FLECHA_IZQ = `<path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
const SVG_FLECHA_DER = `<path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
const SVG_CERRAR = `<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`;

/**
 * Visor ampliado con navegación por teclado y gestos.
 * @param {Array<{url:string, pie?:string}>} fotos
 * @param {number} indiceInicial
 */
export function abrirVisor(fotos, indiceInicial = 0) {
  if (!fotos?.length) return;

  let indice = Math.max(0, Math.min(indiceInicial, fotos.length - 1));

  const visor = crear("div", {
    class: "visor",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": "Visor de fotografías" },
  });

  const barra = crear("div", { class: "visor__barra" });
  const titulo = crear("div", { class: "visor__titulo" });
  const botonCerrar = crear("button", {
    type: "button",
    class: "visor__flecha",
    html: `<svg viewBox="0 0 24 24" width="20" height="20">${SVG_CERRAR}</svg>`,
    attrs: { "aria-label": "Cerrar visor" },
  });
  barra.append(titulo, botonCerrar);

  const contenedor = crear("div", { class: "visor__contenedor" });
  const imagen = crear("img", { class: "visor__imagen", attrs: { alt: "" } });
  contenedor.append(imagen);

  const pie = crear("div", { class: "visor__pie" });
  const anterior = crear("button", {
    type: "button",
    class: "visor__flecha",
    html: `<svg viewBox="0 0 24 24" width="22" height="22">${SVG_FLECHA_IZQ}</svg>`,
    attrs: { "aria-label": "Fotografía anterior" },
  });
  const siguiente = crear("button", {
    type: "button",
    class: "visor__flecha",
    html: `<svg viewBox="0 0 24 24" width="22" height="22">${SVG_FLECHA_DER}</svg>`,
    attrs: { "aria-label": "Fotografía siguiente" },
  });
  const contador = crear("span", { class: "texto-pequeno" });
  pie.append(anterior, contador, siguiente);

  visor.append(barra, contenedor, pie);
  document.body.append(visor);
  document.body.style.overflow = "hidden";

  function pintar() {
    const foto = fotos[indice];
    imagen.src = foto.url;
    imagen.alt = foto.pie ?? `Fotografía ${indice + 1}`;
    titulo.textContent = foto.pie ?? "";
    contador.textContent = `${indice + 1} / ${fotos.length}`;
    anterior.disabled = indice <= 0;
    siguiente.disabled = indice >= fotos.length - 1;
  }

  function cerrar() {
    visor.remove();
    document.body.style.overflow = "";
    document.removeEventListener("keydown", alPulsarTecla);
  }

  function alPulsarTecla(evento) {
    if (evento.key === "Escape") cerrar();
    if (evento.key === "ArrowLeft" && indice > 0) {
      indice -= 1;
      pintar();
    }
    if (evento.key === "ArrowRight" && indice < fotos.length - 1) {
      indice += 1;
      pintar();
    }
  }

  botonCerrar.addEventListener("click", cerrar);
  anterior.addEventListener("click", () => {
    if (indice > 0) {
      indice -= 1;
      pintar();
    }
  });
  siguiente.addEventListener("click", () => {
    if (indice < fotos.length - 1) {
      indice += 1;
      pintar();
    }
  });
  visor.addEventListener("click", (evento) => {
    if (evento.target === visor || evento.target === contenedor) cerrar();
  });

  // Deslizamiento táctil
  let inicioX = null;
  contenedor.addEventListener("touchstart", (e) => {
    inicioX = e.touches[0]?.clientX ?? null;
  }, { passive: true });
  contenedor.addEventListener(
    "touchend",
    (e) => {
      if (inicioX === null) return;
      const delta = (e.changedTouches[0]?.clientX ?? 0) - inicioX;
      if (Math.abs(delta) > 55) {
        if (delta < 0 && indice < fotos.length - 1) {
          indice += 1;
          pintar();
        } else if (delta > 0 && indice > 0) {
          indice -= 1;
          pintar();
        }
      }
      inicioX = null;
    },
    { passive: true },
  );

  document.addEventListener("keydown", alPulsarTecla);
  pintar();
}

/** Botón de icono reutilizable. */
export function botonIcono(html, etiqueta, onClick, clase = "boton boton--contorno boton--pequeno") {
  return crear("button", {
    type: "button",
    class: clase,
    html: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${html}</svg>`,
    attrs: { "aria-label": etiqueta, title: etiqueta },
    on: { click: onClick },
  });
}
