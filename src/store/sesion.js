/* ============================================================
   Bitácora de Viaje · store/sesion.js
   Estado de autenticación y perfil del usuario.
   ============================================================ */

import { obtenerSupabase, reiniciarSupabase, mensajeError } from "../lib/supabase.js";
import { subirArchivo, eliminarArchivo, BUCKET_FOTOS, rutaArchivo } from "../lib/almacen.js";
import { sanearNombre } from "../lib/dom.js";

const suscriptores = new Set();

let estado = {
  usuario: null,
  perfil: null,
  cargando: true,
  configurado: false,
};

export function obtenerEstado() {
  return estado;
}

export function suscribir(fn) {
  suscriptores.add(fn);
  fn(estado);
  return () => suscriptores.delete(fn);
}

function emitir(cambios) {
  estado = { ...estado, ...cambios };
  for (const fn of suscriptores) {
    try {
      fn(estado);
    } catch (error) {
      console.error("Error en un suscriptor de sesión:", error);
    }
  }
}

/* ---------------- Ciclo de vida ---------------- */

let canal = null;

export async function iniciarSesion() {
  const supabase = obtenerSupabase();

  if (!supabase) {
    emitir({ cargando: false, configurado: false });
    return;
  }

  emitir({ configurado: true });

  canal = supabase.auth.onAuthStateChange((evento, sesion) => {
    if (evento === "SIGNED_OUT") {
      emitir({ usuario: null, perfil: null });
      return;
    }
    if (sesion?.user) {
      cargarPerfil(sesion.user).catch((error) =>
        console.error("No se pudo cargar el perfil:", error),
      );
    }
  });

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (data?.session?.user) {
      emitir({ usuario: data.session.user });
      await cargarPerfil(data.session.user);
    } else {
      emitir({ usuario: null, perfil: null });
    }
  } catch (error) {
    console.error("No se pudo recuperar la sesión:", error);
    emitir({ usuario: null, perfil: null });
  } finally {
    emitir({ cargando: false });
  }
}

/** Libera el canal de auth (al cambiar la configuración). */
export function detenerSesion() {
  canal?.subscription?.unsubscribe();
  canal = null;
  reiniciarSupabase();
}

/* ---------------- Perfil ---------------- */

/** Nombre por defecto a partir del correo. */
function nombreSugerido(usuario) {
  const origen = usuario?.user_metadata?.nombre ?? usuario?.user_metadata?.name ?? "";
  if (origen) return String(origen).slice(0, 80);
  const correo = String(usuario?.email ?? "");
  const parte = correo.split("@")[0] ?? "";
  if (!parte) return "Viajero";
  return parte.charAt(0).toUpperCase() + parte.slice(1);
}

/** Carga (o crea) el perfil asociado al usuario. */
export async function cargarPerfil(usuario) {
  const supabase = obtenerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", usuario.id)
    .maybeSingle();

  if (error) {
    console.error("Error al leer el perfil:", error.message);
    emitir({ perfil: null });
    return null;
  }

  if (data) {
    emitir({ perfil: data });
    return data;
  }

  // El perfil no existe (trigger no instalado o usuario antiguo): lo creamos.
  const { data: creado, error: errorCrear } = await supabase
    .from("perfiles")
    .insert({ id: usuario.id, nombre: nombreSugerido(usuario) })
    .select()
    .single();

  if (errorCrear) {
    console.error("No se pudo crear el perfil:", errorCrear.message);
    emitir({ perfil: null });
    return null;
  }

  emitir({ perfil: creado });
  return creado;
}

/** Actualiza los datos del perfil. */
export async function actualizarPerfil({ nombre, avatar_url }) {
  const supabase = obtenerSupabase();
  const usuario = estado.usuario;
  if (!supabase || !usuario) throw new Error("No hay sesión iniciada.");

  const cambios = {};
  if (nombre !== undefined) cambios.nombre = String(nombre).trim().slice(0, 80);
  if (avatar_url !== undefined) cambios.avatar_url = avatar_url;

  const { data, error } = await supabase
    .from("perfiles")
    .update(cambios)
    .eq("id", usuario.id)
    .select()
    .single();

  if (error) throw new Error(mensajeError(error));

  emitir({ perfil: data });
  return data;
}

/** Sube una foto de perfil y guarda su URL. */
export async function subirAvatar(archivo) {
  const supabase = obtenerSupabase();
  const usuario = estado.usuario;
  if (!supabase || !usuario) throw new Error("No hay sesión iniciada.");

  const anterior = estado.perfil?.avatar_path ?? null;
  const nombreBase = archivo.name ?? `avatar-${Date.now()}.jpg`;

  const ruta = rutaArchivo({
    userId: usuario.id,
    viajeId: "perfil",
    prefijo: "avatar",
    nombre: `${sanearNombre(nombreBase)}-${Date.now()}.jpg`,
  });

  const { url } = await subirArchivo(
    BUCKET_FOTOS,
    ruta,
    archivo,
    archivo.type || "image/jpeg",
  );

  const { data: perfilActualizado, error } = await supabase
    .from("perfiles")
    .update({ avatar_url: url, avatar_path: ruta })
    .eq("id", usuario.id)
    .select()
    .single();

  if (error) throw new Error(mensajeError(error));

  emitir({ perfil: perfilActualizado });

  if (anterior && anterior !== ruta) {
    await eliminarArchivo(BUCKET_FOTOS, anterior).catch(() => {});
  }

  return perfilActualizado;
}

/* ---------------- Autenticación ---------------- */

/**
 * Registra un nuevo usuario.
 * @returns {{requiereConfirmacion:boolean, mensaje:string}}
 */
export async function registrar({ email, password, nombre }) {
  const supabase = obtenerSupabase();
  if (!supabase) throw new Error("Supabase no está configurado.");

  const { data, error } = await supabase.auth.signUp({
    email: String(email).trim(),
    password,
    options: {
      data: { nombre: String(nombre ?? "").trim() },
      emailRedirectTo: `${window.location.origin}${window.location.pathname}#/acceso`,
    },
  });

  if (error) throw new Error(mensajeError(error));

  const requiereConfirmacion = !data.session;

  return {
    requiereConfirmacion,
    mensaje: requiereConfirmacion
      ? "Cuenta creada. Revisa tu correo para confirmar la dirección y poder entrar."
      : "¡Cuenta creada! Bienvenido a la bitácora.",
  };
}

/** Inicia sesión. */
export async function iniciarSesionConCredenciales({ email, password }) {
  const supabase = obtenerSupabase();
  if (!supabase) throw new Error("Supabase no está configurado.");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email).trim(),
    password,
  });

  if (error) throw new Error(mensajeError(error));

  if (data?.user) {
    emitir({ usuario: data.user });
    await cargarPerfil(data.user);
  }

  return data?.user ?? null;
}

/** Envía el correo de recuperación. */
export async function enviarRecuperacion(email) {
  const supabase = obtenerSupabase();
  if (!supabase) throw new Error("Supabase no está configurado.");

  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), {
    redirectTo: `${window.location.origin}${window.location.pathname}#/restablecer`,
  });

  if (error) throw new Error(mensajeError(error));
}

/** Cierra sesión. */
export async function cerrarSesion() {
  const supabase = obtenerSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(mensajeError(error));
  emitir({ usuario: null, perfil: null });
}

/**
 * Actualiza la contraseña del usuario actual (tras el enlace de recuperación).
 */
export async function establecerNuevaPassword(password) {
  const supabase = obtenerSupabase();
  if (!supabase) throw new Error("Supabase no está configurado.");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(mensajeError(error));
}
