/* ============================================================
   Bitácora de Viaje · lib/enrutador.js
   Enrutador por hash (#/ruta). No requiere reglas de reescritura
   en el servidor: funciona en Termux, GitHub Pages o cualquier
   alojamiento estático.
   ============================================================ */

export const RUTAS = [
  { ruta: "/", vista: "inicio", titulo: "Bitácora de Viaje" },
  { ruta: "/registro", vista: "registro", titulo: "Crear cuenta" },
  { ruta: "/acceso", vista: "acceso", titulo: "Iniciar sesión" },
  { ruta: "/recuperar", vista: "recuperar", titulo: "Recuperar contraseña" },
  { ruta: "/restablecer", vista: "restablecer", titulo: "Nueva contraseña" },
  { ruta: "/viajes", vista: "viajes", titulo: "Mis viajes", requiereSesion: true },
  { ruta: "/viaje/nuevo", vista: "viaje-nuevo", titulo: "Crear viaje", requiereSesion: true },
  { ruta: "/viaje/:id/editar", vista: "viaje-editar", titulo: "Editar viaje", requiereSesion: true },
  { ruta: "/viaje/:id", vista: "viaje", titulo: "Viaje", requiereSesion: true },
  {
    ruta: "/viaje/:id/etapa/:etapaId",
    vista: "etapa",
    titulo: "Etapa",
    requiereSesion: true,
  },
  { ruta: "/perfil", vista: "perfil", titulo: "Mi perfil", requiereSesion: true },
  { ruta: "/ajustes", vista: "ajustes", titulo: "Configuración" },
];

let manejador = null;
let alCambiar = null;

/** Divide la ruta en segmentos no vacíos. */
function segmentos(ruta) {
  return String(ruta ?? "")
    .split("/")
    .filter(Boolean);
}

/**
 * Busca la definición de ruta que coincide con el camino dado.
 * @returns {{vista:string, params:object, titulo:string, requiereSesion:boolean}|null}
 */
export function resolverRuta(camino) {
  const partes = segmentos(camino);
  const consulta = partes.includes("") ? null : null;

  for (const definicion of RUTAS) {
    const patron = segmentos(definicion.ruta);
    if (patron.length !== partes.length) continue;

    const params = {};
    let coincide = true;

    for (let i = 0; i < patron.length; i += 1) {
      const esperado = patron[i];
      const actual = partes[i];
      if (esperado.startsWith(":")) {
        params[esperado.slice(1)] = decodeURIComponent(actual);
      } else if (esperado !== actual) {
        coincide = false;
        break;
      }
    }

    if (coincide) {
      return {
        vista: definicion.vista,
        params,
        titulo: definicion.titulo,
        requiereSesion: Boolean(definicion.requiereSesion),
        consulta,
      };
    }
  }

  return null;
}

/** Ruta actual sin el prefijo "#". */
export function caminoActual() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "/";
}

/**
 * Navega a una ruta interna.
 * @param {string} ruta
 * @param {{reemplazar?:boolean}} [opciones] `reemplazar` evita añadir una
 *   entrada al historial del navegador (útil tras crear un recurso).
 */
export function navegar(ruta, opciones = {}) {
  const destino = String(ruta ?? "/");
  if (caminoActual() === destino) {
    resolver();
    return;
  }
  if (opciones.reemplazar && window.history?.replaceState) {
    const base = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", `${base}#${destino}`);
    resolver();
    return;
  }
  window.location.hash = destino;
}

/** Ruta actual descompuesta. */
export function estadoActual() {
  const camino = caminoActual();
  const [ruta, cadenaConsulta] = camino.split("?");
  const definicion = resolverRuta(ruta);
  const consulta = {};
  if (cadenaConsulta) {
    for (const par of cadenaConsulta.split("&")) {
      const [clave, valor = ""] = par.split("=");
      if (clave) consulta[decodeURIComponent(clave)] = decodeURIComponent(valor);
    }
  }
  return { ruta, consulta, definicion };
}

/**
 * Inicia el enrutador.
 * @param {{alResolver:Function}} opciones
 *   alResolver({vista, params, consulta, ruta}) -> Promise<void>
 */
export function iniciarEnrutador({ alResolver }) {
  alCambiar = alResolver;

  window.addEventListener("hashchange", resolver);

  if (!window.location.hash) {
    window.location.replace("#/");
  } else {
    resolver();
  }
}

async function resolver() {
  if (!alCambiar) return;
  const { ruta, consulta, definicion } = estadoActual();
  await alCambiar({
    ruta,
    consulta,
    vista: definicion?.vista ?? "no-encontrada",
    params: definicion?.params ?? {},
    definicion,
  });
}

/** Ejecuta la resolución actual (p. ej. tras cambiar la sesión). */
export function refrescarRuta() {
  return resolver();
}
