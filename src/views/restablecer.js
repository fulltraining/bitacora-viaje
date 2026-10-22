/* ============================================================
   Bitácora de Viaje · views/restablecer.js
   Establecer una contraseña nueva (destino del enlace de recuperación).
   ============================================================ */

import { crear } from "../lib/dom.js";
import { panelAuth, crearCampo } from "./_comunes.js";
import { establecerNuevaPassword } from "../store/sesion.js";
import { navegar } from "../lib/enrutador.js";
import { notificar } from "../lib/ui.js";
import { obtenerSupabase } from "../lib/supabase.js";

const MINIMO_PASSWORD = 6;

export default {
  titulo: "Nueva contraseña",

  async render() {
    const supabase = obtenerSupabase();

    let tieneSesionDeRecuperacion = false;
    if (supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        tieneSesionDeRecuperacion = Boolean(data?.session);
      } catch {
        tieneSesionDeRecuperacion = false;
      }
    }

    const formulario = crear("form", { class: "formulario-auth", attrs: { novalidate: true } });

    if (!tieneSesionDeRecuperacion) {
      const avisoInicial = crear("div", { class: "aviso aviso--info" });
      avisoInicial.textContent =
        "Abre este apartado desde el enlace que te hemos enviado por correo. Si el enlace ha caducado, pide uno nuevo desde «Recuperar contraseña».";
      formulario.append(avisoInicial);
    }

    const campoPassword = crearCampo({
      etiqueta: "Contraseña nueva",
      tipo: "password",
      name: "password",
      requerido: true,
      autocomplete: "new-password",
      autofocus: true,
      ayuda: `Mínimo ${MINIMO_PASSWORD} caracteres.`,
    });

    const campoRepeticion = crearCampo({
      etiqueta: "Repite la contraseña nueva",
      tipo: "password",
      name: "password2",
      requerido: true,
      autocomplete: "new-password",
    });

    const aviso = crear("div", { class: "aviso aviso--error oculto" });

    const boton = crear("button", {
      type: "submit",
      class: "boton boton--principal boton--bloque boton--grande",
      text: "Guardar contraseña nueva",
    });

    formulario.append(campoPassword.contenedor, campoRepeticion.contenedor, aviso, boton);

    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      aviso.classList.add("oculto");

      const password = campoPassword.entrada.value;
      const repeticion = campoRepeticion.entrada.value;

      if (password.length < MINIMO_PASSWORD) {
        campoPassword.mostrarError(`La contraseña debe tener al menos ${MINIMO_PASSWORD} caracteres.`);
        return;
      }
      campoPassword.limpiarError();

      if (password !== repeticion) {
        campoRepeticion.mostrarError("Las contraseñas no coinciden.");
        return;
      }
      campoRepeticion.limpiarError();

      boton.disabled = true;
      boton.textContent = "Guardando…";

      try {
        await establecerNuevaPassword(password);
        notificar("Contraseña actualizada. Ya puedes entrar.", "exito");
        navegar("/viajes");
      } catch (error) {
        aviso.textContent = error.message;
        aviso.classList.remove("oculto");
        boton.disabled = false;
        boton.textContent = "Guardar contraseña nueva";
      }
    });

    const pie = crear("p", { class: "panel-auth__pie" });
    pie.innerHTML =
      '¿Prefieres volver? <a href="#/acceso">Ir al acceso</a> · <a href="#/recuperar">Pedir otro enlace</a>';

    return panelAuth({
      kicker: "Seguridad",
      titulo: "Elige una contraseña nueva",
      subtitulo: "A partir de ahora entrarás con la contraseña que definas aquí.",
      cuerpo: formulario,
      pie,
    });
  },
};
