/* ============================================================
   Bitácora de Viaje · store/viajes.js
   Operaciones sobre la tabla de viajes.
   ============================================================ */

import { exigirSupabase, mensajeError } from "../lib/supabase.js";
import { eliminarArchivos, BUCKET_FOTOS, BUCKET_GPX } from "../lib/almacen.js";

/* ---------------- Lectura ---------------- */

/** Lista los viajes del usuario, del más reciente al más antiguo. */
export async function listarViajes(userId) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("viajes")
    .select("*")
    .eq("user_id", userId)
    .order("fecha_inicio", { ascending: false, nullsFirst: false })
    .order("creado_en", { ascending: false });

  if (error) throw new Error(mensajeError(error));
  return data ?? [];
}

/** Obtiene un viaje concreto verificando la propiedad. */
export async function obtenerViaje(id, userId) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("viajes")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(mensajeError(error));
  return data;
}

/* ---------------- Escritura ---------------- */

/** Crea un viaje. */
export async function crearViaje(userId, datos) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("viajes")
    .insert({
      user_id: userId,
      titulo: String(datos.titulo ?? "").trim(),
      destino: String(datos.destino ?? "").trim(),
      fecha_inicio: datos.fecha_inicio || null,
      fecha_fin: datos.fecha_fin || null,
      descripcion: String(datos.descripcion ?? ""),
      portada_url: datos.portada_url ?? null,
      portada_path: datos.portada_path ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(mensajeError(error));
  return data;
}

/** Actualiza un viaje. */
export async function actualizarViaje(id, userId, cambios) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("viajes")
    .update(cambios)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(mensajeError(error));
  return data;
}

/**
 * Elimina un viaje con sus etapas, fotografías y archivos.
 * @param {string} id
 * @param {string} userId
 */
export async function eliminarViaje(id, userId) {
  const supabase = exigirSupabase();

  // Recogemos las rutas de Storage antes de borrar los registros.
  const [{ data: etapas }, { data: fotos }] = await Promise.all([
    supabase.from("etapas").select("gpx_path").eq("viaje_id", id).eq("user_id", userId),
    supabase.from("fotografias").select("path").eq("viaje_id", id).eq("user_id", userId),
  ]);

  const rutasFotos = (fotos ?? []).map((f) => f.path).filter(Boolean);
  const rutasGpx = (etapas ?? []).map((e) => e.gpx_path).filter(Boolean);

  const { error } = await supabase
    .from("viajes")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(mensajeError(error));

  // Las filas de etapas y fotografías caen por cascada; los archivos se borran aparte.
  await eliminarArchivos(BUCKET_FOTOS, rutasFotos);
  await eliminarArchivos(BUCKET_GPX, rutasGpx);
}

/* ---------------- Utilidades ---------------- */

/** Número de etapas de un viaje. */
export async function contarEtapas(viajeId, userId) {
  const supabase = exigirSupabase();

  const { count, error } = await supabase
    .from("etapas")
    .select("id", { count: "exact", head: true })
    .eq("viaje_id", viajeId)
    .eq("user_id", userId);

  if (error) throw new Error(mensajeError(error));
  return count ?? 0;
}
