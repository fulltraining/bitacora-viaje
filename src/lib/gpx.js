/* ============================================================
   Bitácora de Viaje · lib/gpx.js
   Lectura, validación y análisis de archivos GPX.
   ============================================================ */

import { gpx } from "@tmcw/togeojson";
import { metricas, limites, coordenadasValidas } from "./geo.js";

/**
 * Analiza el contenido de un archivo GPX.
 * @param {string|ArrayBuffer|Document} contenido
 * @returns {object} datos del recorrido
 * @throws {Error} con mensaje en español si el archivo no es válido
 */
export function analizarGpx(contenido) {
  let texto = "";
  if (typeof contenido === "string") {
    texto = contenido;
  } else if (contenido instanceof ArrayBuffer) {
    texto = new TextDecoder("utf-8").decode(contenido);
  } else if (typeof contenido === "object" && contenido !== null) {
    // Si ya es un Document/Element, serializamos
    try {
      if (contenido.nodeType) {
        texto = new XMLSerializer().serializeToString(contenido);
      }
    } catch {
      texto = "";
    }
  }

  if (!texto || !texto.trim()) {
    throw new Error("El archivo GPX está vacío.");
  }
  if (!/<gpx[\s>]/i.test(texto)) {
    throw new Error("El archivo no es un GPX válido (falta el elemento <gpx>).");
  }

  let doc = null;
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      doc = parser.parseFromString(texto, "text/xml");
      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        throw new Error("Error de parseo XML");
      }
    } catch (error) {
      throw new Error("El archivo GPX no es XML válido o está mal formado.");
    }
  }

  let coleccion;
  try {
    if (doc) {
      coleccion = gpx(doc);
    } else {
      coleccion = gpx(texto);
    }
  } catch (error) {
    throw new Error(`No se ha podido interpretar el GPX: ${error.message}`);
  }

  const segmentos = [];
  const puntos = [];
  const waypoints = [];

  for (const feature of coleccion.features ?? []) {
    const geometria = feature.geometry;
    if (!geometria) continue;

    if (geometria.type === "LineString") {
      const linea = aPuntos(geometria.coordinates ?? [], feature.properties?.coordTimes);
      if (linea.length) {
        segmentos.push(linea);
        puntos.push(...linea);
      }
    } else if (geometria.type === "MultiLineString") {
      for (const coords of geometria.coordinates ?? []) {
        const linea = aPuntos(coords, feature.properties?.coordTimes);
        if (linea.length) {
          segmentos.push(linea);
          puntos.push(...linea);
        }
      }
    } else if (geometria.type === "Point") {
      const [lon, lat, alt] = geometria.coordinates ?? [];
      if (coordenadasValidas(lat, lon)) {
        waypoints.push({
          lat: Number(lat),
          lon: Number(lon),
          alt: Number.isFinite(Number(alt)) ? Number(alt) : null,
          nombre: feature.properties?.name ?? "",
          descripcion: feature.properties?.desc ?? "",
          tiempo: feature.properties?.time ?? null,
        });
      }
    }
  }

  if (!puntos.length) {
    if (waypoints.length) {
      throw new Error(
        "El GPX solo contiene puntos de paso, no una traza de ruta. Necesita puntos <trkpt>.",
      );
    }
    throw new Error("El GPX no contiene coordenadas de ruta.");
  }

  const medidas = metricas(puntos);
  const conAltitud = puntos.some((p) => Number.isFinite(p.alt));

  return {
    puntos,
    segmentos,
    waypoints,
    geojson: aGeojson(segmentos),
    distancia: medidas.distancia,
    ascenso: medidas.ascenso,
    descenso: medidas.descenso,
    conAltitud,
    duracion: duracionDe(segmentos),
    limites: limites(puntos),
    inicio: puntos[0],
    fin: puntos[puntos.length - 1],
    perfil: conAltitud ? perfilElevacion(puntos) : [],
  };
}

/** Convierte coordenadas GeoJSON en puntos con altitud y tiempo. */
function aPuntos(coords, coordTimes) {
  const salida = [];
  coords.forEach((c, i) => {
    const lon = Number(c[0]);
    const lat = Number(c[1]);
    if (!coordenadasValidas(lat, lon)) return;
    const alt = Number(c[2]);
    salida.push({
      lat,
      lon,
      alt: Number.isFinite(alt) ? alt : null,
      tiempo: Array.isArray(coordTimes) ? (coordTimes[i] ?? null) : null,
    });
  });
  return salida;
}

/** Construye un FeatureCollection con una línea por segmento. */
function aGeojson(segmentos) {
  return {
    type: "FeatureCollection",
    features: segmentos
      .filter((s) => s.length >= 2)
      .map((s, i) => ({
        type: "Feature",
        properties: { orden: i + 1 },
        geometry: {
          type: "LineString",
          coordinates: s.map((p) => {
            if (Number.isFinite(p.alt)) {
              return [p.lon, p.lat, p.alt];
            }
            return [p.lon, p.lat];
          }),
        },
      })),
  };
}

/** Duración total en segundos a partir de las marcas de tiempo. */
function duracionDe(segmentos) {
  let primero = null;
  let ultimo = null;

  for (const segmento of segmentos) {
    for (const punto of segmento) {
      if (!punto.tiempo) continue;
      const t = new Date(punto.tiempo).getTime();
      if (!Number.isFinite(t)) continue;
      if (primero === null || t < primero) primero = t;
      if (ultimo === null || t > ultimo) ultimo = t;
    }
  }

  if (primero === null || ultimo === null) return null;
  const segundos = Math.round((ultimo - primero) / 1000);
  return segundos > 0 ? segundos : null;
}

/**
 * Perfil de elevación: distancia acumulada y altitud en cada punto.
 * @returns {Array<{distancia:number, altitud:number, lat:number, lon:number}>}
 */
export function perfilElevacion(puntos) {
  const perfil = [];
  let acumulada = 0;
  let anterior = null;

  for (const punto of puntos) {
    if (!coordenadasValidas(punto.lat, punto.lon)) continue;

    if (anterior) {
      const dLat = ((punto.lat - anterior.lat) * Math.PI) / 180;
      const dLon = ((punto.lon - anterior.lon) * Math.PI) / 180;
      const lat1 = (anterior.lat * Math.PI) / 180;
      const lat2 = (punto.lat * Math.PI) / 180;
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      acumulada += 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    perfil.push({
      distancia: acumulada,
      altitud: Number.isFinite(punto.alt) ? punto.alt : 0,
      lat: punto.lat,
      lon: punto.lon,
    });

    anterior = punto;
  }

  return perfil;
}

/**
 * Recupera el perfil de elevación a partir del GeoJSON guardado.
 * @param {{features:Array}} geojson
 * @returns {Array<{distancia:number, altitud:number}>}
 */
export function perfilDesdeGeojson(geojson) {
  const puntos = [];

  for (const feature of geojson?.features ?? []) {
    const coords = feature.geometry?.coordinates ?? [];
    for (const c of coords) {
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      if (!coordenadasValidas(lat, lon)) continue;
      const alt = Number(c[2]);
      puntos.push({ lat, lon, alt: Number.isFinite(alt) ? alt : null });
    }
  }

  if (!puntos.some((p) => p.alt !== null && p.alt !== undefined)) return [];

  return perfilElevacion(puntos);
}

/**
 * Recorta el perfil para no dibujar miles de puntos: conserva los extremos
 * y los máximos y mínimos locales.
 */
export function simplificarPerfil(perfil, maximo = 600) {
  if (!perfil || perfil.length <= maximo) return perfil ?? [];

  const paso = Math.ceil(perfil.length / maximo);
  const salida = [];

  for (let i = 0; i < perfil.length; i += paso) {
    salida.push(perfil[i]);
  }

  const ultimo = perfil[perfil.length - 1];
  if (salida[salida.length - 1] !== ultimo) salida.push(ultimo);

  return salida;
}
