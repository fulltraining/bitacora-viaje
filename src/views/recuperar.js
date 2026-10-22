/* ============================================================
   Bitácora de Viaje · views/recuperar.js
   Recuperación de contraseña (solicitud del correo).
   ============================================================ */

import { crear } from "../lib/dom.js";
import { panelAuth, crearCampo } from "./_comunes.js";
import { enviarRecuperacion } from "../store/sesion.js";
import { emailValido } from "../lib/formato.js";

export default {
  titulo: "Recuperar contraseña",

  async render() {
    const formulario = crear("form", { class: "formulario-auth", attrs: { novalidate: true } });

    const campoEmail = crearCampo({
      etiqueta: "Correo electrónico",
      tipo: "email",
      name: "email",
      placeholder: "tu@correo.com",
      requerido: true,
      autocomplete: "email",
      autofocus: true,
      ayuda: "Te enviaremos un enlace para establecer una contraseña nueva.",
    });

    const aviso = crear("div", { class: "aviso oculto" });
    const boton = crear("button", {
      type: "submit",
      class: "boton boton--principal boton--bloque boton--grande",
      text: "Enviar enlace de recuperación",
    });

    formulario.append(campoEmail.contenedor, aviso, boton);

    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      aviso.classList.add("oculto");

      const email = campoEmail.entrada.value.trim();
      if (!emailValido(email)) {
        campoEmail.mostrarError("Escribe un correo electrónico válido.");
        return;
      }
      campoEmail.limpiarError();

      boton.disabled = true;
      boton.textContent = "Enviando…";

      try {
        await enviarRecuperacion(email);
        aviso.textContent =
          "Si ese correo está registrado, recibirás un mensaje con el enlace para crear una contraseña nueva.";
        aviso.className = "aviso aviso--exito";
        boton.disabled = true;
        boton.textContent = "Correo enviado";
      } catch (error) {
        aviso.textContent = error.message;
        aviso.className = "aviso aviso--error";
        boton.disabled = false;
        boton.textContent = "Enviar enlace de recuperación";
      }
    });

    const pie = crear("p", { class: "panel-auth__pie" });
    pie.innerHTML = '¿Recuerdas la contraseña? <a href="#/acceso">Vuelve al acceso</a>';

    return panelAuth({
      kicker: "Recuperación",
      titulo: "¿Has olvidado la contraseña?",
      subtitulo: "No pasa nada. Escribe tu correo y te enviaremos las instrucciones.",
      cuerpo: formulario,
      pie,
    });
  },
};
