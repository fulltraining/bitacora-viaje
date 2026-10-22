/* ============================================================
   Bitácora de Viaje · main.js
   Punto de entrada: shell de la aplicación y enrutado de vistas.
   ============================================================ */

import "./styles/base.css";
import "./styles/componentes.css";
import "./styles/vistas.css";
import "leaflet/dist/leaflet.css";

import { qs } from "./lib/dom.js";
import { iniciarEnrutador, navegar, estadoActual } from "./lib/enrutador.js";
import { obtenerSupabase } from "./lib/supabase.js";
import { iniciarSesion, suscribir, obtenerEstado, cerrarSesion } from "./store/sesion.js";
import { notificar } from "./lib/ui.js";

import inicio from "./views/inicio.js";
import acceso from "./views/acceso.js";
import registro from "./views/registro.js";
import recuperar from "./views/recuperar.js";
import restablecer from "./views/restablecer.js";
import viajes from "./views/viajes.js";
import viaje from "./views/viaje.js";
import viajeFormulario from "./views/viaje-formulario.js";
import etapa from "./views/etapa.js";
import perfil from "./views/perfil.js";
import ajustes from "./views/ajustes.js";
import noEncontrada from "./views/no-encontrada.js";

const VISTAS = {
  inicio,
  acceso,
  registro,
  recuperar,
  restablecer,
  viajes,
  viaje,
  "viaje-nuevo": viajeFormulario,
  "viaje-editar": viajeFormulario,
  etapa,
  perfil,
  ajustes,
  "no-encontrada": noEncontrada,
};

const contenido = qs("#contenido");
const cabecera = qs("#cabecera");
const navInferior = qs("#nav-inferior");
const navEscritorio = qs("#nav-escritorio");
const botonMenu = qs("#boton-menu");

let nodoActual = null;
let vistaActual = null;

/* ---------------- Navegación ---------------- */

function actualizarNavegacion(estado, rutaActual) {
  const conectado = Boolean(estado.usuario);

  navInferior.classList.toggle("oculto", !conectado);
  navEscritorio.classList.toggle("oculto", !conectado);

  const activa = rutaActual.startsWith("/viaje") ? "viajes" : rutaActual;

  for (const enlace of document.querySelectorAll("[data-nav]")) {
    const destino = enlace.dataset.nav;
    const esActivo =
      destino === activa ||
      (destino === "inicio" && rutaActual === "/") ||
      (destino === "viajes" && rutaActual.startsWith("/viaje"));

    if (esActivo) enlace.setAttribute("aria-current", "page");
    else enlace.removeAttribute("aria-current");
  }
}

function cerrarMenu() {
  botonMenu?.setAttribute("aria-expanded", "false");
  navEscritorio?.classList.remove("abierta");
}

botonMenu?.addEventListener("click", () => {
  const abierto = botonMenu.getAttribute("aria-expanded") === "true";
  botonMenu.setAttribute("aria-expanded", abierto ? "false" : "true");
  navEscritorio?.classList.toggle("abierta", !abierto);
});

navEscritorio?.addEventListener("click", (evento) => {
  if (evento.target.closest("a")) cerrarMenu();
});

/* ---------------- Cierre de sesión desde la cabecera ---------------- */

document.addEventListener("click", async (evento) => {
  const boton = evento.target.closest('[data-accion="salir"]');
  if (!boton) return;

  try {
    await cerrarSesion();
    notificar("Sesión cerrada. Hasta la próxima.", "exito");
    navegar("/");
  } catch (error) {
    notificar(error.message, "error", 6000);
  }
});

/* ---------------- Render de vistas ---------------- */

async function renderizar({ ruta, consulta, vista, params }) {
  const estado = obtenerEstado();

  // Protección de rutas que requieren sesión iniciada.
  const definicion = estadoActual().definicion;
  if (definicion?.requiereSesion && !estado.usuario && !estado.cargando) {
    navegar("/acceso", { reemplazar: true });
    return;
  }

  const vista_ = VISTAS[vista] ?? VISTAS["no-encontrada"];

  contenido.setAttribute("aria-busy", "true");

  try {
    const nodo = await vista_.render({
      params,
      consulta,
      sesion: estado,
      navegar,
    });

    vistaActual?.alSalir?.();
    nodoActual?.alSalir?.();
    vistaActual = vista_;
    nodoActual = nodo;

    contenido.replaceChildren(nodo);
    contenido.setAttribute("aria-busy", "false");

    document.title = vista_.titulo
      ? `${vista_.titulo} · Bitácora de Viaje`
      : "Bitácora de Viaje";

    actualizarNavegacion(estado, ruta);

    // Vuelve arriba en cada navegación.
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  } catch (error) {
    console.error("Error al mostrar la vista:", error);
    contenido.setAttribute("aria-busy", "false");
    contenido.replaceChildren(
      Object.assign(document.createElement("div"), {
        className: "envoltorio envoltorio--estrecho seccion",
      }),
    );
    const aviso = document.createElement("div");
    aviso.className = "aviso aviso--error";
    aviso.textContent = `No se ha podido mostrar esta pantalla: ${error.message}`;
    contenido.firstChild.append(aviso);
  }
}

/* ---------------- Arranque ---------------- */

async function arrancar() {
  await iniciarSesion();

  iniciarEnrutador({
    alResolver: async (contexto) => {
      if (estadoActual().definicion?.requiereSesion && !obtenerEstado().usuario) {
        navegar("/acceso", { reemplazar: true });
        return;
      }
      await renderizar(contexto);
    },
  });

  // Refleja los cambios de sesión en la interfaz.
  suscribir((estado) => {
    actualizarNavegacion(estado, estadoActual().ruta);
    if (!estado.usuario && estadoActual().definicion?.requiereSesion) {
      navegar("/acceso", { reemplazar: true });
    }
  });

  // Al volver de segundo plano, comprueba que la sesión sigue viva.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const estado = obtenerEstado();
      if (estado.usuario) {
        obtenerSupabase()?.auth.getSession().catch(() => {});
      }
    }
  });
}

arrancar().catch((error) => {
  console.error("No se pudo iniciar la aplicación:", error);
  contenido.replaceChildren();
  const aviso = document.createElement("div");
  aviso.className = "envoltorio envoltorio--estrecho seccion";
  const caja = document.createElement("div");
  caja.className = "aviso aviso--error";
  caja.textContent = `La aplicación no ha podido arrancar: ${error.message}`;
  aviso.append(caja);
  contenido.append(aviso);
});
