/* ============================================================
   Bitácora de Viaje · lib/config.js
   Configuración de Supabase.

   Prioridad de lectura:
     1. Variables de entorno VITE_SUPABASE_* (build / .env)
     2. Ajustes guardados en el dispositivo (localStorage)

   El segundo caso permite usar la app desde Termux sin
   recompilar, introduce la URL y la clave pública desde
   la pantalla de Configuración.
   ============================================================ */

const CLAVE_ALMACEN = "bitacora:supabase";

/** @returns {{url:string, anonKey:string}|null} */
export function leerConfigGuardada() {
  try {
    const bruto = localStorage.getItem(CLAVE_ALMACEN);
    if (!bruto) return null;
    const datos = JSON.parse(bruto);
    if (!datos?.url || !datos?.anonKey) return null;
    return { url: String(datos.url).trim(), anonKey: String(datos.anonKey).trim() };
  } catch {
    return null;
  }
}

export function guardarConfig({ url, anonKey }) {
  const limpio = {
    url: String(url ?? "").trim(),
    anonKey: String(anonKey ?? "").trim(),
  };
  localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(limpio));
  return limpio;
}

export function borrarConfigGuardada() {
  localStorage.removeItem(CLAVE_ALMACEN);
}

/**
 * @returns {{url:string, anonKey:string, origen:"entorno"|"dispositivo"}|null}
 */
export function obtenerConfig() {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

  if (url && anonKey) {
    return { url, anonKey, origen: "entorno" };
  }

  const guardada = leerConfigGuardada();
  if (guardada) {
    return { ...guardada, origen: "dispositivo" };
  }

  return null;
}

export function hayConfig() {
  return obtenerConfig() !== null;
}

/** Comprueba que la URL tenga forma de URL de Supabase. */
export function urlValida(valor) {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
