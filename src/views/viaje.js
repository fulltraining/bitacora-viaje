/* ============================================================
   Bitácora de Viaje · views/viaje.js
   Detalle de un viaje: portada, etapas, fotografías y mapa.
   ============================================================ */

import { crear, vaciar } from "../lib/dom.js";
import { ICONOS, estadoVacio } from "./_comunes.js";
import { obtenerViaje, eliminarViaje } from "../store/viajes.js";
import { listarEtapas } from "../store/etapas.js";
import { exigirSupabase } from "../lib/supabase.js";
import { navegar } from "../lib/enrutador.js";
import { confirmar, notificar, botonIcono, abrirVisor } from "../lib/ui.js";
import { rangoFechas, fecha, distancia, ascension, duracion, numero } from "../lib/formato.js";
import { crearMapa, dibujarPerfilElevacion, COLOR_ETAPA } from "../lib/mapa.js";
import { perfilDesdeGeojson } from "../lib/gpx.js";

export default {
  titulo: "Viaje",

  async render({ params, sesion }) {
    const userId = sesion.usuario?.id;
    const viajeId = params.id;
    const nodo = crear("div", { class: "pagina-viaje" });

    if (!userId || !viajeId) {
      nodo.append(estadoVacio({ titulo: "Viaje no encontrado", texto: "No hemos podido localizar el viaje." }));
      return nodo;
    }

    const viaje = await obtenerViaje(viajeId, userId);
    if (!viaje) {
      nodo.append(
        estadoVacio({
          titulo: "Viaje no encontrado",
          texto: "Es posible que se haya eliminado o que no sea tuyo.",
          accion: crear("a", {
            class: "boton boton--principal",
            text: "Volver a mis viajes",
            attrs: { href: "#/viajes" },
          }),
        }),
      );
      return nodo;
    }

    const [etapas, fotosPorEtapa] = await Promise.all([
      listarEtapas(viajeId, userId),
      cargarFotos(viajeId, userId),
    ]);

    /* ---------- Portada ---------- */
    const portada = crear("section", { class: "viaje-portada" });

    if (viaje.portada_url) {
      portada.append(
        crear("img", {
          class: "viaje-portada__imagen",
          src: viaje.portada_url,
          alt: `Portada de ${viaje.titulo}`,
        }),
      );
      portada.append(crear("div", { class: "viaje-portada__velo" }));
    } else {
      portada.classList.add("viaje-portada--sin-imagen");
    }

    const bloque = crear("div", { class: "viaje-portada__bloque envoltorio" });

    const migas = crear("nav", { class: "migas", attrs: { "aria-label": "Ruta de navegación" } });
    migas.innerHTML = `
      <a href="#/viajes">Mis viajes</a>
      <span aria-hidden="true">/</span>
      <span aria-current="page">${escaparTexto(viaje.titulo || "Viaje")}</span>
    `;
    bloque.append(migas);

    if (viaje.destino) {
      bloque.append(crear("p", { class: "kicker", text: viaje.destino }));
    }
    bloque.append(crear("h1", { class: "viaje-portada__titulo", text: viaje.titulo || "Viaje sin título" }));

    const datos = crear("div", { class: "viaje-portada__datos" });
    datos.append(crear("span", { text: rangoFechas(viaje.fecha_inicio, viaje.fecha_fin) }));
    datos.append(
      crear("span", {
        text: `${numero(etapas.length)} ${etapas.length === 1 ? "etapa" : "etapas"}`,
      }),
    );
    datos.append(
      crear("span", {
        text: `${numero(totalFotos(fotosPorEtapa))} fotografías`,
      }),
    );
    bloque.append(datos);

    if (viaje.descripcion) {
      const descripcion = crear("p", { class: "parrafo-editorial viaje-portada__descripcion" });
      descripcion.textContent = viaje.descripcion;
      bloque.append(descripcion);
    }

    const acciones = crear("div", { class: "viaje-portada__acciones" });
    acciones.append(
      crear("a", {
        class: "boton boton--acento",
        html: `<svg class="boton__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONOS.mas}</svg><span>Añadir etapa</span>`,
        attrs: { href: `#/viaje/${viaje.id}/etapa/nueva` },
      }),
      botonIcono(ICONOS.lapiz, "Editar viaje", () => navegar(`/viaje/${viaje.id}/editar`)),
      botonIcono(
        ICONOS.papelera,
        "Eliminar viaje",
        async () => {
          const ok = await confirmar({
            titulo: "Eliminar el viaje",
            texto: `Se borrarán «${viaje.titulo || "este viaje"}», sus etapas, sus fotografías y sus rutas GPX. Esta acción no se puede deshacer.`,
            textoConfirmar: "Eliminar para siempre",
            peligro: true,
          });
          if (!ok) return;
          try {
            await eliminarViaje(viaje.id, userId);
            notificar("Viaje eliminado.", "exito");
            navegar("/viajes");
          } catch (error) {
            notificar(error.message, "error", 6000);
          }
        },
        "boton boton--peligro-contorno boton--pequeno",
      ),
    );
    bloque.append(acciones);

    portada.append(bloque);
    nodo.append(portada);

    /* ---------- Etapas ---------- */
    const seccionEtapas = crear("section", { class: "seccion envoltorio" });
    seccionEtapas.append(
      crear("div", {
        class: "seccion__cabecera",
        html: `
          <div class="seccion__titulo">
            <p class="kicker">Diario</p>
            <h2>Etapas del viaje</h2>
          </div>
          <span class="regla"></span>
        `,
      }),
    );

    if (!etapas.length) {
      seccionEtapas.append(
        estadoVacio({
          icono: ICONOS.texto,
          titulo: "Este viaje todavía no tiene etapas",
          texto:
            "Las etapas son los capítulos de tu bitácora: un día, un tramo de ruta, un texto y sus fotografías.",
          accion: crear("a", {
            class: "boton boton--principal",
            text: "Crear la primera etapa",
            attrs: { href: `#/viaje/${viaje.id}/etapa/nueva` },
          }),
        }),
      );
    } else {
      const lista = crear("div", { class: "etapas" });
      for (const etapa of etapas) {
        lista.append(tarjetaEtapa(etapa, fotosPorEtapa.get(etapa.id) ?? []));
      }
      seccionEtapas.append(lista);
    }

    nodo.append(seccionEtapas);

    /* ---------- Mapa ---------- */
    const conRuta = etapas.filter((e) => e.puntos_gpx);
    if (conRuta.length) {
      nodo.append(seccionMapa(viaje, conRuta));
    }

    return nodo;
  },
};

function escaparTexto(valor) {
  const div = document.createElement("div");
  div.textContent = valor;
  return div.innerHTML;
}

async function cargarFotos(viajeId, userId) {
  const supabase = exigirSupabase();
  const { data } = await supabase
    .from("fotografias")
    .select("id,etapa_id,url,pie,orden")
    .eq("viaje_id", viajeId)
    .eq("user_id", userId)
    .order("orden", { ascending: true });

  const mapa = new Map();
  for (const foto of data ?? []) {
    if (!mapa.has(foto.etapa_id)) mapa.set(foto.etapa_id, []);
    mapa.get(foto.etapa_id).push(foto);
  }
  return mapa;
}

function totalFotos(mapa) {
  let total = 0;
  for (const lista of mapa.values()) total += lista.length;
  return total;
}

/* ---------------- Tarjeta de etapa ---------------- */

function tarjetaEtapa(etapa, fotos) {
  const tarjeta = crear("article", { class: "etapa" });

  const cabecera = crear("div", { class: "etapa__cabecera" });

  const numero_ = crear("div", { class: "etapa__numero" });
  numero_.textContent = String(etapa.numero ?? 1).padStart(2, "0");
  cabecera.append(numero_);

  const titulos = crear("div", { class: "etapa__titulos" });
  titulos.append(
    crear("h3", { class: "etapa__titulo", text: etapa.titulo || `Etapa ${etapa.numero ?? 1}` }),
  );

  const subtitulo = crear("p", { class: "etapa__subtitulo" });
  const partes = [];
  if (etapa.fecha) partes.push(fecha(etapa.fecha));
  if (etapa.salida || etapa.llegada) {
    partes.push(`${etapa.salida || "?"} → ${etapa.llegada || "?"}`);
  }
  subtitulo.textContent = partes.join("  ·  ");
  titulos.append(subtitulo);
  cabecera.append(titulos);

  const insignias = crear("div", { class: "etapa__insignias" });
  if (etapa.distancia_m) {
    insignias.append(
      crear("span", { class: "distintivo distintivo--verde", text: distancia(etapa.distancia_m) }),
    );
  }
  if (etapa.ascenso_m) {
    insignias.append(crear("span", { class: "distintivo", text: ascension(etapa.ascenso_m) }));
  }
  if (etapa.gpx_path) {
    insignias.append(
      crear("span", {
        class: "distintivo distintivo--terracota",
        html: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONOS.gpx}</svg> GPX`,
      }),
    );
  }
  if (fotos.length) {
    insignias.append(
      crear("span", {
        class: "distintivo distintivo--neutro",
        html: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round">${ICONOS.foto}</svg> ${fotos.length}`,
      }),
    );
  }
  cabecera.append(insignias);
  tarjeta.append(cabecera);

  if (etapa.diario) {
    const diario = crear("p", { class: "etapa__diario" });
    diario.textContent = etapa.diario.length > 320 ? `${etapa.diario.slice(0, 320)}…` : etapa.diario;
    tarjeta.append(diario);
  }

  if (fotos.length) {
    const tira = crear("div", { class: "etapa__tira" });
    fotos.slice(0, 5).forEach((foto, indice) => {
      const miniatura = crear("button", {
        class: "miniatura",
        attrs: { type: "button", "aria-label": `Ampliar fotografía ${indice + 1}` },
        on: {
          click: () =>
            abrirVisor(
              fotos.map((f) => ({ url: f.url, pie: f.pie })),
              indice,
            ),
        },
      });
      miniatura.append(crear("img", { src: foto.url, alt: foto.pie || "", loading: "lazy" }));
      if (fotos.length > 5) {
        const mas = crear("span", { class: "miniatura__mas", text: `+${fotos.length - 5}` });
        if (indice === 4) miniatura.append(mas);
      }
      tira.append(miniatura);
    });
    tarjeta.append(tira);
  }

  const pie = crear("div", { class: "etapa__pie" });
  pie.append(
    crear("a", {
      class: "enlace-sutil enlace-sutil--verde",
      text: "Abrir etapa",
      attrs: { href: `#/viaje/${etapa.viaje_id}/etapa/${etapa.id}` },
    }),
    crear("a", {
      class: "enlace-sutil",
      text: "Editar",
      attrs: { href: `#/viaje/${etapa.viaje_id}/etapa/${etapa.id}/editar` },
    }),
  );
  tarjeta.append(pie);

  return tarjeta;
}

/* ---------------- Sección de mapa ---------------- */

function seccionMapa(viaje, etapas) {
  const seccion = crear("section", { class: "seccion envoltorio" });
  seccion.append(
    crear("div", {
      class: "seccion__cabecera",
      html: `
        <div class="seccion__titulo">
          <p class="kicker">Cartografía</p>
          <h2>El recorrido sobre el mapa</h2>
        </div>
        <span class="regla"></span>
      `,
    }),
  );

  const panel = crear("div", { class: "panel-mapa" });
  /* Selector de etapas */
  const selector = crear("div", { class: "selector-etapas", attrs: { role: "tablist" } });
  const botones = [];

  etapas.forEach((etapa, indice) => {
    const boton = crear("button", {
      type: "button",
      class: "selector-etapas__boton",
      text: `Etapa ${etapa.numero}`,
      attrs: { role: "tab", "aria-selected": indice === 0 ? "true" : "false" },
    });
    botones.push(boton);
    selector.append(boton);
  });

  const botonTodas = crear("button", {
    type: "button",
    class: "selector-etapas__boton selector-etapas__boton--total",
    text: "Todas",
    attrs: { role: "tab", "aria-selected": "false" },
  });
  selector.append(botonTodas);
  botones.push(botonTodas);

  panel.append(selector);

  /* Mapa */
  const contenedorMapa = crear("div", { class: "panel-mapa__mapa" });
  panel.append(contenedorMapa);

  /* Estadísticas */
  const estadisticas = crear("div", { class: "panel-mapa__datos" });
  panel.append(estadisticas);

  /* Perfil de elevación */
  const perfil = crear("div", { class: "panel-mapa__perfil" });
  panel.append(perfil);

  seccion.append(panel);

  // Se dibuja tras insertar en el DOM para que Leaflet mida el contenedor.
  let componente = null;
  setTimeout(() => {
    componente = crearMapa(contenedorMapa);

    const pintarSeleccion = (indice) => {
      componente.limpiar();
      vaciar(estadisticas);
      vaciar(perfil);

      const todas = indice === etapas.length;
      const seleccion = todas ? etapas : [etapas[indice]];

      let distanciaTotal = 0;
      let ascensoTotal = 0;
      let limites = null;

      for (const etapa of seleccion) {
        const geojson = etapa.puntos_gpx;
        if (!geojson?.features?.length) continue;

        const capa = componente.dibujarRuta(geojson, {
          color: todas ? "#1e3b2f" : COLOR_ETAPA,
          peso: todas ? 3.4 : 4.4,
          opacidad: todas ? 0.85 : 1,
        });

        if (todas) {
          for (const feature of geojson.features) {
            const coords = feature.geometry?.coordinates ?? [];
            if (coords.length >= 2) {
              componente.dibujarExtremos(
                { lat: coords[0][1], lon: coords[0][0] },
                { lat: coords[coords.length - 1][1], lon: coords[coords.length - 1][0] },
              );
            }
          }
        } else {
          const feature = geojson.features[0];
          const coords = feature?.geometry?.coordinates ?? [];
          if (coords.length >= 2) {
            componente.dibujarExtremos(
              { lat: coords[0][1], lon: coords[0][0] },
              { lat: coords[coords.length - 1][1], lon: coords[coords.length - 1][0] },
            );
          }
        }

        distanciaTotal += Number(etapa.distancia_m ?? 0);
        ascensoTotal += Number(etapa.ascenso_m ?? 0);

        const geo = geojson.features.flatMap((f) =>
          (f.geometry?.coordinates ?? []).map((c) => ({ lat: c[1], lon: c[0] })),
        );
        if (geo.length) {
          const l = limitesDe(geo);
          if (!limites) limites = l;
          else limites = [
            [Math.min(limites[0][0], l[0][0]), Math.min(limites[0][1], l[0][1])],
            [Math.max(limites[1][0], l[1][0]), Math.max(limites[1][1], l[1][1])],
          ];
        }
      }

      if (limites) componente.ajustar(limites);

      // Datos
      const definiciones = [
        ["Distancia", distancia(distanciaTotal)],
        ["Ascenso", ascensoTotal ? ascension(ascensoTotal) : "—"],
      ];
      const etapasSel = seleccion[0];
      if (!todas && etapasSel?.duracion_s) {
        definiciones.push(["Duración", duracion(etapasSel.duracion_s)]);
      }
      definiciones.push(["Etapas", todas ? String(etapas.length) : "1"]);

      for (const [etiqueta, valor] of definiciones) {
        const bloque = crear("div", { class: "dato" });
        bloque.append(crear("span", { class: "dato__etiqueta", text: etiqueta }));
        bloque.append(crear("strong", { class: "dato__valor", text: valor }));
        estadisticas.append(bloque);
      }

      // Perfil de elevación
      if (!todas && etapasSel?.puntos_gpx) {
        const datosPerfil = perfilDesdeGeojson(etapasSel.puntos_gpx);
        if (datosPerfil.length) {
          perfil.append(
            crear("h4", {
              class: "panel-mapa__perfil-titulo",
              text: `Perfil de elevación · Etapa ${etapasSel.numero}`,
            }),
          );
          dibujarPerfilElevacion(perfil, datosPerfil, { altura: 200 });
        } else {
          perfil.append(
            crear("p", {
              class: "texto-pequeno texto-suave",
              text: "Este archivo GPX no incluye datos de altitud.",
            }),
          );
        }
      } else if (todas) {
        perfil.append(
          crear("p", {
            class: "texto-pequeno texto-suave",
            text: "Selecciona una etapa para ver su perfil de elevación detallado.",
          }),
        );
      }

      botones.forEach((b, i) =>
        b.setAttribute("aria-selected", i === indice ? "true" : "false"),
      );
    };

    botones.forEach((boton, indice) => {
      boton.addEventListener("click", () => pintarSeleccion(indice));
    });

    pintarSeleccion(0);
    componente.invalidar();
  }, 0);

  seccion.alSalir = () => componente?.destruir();

  return seccion;
}

function limitesDe(puntos) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of puntos) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}
