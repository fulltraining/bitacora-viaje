/* ============================================================
   Bitácora de Viaje · lib/imagen.js
   Validación y preparación de fotografías antes de subirlas.
   ============================================================ */

export const FORMATOS_PERMITIDOS = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];

export const TAMANO_MAXIMO_ENTRADA = 12 * 1024 * 1024; // 12 MB
export const LADO_MAXIMO = 2400; // px del lado mayor resultante
export const CALIDAD = 0.85;

/**
 * Valida un archivo de imagen.
 * @param {File} archivo
 * @returns {{ok:boolean, error?:string}}
 */
export function validarImagen(archivo) {
  if (!archivo) return { ok: false, error: "No se ha seleccionado ninguna imagen." };

  const tipo = (archivo.type || "").toLowerCase();

  if (!tipo.startsWith("image/")) {
    return { ok: false, error: "El archivo no es una imagen." };
  }

  if (!FORMATOS_PERMITIDOS.includes(tipo)) {
    return {
      ok: false,
      error: `Formato no admitido (${tipo || "desconocido"}). Usa JPG, PNG, WEBP o GIF.`,
    };
  }

  if (archivo.size > TAMANO_MAXIMO_ENTRADA) {
    return {
      ok: false,
      error: `La imagen pesa ${(archivo.size / 1048576).toFixed(1)} MB y el máximo es 12 MB.`,
    };
  }

  if (archivo.size === 0) {
    return { ok: false, error: "El archivo está vacío." };
  }

  return { ok: true };
}

/**
 * Redimensiona y comprime una imagen en el navegador.
 * Devuelve el archivo listo para subir junto con sus dimensiones.
 * @param {File} archivo
 * @returns {Promise<{blob:Blob, ancho:number, alto:number, tipo:string, nombre:string}>}
 */
export async function prepararImagen(archivo) {
  const bitmap = await cargarBitmap(archivo);

  const anchoOriginal = bitmap.width;
  const altoOriginal = bitmap.height;
  const escala = Math.min(1, LADO_MAXIMO / Math.max(anchoOriginal, altoOriginal));

  const ancho = Math.max(1, Math.round(anchoOriginal * escala));
  const alto = Math.max(1, Math.round(altoOriginal * escala));

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;

  const contexto = lienzo.getContext("2d");
  contexto.imageSmoothingQuality = "high";
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, ancho, alto);
  contexto.drawImage(bitmap, 0, 0, ancho, alto);

  if (typeof bitmap.close === "function") bitmap.close();

  const tipo = archivo.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolver) =>
    lienzo.toBlob((b) => resolver(b), tipo, tipo === "image/jpeg" ? CALIDAD : undefined),
  );

  if (!blob) {
    // Último recurso: subir el original sin comprimir
    return {
      blob: archivo,
      ancho: anchoOriginal,
      alto: altoOriginal,
      tipo: archivo.type,
      nombre: archivo.name,
    };
  }

  return {
    blob,
    ancho,
    alto,
    tipo,
    nombre: `${cambiarExtension(archivo.name)}.${tipo === "image/png" ? "png" : "jpg"}`,
  };
}

/** Carga la imagen respetando la orientación EXIF (habitual en Android). */
async function cargarBitmap(archivo) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(archivo, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(archivo);
      } catch {
        /* seguimos con la vía alternativa */
      }
    }
  }

  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolver(imagen);
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error("No se ha podido leer la imagen."));
    };
    imagen.src = url;
  });
}

function cambiarExtension(nombre) {
  return String(nombre ?? "imagen").replace(/\.[^.]+$/, "");
}

/**
 * Extrae la imagen de un objeto FileSelectorResult (compatible con
 * <input type="file"> y con selectores nativos de Android).
 */
export async function desdeFileList(lista) {
  const archivos = Array.from(lista ?? []).filter(Boolean);
  if (!archivos.length) return null;

  const entrada = await prepararImagen(archivos[0]);
  return { ...entrada, archivos };
}
