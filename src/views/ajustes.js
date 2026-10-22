/* ============================================================
   Bitácora de Viaje · views/ajustes.js
   Configuración de Supabase e información de la instalación.
   ============================================================ */

import { crear } from "../lib/dom.js";
import { crearCampo } from "./_comunes.js";
import {
  obtenerConfig,
  guardarConfig,
  borrarConfigGuardada,
  urlValida,
  leerConfigGuardada,
} from "../lib/config.js";
import { reiniciarSupabase } from "../lib/supabase.js";
import { detenerSesion, iniciarSesion } from "../store/sesion.js";
import { notificar } from "../lib/ui.js";

export default {
  titulo: "Configuración",

  async render() {
    const nodo = crear("div", { class: "seccion envoltorio envoltorio--estrecho" });

    const config = obtenerConfig();
    const guardada = leerConfigGuardada();

    nodo.append(
      crear("div", {
        class: "seccion__cabecera",
        html: `
          <div class="seccion__titulo">
            <p class="kicker">Instalación</p>
            <h1>Configuración</h1>
          </div>
        `,
      }),
    );

    /* ---------- Estado actual ---------- */
    const estado = crear("section", { class: "bloque" });
    estado.append(
      crear("div", {
        class: "bloque__cabecera",
        html: `<div><p class="kicker">Estado</p><h2>Conexión con Supabase</h2></div>`,
      }),
    );

    const aviso = crear("div", {
      class: config ? "aviso aviso--exito" : "aviso aviso--info",
    });
    aviso.textContent = config
      ? `Configuración activa desde ${config.origen === "entorno" ? "las variables de entorno (.env)" : "este dispositivo"}.`
      : "Supabase todavía no está configurado. Añade la URL de tu proyecto y la clave pública (anon key) para empezar a guardar viajes.";

    estado.append(aviso);
    nodo.append(estado);

    /* ---------- Formulario ---------- */
    const seccionForm = crear("section", { class: "bloque" });
    seccionForm.append(
      crear("div", {
        class: "bloque__cabecera",
        html: `<div><p class="kicker">Credenciales</p><h2>Conectar con tu proyecto</h2></div>`,
      }),
    );

    const formulario = crear("form", { attrs: { novalidate: true } });

    const campoUrl = crearCampo({
      etiqueta: "URL del proyecto",
      name: "url",
      valor: config?.url ?? "",
      placeholder: "https://tuproyecto.supabase.co",
      ayuda: "En el panel de Supabase: Project Settings → Data API → Project URL.",
    });

    const campoClave = crearCampo({
      etiqueta: "Clave pública (anon key)",
      name: "anonKey",
      valor: guardada?.anonKey ?? "",
      placeholder: "eyJhbGciOi…",
      ayuda: "Project Settings → API Keys → anon public key. Es segura para el navegador.",
    });

    const error = crear("div", { class: "aviso aviso--error oculto" });

    const acciones = crear("div", { class: "fila" });
    const botonGuardar = crear("button", {
      type: "submit",
      class: "boton boton--principal",
      text: "Guardar configuración",
    });
    const botonBorrar = crear("button", {
      type: "button",
      class: "boton boton--peligro-contorno",
      text: "Borrar del dispositivo",
    });
    acciones.append(botonGuardar, botonBorrar);

    formulario.append(campoUrl.contenedor, campoClave.contenedor, error, acciones);
    seccionForm.append(formulario);
    nodo.append(seccionForm);

    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      error.classList.add("oculto");

      const url = campoUrl.entrada.value.trim();
      const anonKey = campoClave.entrada.value.trim();

      if (!urlValida(url)) {
        campoUrl.mostrarError("Introduce una URL válida (https://...).");
        return;
      }
      campoUrl.limpiarError();

      if (!anonKey || anonKey.length < 20) {
        campoClave.mostrarError("Introduce la clave pública de tu proyecto.");
        return;
      }
      campoClave.limpiarError();

      guardarConfig({ url, anonKey });
      detenerSesion();
      reiniciarSupabase();
      await iniciarSesion();

      notificar("Configuración guardada. Ya puedes iniciar sesión.", "exito", 5000);
    });

    botonBorrar.addEventListener("click", () => {
      borrarConfigGuardada();
      detenerSesion();
      reiniciarSupabase();
      campoUrl.entrada.value = "";
      campoClave.entrada.value = "";
      notificar("Configuración borrada de este dispositivo.", "info");
    });

    /* ---------- Base de datos ---------- */
    const seccionBd = crear("section", { class: "bloque" });
    seccionBd.append(
      crear("div", {
        class: "bloque__cabecera",
        html: `<div><p class="kicker">Base de datos</p><h2>Esquema y políticas</h2></div>`,
      }),
    );

    seccionBd.append(
      crear("p", {
        class: "texto-suave",
        text: "El script completo de PostgreSQL (tablas, índices, RLS y buckets de Storage) está en el archivo supabase/schema.sql del proyecto. Ejecútalo en el editor SQL de Supabase o con la CLI:",
      }),
    );

    const bloque = crear("pre", { class: "codigo" });
    bloque.textContent = "supabase db push\n# o bien: pega supabase/schema.sql en el editor SQL";
    seccionBd.append(bloque);

    const pasos = crear("ol", { class: "pasos" });
    for (const paso of [
      "Crea el script en supabase/schema.sql y ejecútalo en el panel de Supabase (SQL Editor).",
      "Crea los buckets de Storage «fotos» y «gpx» (el script los crea si tienes permisos de administrador).",
      "En Authentication → Providers → Email, decide si quieres exigir la confirmación de correo.",
      "Pega aquí la URL y la clave pública, o define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env.",
      "Sirve la aplicación con npm run build y publica la carpeta dist/ en cualquier hosting estático.",
    ]) {
      pasos.append(crear("li", { text: paso }));
    }
    seccionBd.append(pasos);
    nodo.append(seccionBd);

    /* ---------- Aplicación ---------- */
    const seccionApp = crear("section", { class: "bloque" });
    seccionApp.append(
      crear("div", {
        class: "bloque__cabecera",
        html: `<div><p class="kicker">Aplicación</p><h2>Sobre esta versión</h2></div>`,
      }),
    );

    const lista = crear("ul", { class: "pasos"});
    for (const item of [
      "Bitácora de Viaje · versión 1.0.0",
      "Editable, responsive y preparado para instalarse como PWA.",
      "Mapas © colaboradores de OpenStreetMap.",
      "Las fotografías se redimensionan en el dispositivo antes de subirlas.",
    ]) {
      lista.append(crear("li", { text: item }));
    }
    seccionApp.append(lista);
    nodo.append(seccionApp);

    return nodo;
  },
};
