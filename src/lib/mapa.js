/* ============================================================
   Bitácora de Viaje · lib/mapa.js
   Componente de mapa (Leaflet + OpenStreetMap) y perfil de elevación.
   ============================================================ */

import L from "leaflet";
import { simplificarPerfil } from "./gpx.js";

export const COLOR_ETAPA = "#b75d38";
export const COLOR_VIAJE = "#1e3b2f";

/**
 * Crea un mapa Leaflet con teselas de OpenStreetMap.
 * @param {HTMLElement} elemento
 * @param {{zoom?:number, interaccion?:boolean}} [opciones]
 */
export function crearMapa(elemento, opciones = {}) {
  const mapa = L.map(elemento, {
    zoomControl: opciones.interaccion !== false,
    attributionControl: true,
    scrollWheelZoom: false,
    tap: false,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    minZoom: 2,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  // El zoom con rueda se activa solo al pulsar el mapa (mejor en móviles).
  mapa.on("click", () => mapa.scrollWheelZoom.enable());
  mapa.on("mouseout", () => mapa.scrollWheelZoom.disable());

  const capas = L.layerGroup().addTo(mapa);

  return {
    mapa,
    capas,

    /** Dibuja un conjunto de líneas GeoJSON. */
    dibujarRuta(geojson, { color = COLOR_ETAPA, peso = 4, opacidad = 0.95 } = {}) {
      const grupo = L.layerGroup();
      for (const feature of geojson?.features ?? []) {
        const coords = feature.geometry?.coordinates ?? [];
        if (coords.length < 2) continue;
        L.polyline(coords, {
          color,
          weight: peso,
          opacity: opacidad,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(grupo);
      }
      grupo.addTo(capas);
      return grupo;
    },

    /** Marcador de inicio (verde) y de fin (terracota). */
    dibujarExtremos(inicio, fin) {
      const grupo = L.layerGroup();
      if (inicio) grupo.addChild(marcador("inicio", inicio, "Inicio"));
      if (fin) grupo.addChild(marcador("fin", fin, "Fin"));
      grupo.addTo(capas);
      return grupo;
    },

    /**
     * Marcadores de las grabaciones sonoras con ubicación.
     * @param {Array<{id:string, lat:number, lon:number, titulo?:string}>} audios
     * @param {{alPulsar?:Function}} [opciones]
     */
    dibujarAudios(audios, { alPulsar } = {}) {
      const grupo = L.layerGroup();

      for (const audio of audios ?? []) {
        const lat = Number(audio?.lat);
        const lon = Number(audio?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const icono = L.divIcon({
          className: "marcador-audio",
          html: `<span class="marcador-audio__globo">
                   <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                     <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z"/>
                     <path d="M19 11a7 7 0 0 1-14 0M12 18v3M8.5 21h7"/>
                   </svg>
                 </span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        const marca = L.marker([lat, lon], {
          icon: icono,
          title: audio.titulo ?? "Grabación",
          alt: audio.titulo ?? "Grabación de audio",
        });

        marca.bindTooltip(audio.titulo ?? "Grabación", {
          direction: "top",
          offset: [0, -12],
        });

        if (alPulsar) marca.on("click", () => alPulsar(audio));

        grupo.addChild(marca);
      }

      grupo.addTo(capas);
      return grupo;
    },

    /**
     * Marcadores temporales para colocar un audio en el mapa.
     * @param {{lat:number, lon:number}} punto
     */
    dibujarMarcadorTemporal(punto) {
      const grupo = L.layerGroup();
      const icono = L.divIcon({
        className: "marcador-audio marcador-audio--temporal",
        html: `<span class="marcador-audio__globo">
                 <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z"/>
                   <path d="M19 11a7 7 0 0 1-14 0M12 18v3M8.5 21h7"/>
                 </svg>
               </span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([punto.lat, punto.lon], { icon: icono, keyboard: false }).addTo(grupo);
      grupo.addTo(capas);
      this._marcadorTemporal = grupo;
    },

    limpiarMarcadoresTemporales() {
      if (this._marcadorTemporal) {
        this._marcadorTemporal.remove();
        this._marcadorTemporal = null;
      }
    },

    /**
     * Registra un pulsador sobre el mapa (para colocar marcadores).
     * @returns {Function} función para quitar el pulsador
     */
    alPulsarMapa(manejador) {
      mapa.on("click", manejador);
      return () => mapa.off("click", manejador);
    },

    /** Ajusta el encuadre al conjunto de puntos indicado. */
    ajustar(limites, opciones = {}) {
      if (!limites) return;
      const [[sur, oeste], [norte, este]] = limites;
      const limitesLeaflet = L.latLngBounds(
        L.latLng(sur, oeste),
        L.latLng(norte, este),
      );
      if (!opciones.inmediato) {
        mapa.panInside(limitesLeaflet, { animate: true, duration: 0.4 });
      }
      mapa.fitBounds(limitesLeaflet, { padding: opciones.padding ?? [36, 36], animate: true });
    },

    /** Ajusta a una capa concreta. */
    ajustarCapa(capa, opciones = {}) {
      if (!capa || !capa.getBounds) return;
      mapa.fitBounds(capa.getBounds(), {
        padding: opciones.padding ?? [36, 36],
        animate: true,
      });
    },

    limpiar() {
      capas.clearLayers();
    },

    invalidar() {
      setTimeout(() => mapa.invalidateSize(), 120);
    },

    destruir() {
      try {
        mapa.remove();
      } catch {
        /* el mapa ya estaba destruido */
      }
    },
  };
}

/** Marcador circular con etiqueta. */
function marcador(tipo, punto, etiqueta) {
  const icono = L.divIcon({
    className: "marcador-mapa",
    html: `<span class="marcador-mapa__punto marcador-mapa__punto--${tipo}"></span>
           <span class="marcador-mapa__etiqueta">${etiqueta}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  return L.marker([punto.lat, punto.lon], {
    icon: icono,
    keyboard: false,
    title: etiqueta,
  });
}

/**
 * Dibuja un perfil de elevación en SVG.
 * @param {HTMLElement} contenedor
 * @param {Array<{distancia:number, altitud:number}>} perfil
 * @param {{altura?:number, color?:string}} [opciones]
 */
export function dibujarPerfilElevacion(contenedor, perfil, opciones = {}) {
  vaciar(contenedor);

  const puntos = simplificarPerfil(perfil ?? [], 420);
  if (puntos.length < 2) {
    const aviso = document.createElement("p");
    aviso.className = "texto-pequeno texto-suave";
    aviso.textContent = "El archivo no incluye datos de altitud.";
    contenedor.append(aviso);
    return;
  }

  const ancho = Math.max(containeredorAncho(contenedor), 320);
  const alto = opciones.altura ?? 190;
  const margen = { arriba: 14, derecha: 12, abajo: 26, izquierda: 44 };

  const anchoUtil = ancho - margen.izquierda - margen.derecha;
  const altoUtil = alto - margen.arriba - margen.abajo;

  const distanciaMax = puntos[puntos.length - 1].distancia || 1;
  const altitudes = puntos.map((p) => p.altitud);
  const min = Math.min(...altitudes);
  const max = Math.max(...altitudes);
  const rango = Math.max(max - min, 1);

  const escalaX = (d) => margen.izquierda + (d / distanciaMax) * anchoUtil;
  const escalaY = (a) => margen.arriba + altoUtil - ((a - min) / rango) * altoUtil;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);
  svg.setAttribute("class", "perfil");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Perfil de elevación del recorrido");

  const color = opciones.color ?? COLOR_ETAPA;

  // Relleno bajo la curva
  const area = document.createElementNS(ns, "path");
  const dArea = puntos
    .map((p, i) => `${i === 0 ? "M" : "L"}${escalaX(p.distancia).toFixed(1)},${escalaY(p.altitud).toFixed(1)}`)
    .join(" ");
  area.setAttribute("d", `${dArea} L${escalaX(distanciaMax).toFixed(1)},${(alto - margen.abajo).toFixed(1)} L${margen.izquierda},${(alto - margen.abajo).toFixed(1)} Z`);
  area.setAttribute("fill", color);
  area.setAttribute("opacity", "0.14");
  svg.append(area);

  // Curva
  const curva = document.createElementNS(ns, "path");
  curva.setAttribute("d", dArea);
  curva.setAttribute("fill", "none");
  curva.setAttribute("stroke", color);
  curva.setAttribute("stroke-width", "2.2");
  curva.setAttribute("stroke-linejoin", "round");
  curva.setAttribute("stroke-linecap", "round");
  svg.append(curva);

  // Rejilla horizontal con altitudes
  for (let i = 0; i <= 3; i += 1) {
    const valor = max - (rango * i) / 3;
    const y = escalaY(valor);
    const linea = document.createElementNS(ns, "line");
    linea.setAttribute("x1", String(margen.izquierda));
    linea.setAttribute("x2", String(ancho - margen.derecha));
    linea.setAttribute("y1", String(y));
    linea.setAttribute("y2", String(y));
    linea.setAttribute("stroke", "rgba(35,32,28,0.12)");
    linea.setAttribute("stroke-dasharray", "3 4");
    svg.append(linea);

    const texto = document.createElementNS(ns, "text");
    texto.setAttribute("x", String(margen.izquierda - 7));
    texto.setAttribute("y", String(y + 3.5));
    texto.setAttribute("text-anchor", "end");
    texto.setAttribute("class", "perfil__eje");
    texto.textContent = `${Math.round(valor)} m`;
    svg.append(texto);
  }

  // Eje de distancia
  for (let i = 0; i <= 4; i += 1) {
    const d = (distanciaMax * i) / 4;
    const x = escalaX(d);
    const texto = document.createElementNS(ns, "text");
    texto.setAttribute("x", String(x));
    texto.setAttribute("y", String(alto - 8));
    texto.setAttribute("text-anchor", i === 0 ? "start" : i === 4 ? "end" : "middle");
    texto.setAttribute("class", "perfil__eje");
    texto.textContent = `${(d / 1000).toFixed(d < 1000 ? 2 : 1)} km`;
    svg.append(texto);
  }

  contenedor.append(svg);
}

function vaciar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
}

function contenedorAncho(contenedor) {
  const ancho = contenedor.clientWidth || contenedor.getBoundingClientRect().width;
  return Math.round(ancho || 640);
}
