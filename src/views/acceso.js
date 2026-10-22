/* ============================================================
   Bitácora de Viaje · views/acceso.js
   Inicio de sesión.
   ============================================================ */

import { crear } from "../lib/dom.js";
import { panelAuth, crearCampo } from "./_comunes.js";
import { iniciarSesionConCredenciales } from "../store/sesion.js";
import { navegar } from "../lib/enrutador.js";
import { notificar } from "../lib/ui.js";
import { emailValido } from "../lib/formato.js";

export default {
  titulo: "Iniciar sesión",

  async render({ sesion }) {
    if (sesion.usuario) {
      navegar("/viajes");
      return crear("div");
    }

    const formulario = crear("form", { class: "formulario-auth", attrs: { novalidate: true } });

    const campoEmail = crearCampo({
      etiqueta: "Correo electrónico",
      tipo: "email",
      name: "email",
      placeholder: "tu@correo.com",
      requerido: true,
      autocomplete: "email",
      autofocus: true,
    });

    const campoPassword = crearCampo({
      etiqueta: "Contraseña",
      tipo: "password",
      name: "password",
      requerido: true,
      autocomplete: "current-password",
    });

    const fila = crear("div", { class: "fila fila--entre" });
    const recordar = crear("label", { class: "casilla" });
    const casilla = crear("input", { type: "checkbox" });
    casilla.checked = true;
    recordar.append(casilla, document.createTextNode("Recordarme en este dispositivo"));
    const enlaceOlvido = crear("a", {
      class: "enlace-sutil",
      text: "¿Has olvidado la contraseña?",
      attrs: { href: "#/recuperar" },
    });
    fila.append(recordar, enlaceOlvido);

    const aviso = crear("div", { class: "aviso aviso--error oculto" });

    const boton = crear("button", {
      type: "submit",
      class: "boton boton--principal boton--bloque boton--grande",
      text: "Entrar en mi bitácora",
    });

    formulario.append(campoEmail.contenedor, campoPassword.contenedor, fila, aviso, boton);

    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      aviso.classList.add("oculto");

      const email = campoEmail.entrada.value.trim();
      const password = campoPassword.entrada.value;

      let valido = true;
      if (!emailValido(email)) {
        campoEmail.mostrarError("Escribe un correo electrónico válido.");
        valido = false;
      } else {
        campoEmail.limpiarError();
      }

      if (!password) {
        campoPassword.mostrarError("Escribe tu contraseña.");
        valido = false;
      } else {
        campoPassword.limpiarError();
      }

      if (!valido) return;

      boton.disabled = true;
      boton.textContent = "Entrando…";

      try {
        await iniciarSesionConCredenciales({ email, password });
        notificar("¡Bienvenido de vuelta!", "exito");
        navegar("/viajes");
      } catch (error) {
        aviso.textContent = error.message;
        aviso.classList.remove("oculto");
        boton.disabled = false;
        boton.textContent = "Entrar en mi bitácora";
      }
    });

    const pie = crear("p", { class: "panel-auth__pie" });
    pie.innerHTML =
      '¿Todavía no tienes bitácora? <a href="#/registro">Crea una cuenta gratis</a>';

    return panelAuth({
      kicker: "Acceso",
      titulo: "Vuelve a tu bitácora",
      subtitulo: "Introduce tus credenciales para recuperar tus viajes y tus etapas.",
      cuerpo: formulario,
      pie,
    });
  },
};
