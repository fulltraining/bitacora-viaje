/* ============================================================
   Bitácora de Viaje · lib/audio.js
   Grabación de audio con MediaRecorder: detección de formatos,
   cronómetro, control de estados y liberación del micrófono.

   Notas de compatibilidad:
   · Chrome en Android soporta audio/webm;codecs=opus.
   · iOS/Safari usa audio/mp4;codecs=mp4a.40.2.
   · El permiso de micrófono solo se pide al pulsar «Grabar».
   ============================================================ */

export const CATEGORIAS_AUDIO = [
  { valor: "nota", etiqueta: "Nota de voz", icono: "🎙️" },
  { valor: "naturaleza", etiqueta: "Naturaleza", icono: "🌿" },
  { valor: "ciudad", etiqueta: "Ciudad", icono: "🏙️" },
  { valor: "conversacion", etiqueta: "Conversación", icono: "💬" },
  { valor: "otros", etiqueta: "Otros", icono: "📎" },
];

export const FORMATOS_AUDIO = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/amr",
  "audio/3gpp",
  "audio/ogg",
];

export const TAMANO_MAXIMO_AUDIO = 25 * 1024 * 1024; // 25 MB
export const DURACION_MAXIMA_S = 900; // 15 minutos
export const DURACION_MINIMA_S = 1;

/** Candidatos MIME ordenados por preferencia (calidad > compatibilidad). */
export const MIMES_CANDIDATOS = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
];

/** ¿El navegador permite grabar audio? */
export function soporteGrabacion() {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator?.mediaDevices?.getUserMedia)
  );
}

/** Lista de MIME admitidos por este navegador. */
export function mimesSoportados() {
  if (typeof MediaRecorder === "undefined") return [];
  return MIMES_CANDIDATOS.filter((mime) => {
    try {
      return MediaRecorder.isTypeSupported?.(mime);
    } catch {
      return false;
    }
  });
}

/** MIME preferido para este navegador ("" si no se puede determinar). */
export function mimePreferido() {
  const soportados = mimesSoportados();
  return soportados[0] ?? "";
}

/** Extensión de archivo según el MIME. */
export function extensionDesdeMime(mime) {
  const tipo = String(mime ?? "").toLowerCase();
  if (tipo.includes("webm")) return "webm";
  if (tipo.includes("ogg")) return "ogg";
  if (tipo.includes("mp4")) return "m4a";
  if (tipo.includes("aac")) return "aac";
  if (tipo.includes("mpeg") || tipo.includes("mp3")) return "mp3";
  if (tipo.includes("wav")) return "wav";
  if (tipo.includes("flac")) return "flac";
  if (tipo.includes("amr")) return "amr";
  return "audio";
}

/** Nombre de archivo con marca de tiempo. */
export function nombreAudio(extension = "webm", sufijo = "") {
  const ahora = new Date();
  const sello = [
    ahora.getFullYear(),
    String(ahora.getMonth() + 1).padStart(2, "0"),
    String(ahora.getDate()).padStart(2, "0"),
    "-",
    String(ahora.getHours()).padStart(2, "0"),
    String(ahora.getMinutes()).padStart(2, "0"),
    String(ahora.getSeconds()).padStart(2, "0"),
  ].join("");
  return `audio-${sello}${sufijo ? `-${sufijo}` : ""}.${extension}`;
}

/** Formatea una duración en segundos como "m:ss" o "h:mm:ss". */
export function formatearDuracion(segundos) {
  const s = Math.max(0, Math.floor(Number(segundos) || 0));
  const horas = Math.floor(s / 3600);
  const minutos = Math.floor((s % 3600) / 60);
  const resto = s % 60;

  if (horas > 0) {
    return `${horas}:${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
  }
  return `${minutos}:${String(resto).padStart(2, "0")}`;
}

/**
 * Valida un archivo de audio (importado o grabado).
 * @param {{nombre?:string, tipo?:string, bytes?:number, duracionS?:number}} datos
 * @returns {{ok:boolean, error?:string}}
 */
export function validarAudio({ nombre = "", tipo = "", bytes = 0, duracionS = null } = {}) {
  const tipoLower = String(tipo ?? "").toLowerCase();

  if (!tipoLower.startsWith("audio/")) {
    return { ok: false, error: `«${nombre || "El archivo"}» no es un archivo de audio.` };
  }

  const base = tipoLower.split(";")[0];
  if (!FORMATOS_AUDIO.includes(base)) {
    return {
      ok: false,
      error: `Formato no admitido (${base}). Usa WebM, OGG, M4A, MP3, WAV o FLAC.`,
    };
  }

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { ok: false, error: "El archivo de audio está vacío." };
  }

  if (bytes > TAMANO_MAXIMO_AUDIO) {
    return {
      ok: false,
      error: `El audio pesa ${(bytes / 1048576).toFixed(1)} MB y el máximo es 25 MB.`,
    };
  }

  if (duracionS !== null && Number.isFinite(duracionS)) {
    if (duracionS > DURACION_MAXIMA_S) {
      return {
        ok: false,
        error: `La grabación dura ${formatearDuracion(duracionS)} y el máximo es 15 minutos.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Calcula la duración de un archivo de audio reproduciéndolo en memoria.
 * @param {Blob} blob
 * @returns {Promise<number|null>} segundos o null si no se puede determinar
 */
export function medirDuracion(blob) {
  return new Promise((resolver) => {
    if (typeof Audio === "undefined") {
      resolver(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    let resuelto = false;

    const limpiar = () => {
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
    };

    const alCerrar = () => {
      if (resuelto) return;
      resuelto = true;
      limpiar();
      resolver(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
    };

    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", alCerrar, { once: true });
    audio.addEventListener("durationchange", alCerrar, { once: true });
    audio.addEventListener("error", alCerrar, { once: true });

    setTimeout(() => {
      if (resuelto) return;
      resuelto = true;
      limpiar();
      resolver(null);
    }, 6000);

    audio.src = url;
  });
}

/**
 * Controlador de grabación.
 *
 * Estados: inactivo → grabando ⇄ pausado → detenido.
 * El micrófono se libera siempre: al detener, descartar o destruir.
 */
export function crearGrabador({ alCambiar, alError } = {}) {
  let stream = null;
  let recorder = null;
  let cronometro = null;
  let chunks = [];
  let mimeType = "";
  let estado = "inactivo";
  let duracion = 0;
  let inicioMarca = 0;
  let acumulado = 0;
  let nivel = 0;
  let audioCtx = null;
  let analizador = null;
  let rafNivel = null;

  function emitir(cambios = {}) {
    alCambiar?.({ estado, duracion, nivel, ...cambios });
  }

  function error(mensaje) {
    alError?.(mensaje);
  }

  function pararCronometro() {
    if (cronometro) {
      clearInterval(cronometro);
      cronometro = null;
    }
  }

  function pararMedidor() {
    if (rafNivel) {
      cancelAnimationFrame(rafNivel);
      rafNivel = null;
    }
    if (analizador) {
      try {
        analizador.disconnect();
      } catch {
        /* ignorado */
      }
      analizador = null;
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  }

  /** Libera el micrófono. Idempotente. */
  function liberarMicrofono() {
    pararCronometro();
    pararMedidor();
    if (stream) {
      for (const pista of stream.getTracks()) {
        try {
          pista.stop();
        } catch {
          /* ignorado */
        }
      }
      stream = null;
    }
  }

  function arrancarCronometro() {
    pararCronometro();
    cronometro = setInterval(() => {
      duracion = Math.floor((acumulado + (Date.now() - inicioMarca)) / 1000);
      emitir();
      if (duracion >= DURACION_MAXIMA_S) {
        detener().catch((e) => error(e.message));
      }
    }, 200);
  }

  function arrancarMedidor() {
    if (!stream || typeof AudioContext === "undefined") return;
    try {
      audioCtx = new AudioContext();
      const origen = audioCtx.createMediaStreamSource(stream);
      analizador = audioCtx.createAnalyser();
      analizador.fftSize = 512;
      origen.connect(analizador);
      const datos = new Uint8Array(analizador.frequencyBinCount);

      const medir = () => {
        if (!analizador) return;
        analizador.getByteFrequencyData(datos);
        let suma = 0;
        for (const valor of datos) suma += valor;
        nivel = Math.min(1, suma / datos.length / 128);
        rafNivel = requestAnimationFrame(medir);
      };
      medir();
    } catch {
      // El medidor es opcional: si falla, la grabación sigue adelante.
    }
  }

  /** Pide permiso y comienza a grabar. */
  async function iniciar() {
    if (!soporteGrabacion()) {
      throw new Error(
        "Este navegador no permite grabar audio. Usa Chrome en Android o un navegador con soporte de MediaRecorder.",
      );
    }
    if (estado === "grabando" || estado === "pausado") {
      throw new Error("Ya hay una grabación en curso.");
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      if (e?.name === "NotAllowedError") {
        throw new Error(
          "Permiso de micrófono denegado. Habilítalo en los ajustes del navegador y vuelve a intentarlo.",
        );
      }
      if (e?.name === "NotFoundError") {
        throw new Error("No se ha encontrado ningún micrófono en este dispositivo.");
      }
      if (e?.name === "NotReadableError") {
        throw new Error("El micrófono está siendo usado por otra aplicación.");
      }
      throw new Error(`No se ha podido acceder al micrófono: ${e?.message ?? e}`);
    }

    mimeType = mimePreferido();
    const opciones = mimeType ? { mimeType } : {};
    chunks = [];
    duracion = 0;
    acumulado = 0;

    try {
      recorder = new MediaRecorder(stream, opciones);
    } catch (e) {
      liberarMicrofono();
      throw new Error(`El navegador ha rechazado la grabación: ${e?.message ?? e}`);
    }

    recorder.ondataavailable = (evento) => {
      if (evento?.data && evento.data.size > 0) chunks.push(evento.data);
    };

    recorder.onerror = (evento) => {
      error(
        `Error durante la grabación: ${evento?.error?.message ?? "se ha producido un fallo"}`,
      );
      liberarMicrofono();
      estado = "inactivo";
      emitir();
    };

    recorder.onstop = () => {
      pararCronometro();
      pararMedidor();
    };

    recorder.start(1000);
    inicioMarca = Date.now();
    estado = "grabando";
    arrancarCronometro();
    arrancarMedidor();
    emitir({ mimeType });
  }

  function pausar() {
    if (estado !== "grabando" || !recorder) return;
    try {
      recorder.pause();
      acumulado += Date.now() - inicioMarca;
      estado = "pausado";
      emitir();
    } catch (e) {
      error(`No se ha podido pausar: ${e?.message ?? e}`);
    }
  }

  function reanudar() {
    if (estado !== "pausado" || !recorder) return;
    try {
      recorder.resume();
      inicioMarca = Date.now();
      estado = "grabando";
      emitir();
    } catch (e) {
      error(`No se ha podido reanudar: ${e?.message ?? e}`);
    }
  }

  /** Detiene la grabación y devuelve el audio capturado. */
  async function detener() {
    if (!recorder || estado === "inactivo") {
      throw new Error("No hay ninguna grabación en curso.");
    }

    if (estado === "grabando") {
      acumulado += Date.now() - inicioMarca;
    }

    const total = Math.floor(acumulado / 1000);
    const tipoFinal = recorder.mimeType || mimeType || "audio/webm";

    await new Promise((resolver) => {
      const terminar = () => {
        recorder.removeEventListener("stop", terminar);
        resolver();
      };
      recorder.addEventListener("stop", terminar, { once: true });
      try {
        recorder.stop();
      } catch {
        terminar();
      }
    });

    liberarMicrofono();
    estado = "inactivo";

    const blob = new Blob(chunks, { type: tipoFinal });
    chunks = [];

    emitir({ duracion: total });

    if (!blob.size) {
      throw new Error("La grabación está vacía. Inténtalo de nuevo.");
    }

    return {
      blob,
      mimeType: tipoFinal,
      duracionS: total,
      bytes: blob.size,
      nombre: nombreAudio(extensionDesdeMime(tipoFinal)),
    };
  }

  /** Descarta la grabación actual y libera el micrófono. */
  function descartar() {
    try {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch {
      /* ignorado */
    }
    liberarMicrofono();
    recorder = null;
    chunks = [];
    duracion = 0;
    acumulado = 0;
    nivel = 0;
    estado = "inactivo";
    emitir();
  }

  /** Libera todo (al salir de la vista). */
  function destruir() {
    try {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch {
      /* ignorado */
    }
    liberarMicrofono();
    recorder = null;
    chunks = [];
    estado = "inactivo";
  }

  return {
    iniciar,
    pausar,
    reanudar,
    detener,
    descartar,
    destruir,
    get estado() {
      return estado;
    },
    get duracion() {
      return duracion;
    },
  };
}

/**
 * Pide la ubicación actual al navegador (permiso explícito).
 * @returns {Promise<{lat:number, lon:number, precision:number}>}
 */
export function pedirUbicacion({ alError } = {}) {
  return new Promise((resolver, rechazar) => {
    if (!navigator.geolocation) {
      rechazar(new Error("Este dispositivo no ofrece geolocalización."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        resolver({
          lat: Number(posicion.coords.latitude.toFixed(6)),
          lon: Number(posicion.coords.longitude.toFixed(6)),
          precision: Math.round(posicion.coords.accuracy ?? 0),
        });
      },
      (error) => {
        const mensajes = {
          1: "Permiso de ubicación denegado.",
          2: "No se ha podido determinar la ubicación.",
          3: "La solicitud de ubicación ha tardado demasiado.",
        };
        const mensaje = mensajes[error.code] ?? "No se ha podido obtener la ubicación.";
        alError?.(mensaje);
        rechazar(new Error(mensaje));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}
