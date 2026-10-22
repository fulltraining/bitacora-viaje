/* ============================================================
   Bitácora de Viaje · store/audio.js
   Diario sonoro: metadatos en Postgres y archivos en un bucket
   privado de Supabase Storage.

   El bucket "audios" es PRIVADO: no se generan URLs públicas.
   La reproducción usa URL firmadas de corta duración.
   ============================================================ */

import { exigirSupabase, mensajeError } from "../lib/supabase.js";
import { sanearNombre } from "../lib/dom.js";
import { extensionDesdeMime } from "../lib/audio.js";

export const BUCKET_AUDIO = "audios";

/** Ruta dentro del bucket: uploads/{userId}/viajes/{viajeId}/etapas/{etapaId}/audio/{archivo} */
export function rutaAudio({ userId, viajeId, etapaId, nombre }) {
  const partes = [
    "uploads",
    userId,
    "viajes",
    viajeId,
    "etapas",
    etapaId,
    "audio",
    sanearNombre(nombre),
  ];
  return partes.filter(Boolean).join("/");
}

/* ---------------- Lectura ---------------- */

/** Grabaciones de una etapa. */
export async function listarAudios(etapaId, userId) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("audio_recordings")
    .select("*")
    .eq("etapa_id", etapaId)
    .eq("user_id", userId)
    .order("creado_en", { ascending: false });

  if (error) throw new Error(mensajeError(error));
  return data ?? [];
}

/** Grabaciones de un viaje completo (para dibujar los marcadores). */
export async function listarAudiosDeViaje(viajeId, userId) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("audio_recordings")
    .select("*")
    .eq("viaje_id", viajeId)
    .eq("user_id", userId)
    .order("creado_en", { ascending: false });

  if (error) throw new Error(mensajeError(error));
  return data ?? [];
}

/* ---------------- Escritura ---------------- */

/** Registra una grabación ya subida a Storage. */
export async function crearAudio(userId, datos) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("audio_recordings")
    .insert({
      user_id: userId,
      viaje_id: datos.viaje_id,
      etapa_id: datos.etapa_id,
      path: datos.path,
      nombre: datos.nombre ?? null,
      titulo: String(datos.titulo ?? "").trim() || "Grabación sin título",
      descripcion: String(datos.descripcion ?? ""),
      categoria: datos.categoria ?? "nota",
      mime_type: datos.mime_type ?? "audio/webm",
      bytes: datos.bytes ?? 0,
      duracion_s: datos.duracion_s ?? null,
      lat: Number.isFinite(datos.lat) ? datos.lat : null,
      lon: Number.isFinite(datos.lon) ? datos.lon : null,
      precision_m: Number.isFinite(datos.precision_m) ? datos.precision_m : null,
      origen: datos.origen ?? "grabacion",
    })
    .select()
    .single();

  if (error) throw new Error(mensajeError(error));
  return data;
}

/** Actualiza los metadatos de una grabación. */
export async function actualizarAudio(id, userId, cambios) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("audio_recordings")
    .update(cambios)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(mensajeError(error));
  return data;
}

/** Elimina la grabación y su archivo privado. */
export async function eliminarAudio(id, userId) {
  const supabase = exigirSupabase();

  const { data, error } = await supabase
    .from("audio_recordings")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("path")
    .maybeSingle();

  if (error) throw new Error(mensajeError(error));

  if (data?.path) {
    const { error: errorAlmacen } = await supabase.storage.from(BUCKET_AUDIO).remove([data.path]);
    if (errorAlmacen) {
      console.warn("No se pudo eliminar el audio de Storage:", errorAlmacen.message);
    }
  }
}

/* ---------------- Storage ---------------- */

/**
 * Sube un audio al bucket privado informando del progreso.
 * Usa XHR porque el cliente de Supabase no expone eventos de progreso.
 * @param {{userId:string, viajeId:string, etapaId:string, nombre:string}} destino
 * @param {Blob} blob
 * @param {{onProgress?:Function, contentType?:string}} [opciones]
 * @returns {Promise<{ruta:string}>}
 */
export async function subirAudio(destino, blob, opciones = {}) {
  const supabase = exigirSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) throw new Error("Tu sesión ha caducado. Vuelve a iniciar sesión.");

  const ruta = rutaAudio(destino);
  const tipo = opciones.contentType || blob.type || "application/octet-stream";

  const url = `${supabase.supabaseUrl}/storage/v1/object/${BUCKET_AUDIO}/${ruta}`;

  await new Promise((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", supabase.supabaseKey);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("Content-Type", tipo);

    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) {
        opciones.onProgress?.(evento.loaded / evento.total, evento.loaded, evento.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opciones.onProgress?.(1, blob.size, blob.size);
        resolver();
        return;
      }
      let mensaje = `Error ${xhr.status} al subir el audio.`;
      try {
        const cuerpo = JSON.parse(xhr.responseText);
        if (cuerpo?.message || cuerpo?.error) {
          mensaje = cuerpo.message || cuerpo.error;
        }
      } catch {
        /* respuesta no JSON */
      }
      rechazar(new Error(mensaje));
    };

    xhr.onerror = () => rechazar(new Error("Se ha perdido la conexión durante la subida."));
    xhr.ontimeout = () => rechazar(new Error("La subida del audio ha agotado el tiempo."));
    xhr.timeout = 180000;

    xhr.send(blob);
  });

  return { ruta };
}

/**
 * Genera una URL firmada de corta duración para reproducir el audio.
 * @param {string} ruta
 * @param {number} [segundos]
 */
export async function urlFirmada(ruta, segundos = 3600) {
  if (!ruta) return null;
  const supabase = exigirSupabase();

  const { data, error } = await supabase.storage
    .from(BUCKET_AUDIO)
    .createSignedUrl(ruta, segundos);

  if (error) throw new Error(mensajeError(error));
  return data?.signedUrl ?? null;
}

/** Nombre de archivo normalizado para una grabación importada. */
export function nombreNormalizado(archivo, sufijo = "") {
  const base = String(archivo?.name ?? "audio").replace(/\.[^.]+$/, "");
  const extension = extensionDesdeMime(archivo?.type) || "audio";
  return `${sanearNombre(base)}${sufijo ? `-${sufijo}` : ""}.${extension}`;
}
