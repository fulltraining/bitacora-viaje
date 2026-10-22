/* ============================================================
   Bitácora de Viaje · lib/dom.js
   Utilidades mínimas para construir DOM sin framework.
   ============================================================ */

/** Escapa texto para insertarlo con innerHTML. */
export function escapar(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Crea un elemento.
 * @param {string} etiqueta
 * @param {object} [props] class, text, html, dataset, attrs, on, style
 * @param {Array<Node|string|null|undefined>} [hijos]
 */
export function crear(etiqueta, props = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);

  for (const [clave, valor] of Object.entries(props ?? {})) {
    if (valor === null || valor === undefined || valor === false) continue;

    if (clave === "class" || clave === "className") {
      nodo.className = valor;
    } else if (clave === "text") {
      nodo.textContent = valor;
    } else if (clave === "html") {
      nodo.innerHTML = valor;
    } else if (clave === "dataset") {
      Object.assign(nodo.dataset, valor);
    } else if (clave === "style" && typeof valor === "object") {
      Object.assign(nodo.style, valor);
    } else if (clave === "on" && typeof valor === "object") {
      for (const [evento, manejador] of Object.entries(valor)) {
        nodo.addEventListener(evento, manejador);
      }
    } else if (clave === "attrs" && typeof valor === "object") {
      for (const [nombre, contenido] of Object.entries(valor)) {
        if (contenido === null || contenido === undefined || contenido === false) continue;
        nodo.setAttribute(nombre, contenido === true ? "" : String(contenido));
      }
    } else if (clave in nodo && typeof valor !== "object") {
      nodo[clave] = valor;
    } else {
      nodo.setAttribute(clave, valor === true ? "" : String(valor));
    }
  }

  const lista = Array.isArray(hijos) ? hijos : [hijos];
  for (const hijo of lista) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }

  return nodo;
}

/** Selector directo. */
export function qs(selector, raiz = document) {
  return raiz.querySelector(selector);
}

/** Selector multiple. */
export function qsa(selector, raiz = document) {
  return Array.from(raiz.querySelectorAll(selector));
}

/** Vacía un nodo. */
export function vaciar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  return nodo;
}

/** Inserta un nodo al principio de un contenedor. */
export function anteponer(contenedor, nodo) {
  contenedor.insertBefore(nodo, contenedor.firstChild);
  return nodo;
}

/** Icono SVG a partir de un path. */
export function icono(d, opciones = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", opciones.viewBox ?? "0 0 24 24");
  svg.setAttribute("width", opciones.ancho ?? 20);
  svg.setAttribute("height", opciones.alto ?? 20);
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = d;
  return svg;
}

/** Retrasa la ejecución de una función. */
export function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Normaliza texto: colapsa espacios y recorta. */
export function normalizar(valor) {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normaliza un nombre de archivo: sin acentos, sin espacios ni símbolos raros. */
export function sanearNombre(valor) {
  return (
    String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "archivo"
  );
}
