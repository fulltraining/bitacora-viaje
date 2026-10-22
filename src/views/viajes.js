/* ============================================================
   Bitácora de Viaje · views/viajes.js
   Listado de los viajes del usuario.
   ============================================================ */

import { crear, vaciar } from "../lib/dom.js";
import { estadoVacio, ICONOS } from "./_comunes.js";
import { listarViajes, eliminarViaje } from "../store/viajes.js";
import { exigirSupabase } from "../lib/supabase.js";
import { navegar } from "../lib/enrutador.js";
import { confirmar, notificar, botonIcono } from "../lib/ui.js";
import { rangoFechas, numero, haceCuanto } from "../lib/formato.js";

export default {
  titulo: "Mis viajes",

  async render({ sesion }) {
    const userId = sesion.usuario?.id;
    const nodo = crear("div", { class: "seccion envoltorio" });

    if (!userId) {
      nodo.append(estadoVacio({ titulo: "Sesión requerida", texto: "Inicia sesión para ver tus viajes." }));
      return nodo;
    }

    const cabecera = crear("div", { class: "seccion__cabecera" });
    cabecera.innerHTML = `
      <div class="seccion__titulo">
        <p class="kicker">Tu archivo</p>
        <h1>Mis viajes</h1>
      </div>
    `;

    const botonNuevo = crear("a", {
      class: "boton boton--acento",
      html: `<svg class="boton__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONOS.mas}</svg><span>Nuevo viaje</span>`,
      attrs: { href: "#/viaje/nuevo" },
    });
    cabecera.append(botonNuevo);
    nodo.append(cabecera);

    const contenedor = crear("div", { id: "lista-viajes" });
    nodo.append(contenedor);

    await pintar(contenedor, userId);

    return nodo;
  },
};

async function pintar(contenedor, userId) {
  vaciar(contenedor);

  const cargando = crear("div", { class: "rejilla rejilla--viajes" });
  for (let i = 0; i < 3; i += 1) {
    cargando.append(
      crear("div", {
        class: "esqueleto",
        style: { height: "320px", borderRadius: "var(--radio)" },
      }),
    );
  }
  contenedor.append(cargando);

  try {
    const [viajes, etapasTotales] = await Promise.all([
      listarViajes(userId),
      contarEtapasPorViaje(userId),
    ]);

    vaciar(contenedor);

    if (!viajes.length) {
      contenedor.append(
        estadoVacio({
          icono: ICONOS.mapa,
          titulo: "Todavía no hay ningún viaje",
          texto:
            "Crea tu primer viaje: un título, un destino y una portada. Después podrás añadir tantas etapas como quieras.",
          accion: crear("a", {
            class: "boton boton--acento boton--grande",
            text: "Crear mi primer viaje",
            attrs: { href: "#/viaje/nuevo" },
          }),
        }),
      );
      return;
    }

    const rejilla = crear("div", { class: "rejilla rejilla--viajes" });
    for (const viaje of viajes) {
      rejilla.append(tarjetaViaje(viaje, etapasTotales.get(viaje.id) ?? 0));
    }
    contenedor.append(rejilla);
  } catch (error) {
    vaciar(contenedor);
    const aviso = crear("div", { class: "aviso aviso--error" });
    aviso.textContent = `No se pudieron cargar tus viajes: ${error.message}`;
    contenedor.append(aviso);
  }
}

async function contarEtapasPorViaje(userId) {
  const supabase = exigirSupabase();
  const { data } = await supabase
    .from("etapas")
    .select("viaje_id")
    .eq("user_id", userId);
  const mapa = new Map();
  for (const fila of data ?? []) {
    mapa.set(fila.viaje_id, (mapa.get(fila.viaje_id) ?? 0) + 1);
  }
  return mapa;
}

function tarjetaViaje(viaje, numeroEtapas) {
  const tarjeta = crear("article", { class: "viaje-tarjeta" });

  const portada = crear("div", { class: "viaje-tarjeta__portada" });
  if (viaje.portada_url) {
    portada.append(
      crear("img", {
        src: viaje.portada_url,
        alt: `Portada de ${viaje.titulo}`,
        loading: "lazy",
        decoding: "async",
      }),
    );
  } else {
    const marcador = crear("div", { class: "viaje-tarjeta__sin-portada" });
    marcador.textContent = (viaje.titulo || "·").charAt(0).toUpperCase();
    portada.append(marcador);
  }
  tarjeta.append(portada);

  const cuerpo = crear("div", { class: "viaje-tarjeta__cuerpo" });
  if (viaje.destino) {
    cuerpo.append(crear("span", { class: "viaje-tarjeta__destino", text: viaje.destino }));
  }

  const titulo = crear("h2", { class: "viaje-tarjeta__titulo" });
  titulo.append(crear("a", { text: viaje.titulo || "Viaje sin título", attrs: { href: `#/viaje/${viaje.id}` } }));
  cuerpo.append(titulo);

  if (viaje.descripcion) {
    cuerpo.append(
      crear("p", {
        class: "viaje-tarjeta__resumen",
        text: viaje.descripcion.length > 130 ? `${viaje.descripcion.slice(0, 130)}…` : viaje.descripcion,
      }),
    );
  }

  const meta = crear("div", { class: "viaje-tarjeta__meta" });
  meta.append(crear("span", { text: rangoFechas(viaje.fecha_inicio, viaje.fecha_fin) }));
  meta.append(
    crear("span", {
      text: `${numeroEtapas} ${numeroEtapas === 1 ? "etapa" : "etapas"}`,
    }),
  );
  meta.append(crear("span", { text: haceCuanto(viaje.actualizado_en ?? viaje.creado_en) }));
  cuerpo.append(meta);

  tarjeta.append(cuerpo);

  const acciones = crear("div", { class: "viaje-tarjeta__acciones" });
  acciones.append(
    botonIcono(
      ICONOS.lapiz,
      `Editar ${viaje.titulo || "viaje"}`,
      () => navegar(`/viaje/${viaje.id}/editar`),
    ),
    botonIcono(
      ICONOS.papelera,
      `Eliminar ${viaje.titulo || "viaje"}`,
      async () => {
        const ok = await confirmar({
          titulo: "Eliminar el viaje",
          texto: `Se borrarán «${viaje.titulo || "este viaje"}», sus etapas, sus fotografías y sus rutas GPX. Esta acción no se puede deshacer.`,
          textoConfirmar: "Eliminar para siempre",
          peligro: true,
        });
        if (!ok) return;

        try {
          await eliminarViaje(viaje.id, userIdDel(viaje));
          notificar("Viaje eliminado.", "exito");
          const contenedor = document.getElementById("lista-viajes");
          if (contenedor) await pintar(contenedor, userIdDel(viaje));
        } catch (error) {
          notificar(error.message, "error", 6000);
        }
      },
      "boton boton--peligro-contorno boton--pequeno",
    ),
  );
  tarjeta.append(acciones);

  return tarjeta;
}

/** El user_id del viaje es la referencia para las operaciones. */
function userIdDel(viaje) {
  return viaje.user_id;
}
