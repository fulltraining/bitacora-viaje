/* ============================================================
   Bitácora de Viaje · lib/geo.js
   Cálculos geodésicos y utilidades deLeaflet.
   ============================================================ */

const RADIO_TIERRA = 6371008.8; // metros
const GRADO = Math.PI / 180;

/**
 * Distancia entre dos puntos (haversine).
 * @param {{lat:number,lon:number}} a
 * @param {{lat:number,lon:number}} b
 * @returns {number} metros
 */
export function distanciaMetros(a, b) {
  if (!a || !b) return 0;
  const dLat = (b.lat - a.lat) * GRADO;
  const dLon = (b.lon - a.lon) * GRADO;
  const lat1 = a.lat * GRADO;
  const lat2 = b.lat * GRADO;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * RADIO_TIERRA * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** ¿Son válidas las coordenadas? */
export function coordenadasValidas(lat, lon) {
  const a = Number(lat);
  const b = Number(lon);
  return (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    a >= -90 &&
    a <= 90 &&
    b >= -180 &&
    b <= 180 &&
    !(a === 0 && b === 0)
  );
}

/** Redondea coordenadas a 6 decimales (~11 cm) para guardar. */
export function redondear(valor, decimales = 6) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** decimales;
  return Math.round(n * factor) / factor;
}

/**
 * Calcula los límites geográficos de una lista de puntos.
 * @returns {[[number,number],[number,number]]|null} [sur, oeste], [norte, este]
 */
export function limites(puntos) {
  if (!puntos?.length) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const p of puntos) {
    if (!coordenadasValidas(p.lat, p.lon)) continue;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }

  if (!Number.isFinite(minLat)) return null;
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}

/** Punto medio aproximado del recorrido. */
export function centro(puntos) {
  if (!puntos?.length) return null;
  let sumaLat = 0;
  let sumaLon = 0;
  let n = 0;
  for (const p of puntos) {
    if (!coordenadasValidas(p.lat, p.lon)) continue;
    sumaLat += p.lat;
    sumaLon += p.lon;
    n += 1;
  }
  if (!n) return null;
  return [sumaLat / n, sumaLon / n];
}

/**
 * Distancia acumulada y desnivel de una secuencia de puntos.
 * @param {Array<{lat:number,lon:number,alt?:number,tiempo?:string}>} puntos
 */
export function metricas(puntos) {
  const resultado = {
    distancia: 0,
    ascenso: 0,
    descenso: 0,
    puntos: puntos?.length ?? 0,
  };

  if (!puntos?.length) return resultado;

  let anterior = null;
  let altitudAnterior = null;

  for (const punto of puntos) {
    if (!coordenadasValidas(punto.lat, punto.lon)) {
      anterior = punto;
      continue;
    }

    if (anterior) {
      const tramo = distanciaMetros(
        { lat: anterior.lat, lon: anterior.lon },
        { lat: punto.lat, lon: punto.lon },
      );
      // Descarta saltos absurdos (>500 km) por errores de GPS
      if (tramo < 500_000) resultado.distancia += tramo;
    }

    const alt = Number(punto.alt);
    if (Number.isFinite(alt)) {
      if (altitudAnterior !== null) {
        const delta = alt - altitudAnterior;
        if (delta > 0) resultado.ascenso += delta;
        else resultado.descenso += Math.abs(delta);
      }
      altitudAnterior = alt;
    }

    anterior = punto;
  }

  return resultado;
}

/** Formatea coordenadas en grados/minutos para mostrar. */
export function grados(coord) {
  if (!coord) return "—";
  const lat = Number(coord.lat ?? coord[0]);
  const lon = Number(coord.lon ?? coord[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "—";
  const ns = lat >= 0 ? "N" : "S";
  const eo = lon >= 0 ? "E" : "O";
  return `${Math.abs(lat).toFixed(5)}° ${ns}, ${Math.abs(lon).toFixed(5)}° ${eo}`;
}
