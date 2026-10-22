/* ============================================================
   Bitácora de Viaje · store/fotografias.js
   Fotografías de las etapas (texto, orden y borrado).
   ============================================================ */

import { exigirSupabase, mensajeError } from "../lib/supabase.js";
import { eliminarArchivo, BUCKET_FOTOS } from "../lib/almacen.js";

/** Lista las fotografías de una etapa. */
export async function listarFotografias(etapaId, userId) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("fotografias")
    .select("*")
    .eq("etapa_id", etapaId)
    .eq("user_id", userId)
    .order("orden", { ascending: true })
    .order("creado_en", { ascending: true });

  if (error) throw new Error(mensajeError(error));
  return data ?? [];
}

/** Registra una fotografía ya subida a Storage. */
export async function crearFotografia(userId, datos) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("fotografias")
    .insert({
      user_id: userId,
      viaje_id: datos.viaje_id,
      etapa_id: datos.etapa_id,
      path: datos.path,
      url: datos.url,
      nombre: datos.nombre ?? null,
      pie: String(datos.pie ?? ""),
      ancho: datos.ancho ?? null,
      alto: datos.alto ?? null,
      bytes: datos.bytes ?? null,
      orden: datos.orden ?? 0,
    })
    .select()
    .single();

  if (error) throw new Error(mensajeError(error));
  return data;
}

/** Actualiza el texto de una fotografía. */
export async function actualizarFotografia(id, userId, cambios) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("fotografias")
    .update(cambios)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(mensajeError(error));
  return data;
}

/** Elimina la fotografía y su archivo en Storage. */
export async function eliminarFotografia(id, userId) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("fotografias")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("path")
    .maybeSingle();

  if (error) throw new Error(mensajeError(error));

  if (data?.path) await eliminarArchivo(BUCKET_FOTOS, data.path);
}

/** Cuenta las fotografías de una etapa. */
export async function contarFotografias(etapaId, userId) {
  const supabase = exigirSupabase();

  const { count, error } = await supabase
    .from("fotografias")
    .select("id", { count: "exact", head: true })
    .eq("etapa_id", etapaId)
    .eq("user_id", userId);

  if (error) throw new Error(mensajeError(error));
  return count ?? 0;
}
