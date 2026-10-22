/* ============================================================
   Bitácora de Viaje · lib/almacen.js
   Subida y borrado de archivos en Supabase Storage.
   ============================================================ */

import { exigirSupabase, mensajeError } from "./supabase.js";
import { sanearNombre } from "./dom.js";

export const BUCKET_FOTOS = "fotos";
export const BUCKET_GPX = "gpx";

/**
 * Construye la ruta dentro del bucket.
 * Formato: uploads/{userId}/viajes/{viajeId}/etapas/{etapaId}/{archivo}
 */
export function rutaArchivo({ userId, viajeId, etapaId = null, nombre, prefijo = "" }) {
  const partes = ["uploads", userId, "viajes", viajeId];
  if (etapaId) partes.push("etapas", etapaId);
  if (prefijo) partes.push(prefijo);
  partes.push(sanearNombre(nombre));
  return partes.filter(Boolean).join("/");
}

/** URL pública de un archivo ya subido. */
export function urlPublica(bucket, ruta) {
  if (!ruta) return null;
  const supabase = obtenerSupabaseSeguro();
  if (!supabase) return null;
  return supabase.storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
}

function obtenerSupabaseSeguro() {
  try {
    return exigirSupabase();
  } catch {
    return null;
  }
}

/**
 * Sube un archivo a Storage.
 * @param {string} bucket
 * @param {string} ruta
 * @param {Blob|File} archivo
 * @param {string} contentType
 * @returns {Promise<{ruta:string, url:string}>}
 */
export async function subirArchivo(bucket, ruta, archivo, contentType) {
  const supabase = exigirSupabase();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(ruta, archivo, {
      contentType: contentType || archivo.type || "application/octet-stream",
      upsert: true,
      cacheControl: "31536000",
    });

  if (error) {
    throw new Error(mensajeError(error));
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(ruta);
  return { ruta, url: data.publicUrl };
}

/**
 * Elimina un archivo de Storage (ignora si ya no existe).
 * @param {string} bucket
 * @param {string} ruta
 */
export async function eliminarArchivo(bucket, ruta) {
  if (!ruta) return;
  const supabase = exigirSupabase();

  const { error } = await supabase.storage.from(bucket).remove([ruta]);
  if (error && !/not found/i.test(error.message ?? "")) {
    // No bloqueamos el borrado del registro por un fallo de Storage.
    console.warn("No se pudo eliminar el archivo de Storage:", error.message);
  }
}

/** Elimina varios archivos de una vez. */
export async function eliminarArchivos(bucket, rutas) {
  const lista = (rutas ?? []).filter(Boolean);
  if (!lista.length) return;
  const supabase = exigirSupabase();
  const { error } = await supabase.storage.from(bucket).remove(lista);
  if (error) {
    console.warn("No se pudieron eliminar los archivos de Storage:", error.message);
  }
}
