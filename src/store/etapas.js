/* ============================================================
   Bitácora de Viaje · store/etapas.js
   Operaciones sobre las etapas de un viaje.
   ============================================================ */

import { exigirSupabase, mensajeError } from "../lib/supabase.js";
import { eliminarArchivos, BUCKET_FOTOS, BUCKET_GPX } from "../lib/almacen.js";

/** Lista las etapas de un viaje ordenadas por número. */
export async function listarEtapas(viajeId, userId) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("etapas")
    .select("*")
    .eq("viaje_id", viajeId)
    .eq("user_id", userId)
    .order("numero", { ascending: true });

  if (error) throw new Error(mensajeError(error));
  return data ?? [];
}

/** Obtiene una etapa verificando la propiedad del viaje. */
export async function obtenerEtapa(id, userId) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("etapas")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(mensajeError(error));
  return data;
}

/** Número de etapas de un viaje + 1. */
export async function siguienteNumero(viajeId, userId) {
  const etapas = await listarEtapas(viajeId, userId);
  if (!etapas.length) return 1;
  return Math.max(...etapas.map((e) => Number(e.numero) || 0)) + 1;
}

/** Crea una etapa. */
export async function crearEtapa(userId, viajeId, datos) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("etapas")
    .insert({
      user_id: userId,
      viaje_id: viajeId,
      numero: datos.numero ?? 1,
      fecha: datos.fecha || null,
      titulo: String(datos.titulo ?? "").trim(),
      salida: String(datos.salida ?? "").trim(),
      llegada: String(datos.llegada ?? "").trim(),
      diario: String(datos.diario ?? ""),
      gpx_path: datos.gpx_path ?? null,
      gpx_url: datos.gpx_url ?? null,
      distancia_m: datos.distancia_m ?? null,
      ascenso_m: datos.ascenso_m ?? null,
      descenso_m: datos.descenso_m ?? null,
      duracion_s: datos.duracion_s ?? null,
      con_altitud: datos.con_altitud ?? false,
      puntos_gpx: datos.puntos_gpx ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(mensajeError(error));
  return data;
}

/** Actualiza una etapa. */
export async function actualizarEtapa(id, userId, cambios) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("etapas")
    .update(cambios)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(mensajeError(error));
  return data;
}

/** Elimina una etapa, sus fotografías y sus archivos. */
export async function eliminarEtapa(id, userId) {
  const supabase = exigirSupabase();

  const [{ data: etapa }, { data: fotos }] = await Promise.all([
    supabase.from("etapas").select("gpx_path").eq("id", id).eq("user_id", userId).maybeSingle(),
    supabase.from("fotografias").select("path").eq("etapa_id", id).eq("user_id", userId),
  ]);

  const { error } = await supabase.from("etapas").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(mensajeError(error));

  await eliminarArchivos(BUCKET_FOTOS, (fotos ?? []).map((f) => f.path));
  if (etapa?.gpx_path) await eliminarArchivos(BUCKET_GPX, [etapa.gpx_path]);
}

/**
 * Renumera las etapas de forma consecutiva (1, 2, 3…).
 * Se llama tras eliminar o mover una etapa.
 */
export async function renumerarEtapas(viajeId, userId) {
  const supabase = exigirSupabase();
  const etapas = await listarEtapas(viajeId, userId);

  await Promise.all(
    etapas.map((etapa, indice) => {
      const numero = indice + 1;
      if (Number(etapa.numero) === numero) return Promise.resolve();
      return supabase
        .from("etapas")
        .update({ numero })
        .eq("id", etapa.id)
        .eq("user_id", userId)
        .then(({ error }) => {
          if (error) console.warn("No se pudo renumerar la etapa:", error.message);
        });
    }),
  );
}
