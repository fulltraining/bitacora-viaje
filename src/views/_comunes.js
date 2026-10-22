/* ============================================================
   Bitácora de Viaje · views/_comunes.js
   Piezas compartidas por las vistas (campos de formulario, paneles).
   ============================================================ */

import { crear } from "../lib/dom.js";

/**
 * Crea un campo de formulario con etiqueta, ayuda y hueco de error.
 * @returns {{contenedor:HTMLElement, entrada:HTMLElement, mostrarError:Function, limpiarError:Function}}
 */
export function crearCampo({
  etiqueta,
  tipo = "text",
  valor = "",
  ayuda = "",
  placeholder = "",
  requerido = false,
  maxlength = null,
  autocomplete = null,
  autofocus = false,
  name = "",
}) {
  const id = `campo-${Math.random().toString(36).slice(2, 9)}`;

  const entrada = crear(tipo === "textarea" ? "textarea" : "input", {
    class: tipo === "textarea" ? "area" : "entrada",
    id,
    ...(tipo === "textarea" ? { rows: 6 } : { type: tipo }),
  });

  if (name) entrada.name = name;
  if (valor) entrada.value = valor;
  if (placeholder) entrada.setAttribute("placeholder", placeholder);
  if (requerido) entrada.required = true;
  if (maxlength) entrada.maxLength = maxlength;
  if (autocomplete) entrada.setAttribute("autocomplete", autocomplete);
  if (autofocus) entrada.setAttribute("autofocus", "");

  const contenedor = crear("div", { class: "campo" });
  contenedor.append(
    crear("label", { class: "campo__etiqueta", text: etiqueta, attrs: { for: id } }),
    entrada,
  );

  if (ayuda) contenedor.append(crear("span", { class: "campo__ayuda", text: ayuda }));

  const huecoError = crear("span", { class: "campo__error oculto" });
  contenedor.append(huecoError);

  const mostrarError = (mensaje) => {
    huecoError.textContent = mensaje ?? "";
    huecoError.classList.toggle("oculto", !mensaje);
    entrada.setAttribute("aria-invalid", mensaje ? "true" : "false");
  };

  entrada.addEventListener("input", () => {
    if (huecoError.textContent) mostrarError("");
  });

  return { contenedor, entrada, mostrarError, limpiarError: () => mostrarError("") };
}

/**
 * Panel editorial de autenticación (columna estrecha con cabecera).
 */
export function panelAuth({ kicker, titulo, subtitulo, cuerpo, pie }) {
  const panel = crear("section", { class: "panel-auth" });

  const cabecera = crear("div", { class: "panel-auth__cabecera" });
  if (kicker) cabecera.append(crear("p", { class: "kicker", text: kicker }));
  cabecera.append(crear("h1", { class: "panel-auth__titulo", text: titulo }));
  if (subtitulo) cabecera.append(crear("p", { class: "entradilla", text: subtitulo }));
  panel.append(cabecera);

  const caja = crear("div", { class: "panel-auth__caja" });
  if (cuerpo) caja.append(cuerpo);
  panel.append(caja);

  if (pie) panel.append(pie);

  return panel;
}

/**
 * Estado vacío reutilizable.
 */
export function estadoVacio({ icono, titulo, texto, accion = null }) {
  const nodo = crear("div", { class: "vacio" });

  if (icono) {
    nodo.innerHTML = `<span class="vacio__icono">
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
           stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icono}</svg>
    </span>`;
  }

  nodo.append(crear("h3", { class: "vacio__titulo", text: titulo }));
  if (texto) nodo.append(crear("p", { class: "vacio__texto", text: texto }));
  if (accion) nodo.append(accion);

  return nodo;
}

/** Iconos SVG reutilizables. */
export const ICONOS = {
  mas: `<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  lapiz: `<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`,
  papelera: `<path d="M4 7h16M10 11v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  flecha: `<path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  volver: `<path d="M19 12H5m6 6-6-6 6-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  foto: `<path d="M3 8A1.5 1.5 0 0 1 4.5 6.5h3l1.2-2h6.6l1.2 2h3A1.5 1.5 0 0 1 21 8v8.5A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5V8Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
  mapa: `<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Zm0 0v13m6-10.5v13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>`,
  gpx: `<path d="M4 19 9 6l5 9 2.5-4.5L20 19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  reloj: `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
  texto: `<path d="M5 6h14M5 12h14M5 18h9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  calendario: `<rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10h17M8 3v4m8-4v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  lugar: `<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
  usuario: `<circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.8 20c.9-3.7 3.7-5.6 7.2-5.6s6.3 1.9 7.2 5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  salir: `<path d="M14 7V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2M9 12h11m0 0-3-3m3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  ajustes: `<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
  aviso: `<path d="M12 8v5m0 3.5v.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
};
