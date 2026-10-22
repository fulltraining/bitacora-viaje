/* ============================================================
   Bitácora de Viaje · lib/supabase.js
   Cliente único de Supabase (Auth + Postgres + Storage).
   ============================================================ */

import { createClient } from "@supabase/supabase-js";
import { obtenerConfig } from "./config.js";

let cliente = null;

/**
 * @returns {import("@supabase/supabase-js").SupabaseClient|null}
 *   null si todavía no hay configuración.
 */
export function obtenerSupabase() {
  if (cliente) return cliente;

  const config = obtenerConfig();
  if (!config) return null;

  cliente = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "bitacora:sesion",
      flowType: "pkce",
    },
    global: {
      headers: { "X-Client-Info": "bitacora-de-viaje/1.0" },
    },
  });

  return cliente;
}

/** Lanza si no hay configuración (uso interno tras comprobar sesión). */
export function exigirSupabase() {
  const c = obtenerSupabase();
  if (!c) {
    throw new Error(
      "Supabase no está configurado. Ve a Configuración e introduce la URL y la clave pública.",
    );
  }
  return c;
}

/** Reinicia el cliente (tras cambiar la configuración). */
export function reiniciarSupabase() {
  cliente = null;
}

/**
 * Traduce los errores de PostgREST a un mensaje legible en español.
 * @param {unknown} error
 * @returns {string}
 */
export function mensajeError(error) {
  if (!error) return "Ha ocurrido un error inesperado.";
  if (typeof error === "string") return error;

  const codigo = error.code ?? "";
  const mensaje = error.message ?? "";

  if (codigo === "23505") return "Ya existe un registro con esos datos.";
  if (codigo === "23503") return "La operación hace referencia a un elemento que no existe.";
  if (codigo === "42501") return "No tienes permiso para realizar esta operación.";
  if (codigo === "PGRST116" || /not found/i.test(mensaje)) {
    return "No se ha encontrado el elemento solicitado.";
  }
  if (/Invalid login credentials/i.test(mensaje)) {
    return "El correo o la contraseña no son correctos.";
  }
  if (/User already registered/i.test(mensaje)) {
    return "Ya existe una cuenta con ese correo.";
  }
  if (/Email not confirmed/i.test(mensaje)) {
    return "Debes confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.";
  }
  if (/Password should be at least/i.test(mensaje)) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (/rate limit|too many/i.test(mensaje)) {
    return "Demasiados intentos. Espera unos segundos e inténtalo de nuevo.";
  }
  if (/Failed to fetch|NetworkError|network/i.test(mensaje)) {
    return "Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.";
  }
  if (/Storage error/i.test(mensaje)) {
    return "No se ha podido guardar el archivo en el almacenamiento.";
  }
  if (mensaje) return mensaje;

  return "Ha ocurrido un error inesperado.";
}
