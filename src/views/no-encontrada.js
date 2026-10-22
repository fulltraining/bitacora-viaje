/* ============================================================
   Bitácora de Viaje · views/no-encontrada.js
   Página no encontrada.
   ============================================================ */

import { crear } from "../lib/dom.js";

export default {
  titulo: "Página no encontrada",

  async render() {
    const nodo = crear("section", { class: "seccion envoltorio envoltorio--estrecho centrado" });

    nodo.append(
      crear("p", { class: "kicker", text: "Error 404" }),
      crear("h1", { text: "Esta página no existe" }),
      crear("p", {
        class: "entradilla",
        text: "El enlace que has seguido no lleva a ningún sitio. Vuelve al inicio o busca uno de tus viajes.",
      }),
    );

    const acciones = crear("div", { class: "fila", style: { justifyContent: "center", marginTop: "1.6rem" } });
    acciones.append(
      crear("a", { class: "boton boton--principal", text: "Ir al inicio", attrs: { href: "#/" } }),
      crear("a", { class: "boton boton--contorno", text: "Mis viajes", attrs: { href: "#/viajes" } }),
    );
    nodo.append(acciones);

    return nodo;
  },
};
