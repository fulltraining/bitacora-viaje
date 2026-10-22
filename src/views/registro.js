/* ============================================================
   Bitácora de Viaje · views/registro.js
   Alta de nuevo usuario.
   ============================================================ */

import { crear } from "../lib/dom.js";
import { panelAuth, crearCampo } from "./_comunes.js";
import { registrar } from "../store/sesion.js";
import { navegar } from "../lib/enrutador.js";
import { notificar } from "../lib/ui.js";
import { emailValido } from "../lib/formato.js";

const MINIMO_PASSWORD = 6;

export default {
  titulo: "Crear cuenta",

  async render({ sesion }) {
    if (sesion.usuario) {
      navegar("/viajes");
      return crear("div");
    }

    const formulario = crear("form", { class: "formulario-auth", attrs: { novalidate: true } });

    const campoNombre = crearCampo({
      etiqueta: "Nombre",
      name: "nombre",
      placeholder: "Cómo te gustaría que te llamaran",
      ayuda: "Aparecerá en tu perfil y en la cabecera de tus viajes.",
      maxlength: 80,
      autofocus: true,
    });

    const campoEmail = crearCampo({
      etiqueta: "Correo electrónico",
      tipo: "email",
      name: "email",
      placeholder: "tu@correo.com",
      requerido: true,
      autocomplete: "email",
      ayuda: "Si tu proyecto exige confirmación de correo, te enviaremos un mensaje.",
    });

    const campoPassword = crearCampo({
      etiqueta: "Contraseña",
      tipo: "password",
      name: "password",
      requerido: true,
      autocomplete: "new-password",
      ayuda: `Mínimo ${MINIMO_PASSWORD} caracteres.`,
    });

    const campoRepeticion = crearCampo({
      etiqueta: "Repite la contraseña",
      tipo: "password",
      name: "password2",
      requerido: true,
      autocomplete: "new-password",
    });

    const casilla = crear("label", { class: "casilla" });
    const entradaCasilla = crear("input", { type: "checkbox" });
    casilla.append(
      entradaCasilla,
      document.createTextNode(
        "He leído y acepto la política de privacidad: mis fotos y rutas se guardan en mi propia cuenta.",
      ),
    );

    const aviso = crear("div", { class: "aviso aviso--error oculto" });

    const boton = crear("button", {
      type: "submit",
      class: "boton boton--acento boton--bloque boton--grande",
      text: "Crear mi cuenta",
    });

    formulario.append(
      campoNombre.contenedor,
      campoEmail.contenedor,
      campoPassword.contenedor,
      campoRepeticion.contenedor,
      casilla,
      aviso,
      boton,
    );

    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      aviso.classList.add("oculto");

      const nombre = campoNombre.entrada.value.trim();
      const email = campoEmail.entrada.value.trim();
      const password = campoPassword.entrada.value;
      const repeticion = campoRepeticion.entrada.value;

      let valido = true;

      if (!emailValido(email)) {
        campoEmail.mostrarError("Escribe un correo electrónico válido.");
        valido = false;
      } else campoEmail.limpiarError();

      if (password.length < MINIMO_PASSWORD) {
        campoPassword.mostrarError(`La contraseña debe tener al menos ${MINIMO_PASSWORD} caracteres.`);
        valido = false;
      } else campoPassword.limpiarError();

      if (password !== repeticion) {
        campoRepeticion.mostrarError("Las contraseñas no coinciden.");
        valido = false;
      } else campoRepeticion.limpiarError();

      if (!entradaCasilla.checked) {
        aviso.textContent = "Debes aceptar la política de privacidad para continuar.";
        aviso.classList.remove("oculto");
        valido = false;
      }

      if (!valido) return;

      boton.disabled = true;
      boton.textContent = "Creando cuenta…";

      try {
        const resultado = await registrar({ email, password, nombre });
        notificar(resultado.mensaje, resultado.requiereConfirmacion ? "info" : "exito", 6000);
        if (resultado.requiereConfirmacion) {
          navegar("/acceso");
        } else {
          navegar("/viajes");
        }
      } catch (error) {
        aviso.textContent = error.message;
        aviso.classList.remove("oculto");
        boton.disabled = false;
        boton.textContent = "Crear mi cuenta";
      }
    });

    const pie = crear("p", { class: "panel-auth__pie" });
    pie.innerHTML = '¿Ya tienes cuenta? <a href="#/acceso">Inicia sesión</a>';

    return panelAuth({
      kicker: "Registro",
      titulo: "Abre tu bitácora de viaje",
      subtitulo:
        "Unas pocas líneas y tendrás tu espacio personal para guardar rutas, fotos y el diario de cada etapa.",
      cuerpo: formulario,
      pie,
    });
  },
};
