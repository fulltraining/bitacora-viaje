/* ============================================================
   Bitácora de Viaje · views/_audio.js
   Panel del diario sonoro dentro de una etapa.

   · Grabación con MediaRecorder (permiso solo al pulsar «Grabar»)
   · Importación de audios ya existentes en el teléfono
   · Metadatos: título, descripción y categoría
   · Ubicación opcional (GPS actual o marcador sobre el mapa GPX)
   · Lista con reproducción mediante URL firmada (bucket privado)
   ============================================================ */

import { crear, vaciar } from "../lib/dom.js";
import {
  CATEGORIAS_AUDIO,
  crearGrabador,
  formatearDuracion,
  medirDuracion,
  validarAudio,
  extensionDesdeMime,
  nombreAudio,
  pedirUbicacion,
  soporteGrabacion,
} from "../lib/audio.js";
import {
  listarAudios,
  crearAudio,
  actualizarAudio,
  eliminarAudio,
  subirAudio,
  urlFirmada,
  nombreNormalizado,
} from "../store/audio.js";
import { confirmar, notificar, abrirModal } from "../lib/ui.js";
import { fecha, haceCuanto } from "../lib/formato.js";
import { coordenadasValidas } from "../lib/geo.js";

const ICONO_MICROFONO = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3M8.5 21h7"/></svg>`;
const ICONO_IMPORTAR = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/></svg>`;
const ICONO_REPRODUCIR = `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>`;
const ICONO_PAUSA = `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M8 5h3v14H8zM13 5h3v14h-3z"/></svg>`;
const ICONO_LAPIZ = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z"/></svg>`;
const ICONO_PAPELERA = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3"/></svg>`;
const ICONO_UBICACION = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>`;

/**
 * Crea el panel de audio de una etapa.
 * @param {object} opciones
 * @param {string} opciones.userId
 * @param {object} opciones.viaje
 * @param {object} opciones.etapa
 * @param {Function} [opciones.obtenerMapa] devuelve el componente de mapa (o null)
 * @param {Function} [opciones.alCambiar] se llama cuando cambia la lista
 * @returns {{nodo:HTMLElement, tienePendientes:Function, destruir:Function, audios:Array}}
 */
export function crearPanelAudio({ userId, viaje, etapa, obtenerMapa, alCambiar } = {}) {
  const nodo = crear("section", { class: "bloque bloque--audio" });
  const audios = [];

  /* ---------------- Cabecera ---------------- */
  nodo.append(
    crear("div", {
      class: "bloque__cabecera",
      html: `
        <div>
          <p class="kicker">Diario sonoro</p>
          <h2>Grabaciones</h2>
        </div>
      `,
    }),
  );

  const acciones = crear("div", { class: "fila" });

  const botonGrabar = crear("button", {
    type: "button",
    class: "boton boton--acento",
    html: `${ICONO_MICROFONO}<span>Grabar audio</span>`,
  });

  const inputImportar = crear("input", {
    type: "file",
    accept: "audio/*",
    multiple: true,
    class: "solo-lectores",
    attrs: { id: `importar-audio-${etapa?.id ?? "nueva"}` },
  });

  const botonImportar = crear("label", {
    class: "boton boton--contorno",
    html: `${ICONO_IMPORTAR}<span>Importar audio</span>`,
    attrs: { for: inputImportar.id },
  });

  acciones.append(botonGrabar, botonImportar, inputImportar);
  nodo.append(acciones);

  const aviso = crear("p", {
    class: "campo__ayuda",
    text: soporteGrabacion()
      ? "El permiso de micrófono se pide únicamente al pulsar «Grabar audio». Las grabaciones son privadas y solo las ves tú."
      : "Este navegador no permite grabar audio. Puedes importar ficheros de audio existentes.",
  });
  nodo.append(aviso);

  /* ---------------- Tarjeta del grabador ---------------- */
  const tarjetaGrabador = crear("div", { class: "grabador oculto" });

  const cabeceraGrabador = crear("div", { class: "grabador__cabecera" });
  const punto = crear("span", { class: "grabador__punto" });
  const cronometro = crear("span", { class: "grabador__cronometro", text: "0:00" });
  const estadoTexto = crear("span", { class: "grabador__estado", text: "Grabando…" });
  cabeceraGrabador.append(punto, cronometro, estadoTexto);

  const barraNivel = crear("div", { class: "grabador__nivel" });
  const rellenoNivel = crear("span", { class: "grabador__relleno" });
  barraNivel.append(rellenoNivel);

  const controles = crear("div", { class: "fila" });

  const botonPausa = crear("button", {
    type: "button",
    class: "boton boton--contorno",
    html: `${ICONO_PAUSA}<span>Pausar</span>`,
  });
  const botonDetener = crear("button", {
    type: "button",
    class: "boton boton--principal",
    text: "Detener",
  });
  const botonDescartar = crear("button", {
    type: "button",
    class: "boton boton--peligro-contorno",
    text: "Descartar",
  });

  controles.append(botonPausa, botonDetener, botonDescartar);
  tarjetaGrabador.append(cabeceraGrabador, barraNivel, controles);
  nodo.append(tarjetaGrabador);

  /* ---------------- Tarjeta de guardado ---------------- */
  const tarjetaGuardar = crear("div", { class: "audio-guardar oculto" });

  const reproductorPrevia = crear("audio", {
    class: "audio-reproductor",
    attrs: { controls: true, preload: "metadata" },
  });
  reproductorPrevia.style.width = "100%";

  const resumenPrevia = crear("p", { class: "texto-pequeno texto-suave" });

  const campoTitulo = crearCampoTexto("Título", "Elige un título para la grabación");
  const campoDescripcion = crearCampoArea(
    "Descripción",
    "Anota el contexto: dónde estabas, qué se oye, con quién…",
  );
  const campoCategoria = crearCampoCategoria();

  /* Ubicación */
  const bloqueUbicacion = crear("div", { class: "audio-ubicacion" });
  const textoUbicacion = crear("span", {
    class: "audio-ubicacion__texto",
    text: "Sin ubicación",
  });
  const botonMiUbicacion = crear("button", {
    type: "button",
    class: "boton boton--contorno boton--pequeno",
    html: `${ICONO_UBICACION}<span>Usar mi ubicación</span>`,
  });
  const botonEnMapa = crear("button", {
    type: "button",
    class: "boton boton--contorno boton--pequeno",
    text: "Colocar en el mapa",
  });
  const quitarUbicacion = crear("button", {
    type: "button",
    class: "boton boton--fantasma boton--pequeno oculto",
    text: "Quitar ubicación",
  });

  bloqueUbicacion.append(
    textoUbicacion,
    crear("div", { class: "fila" }, [botonMiUbicacion, botonEnMapa, quitarUbicacion]),
  );

  const progreso = crear("progress", { class: "audio-progreso oculto" });
  progreso.max = 100;

  const errorSubida = crear("div", { class: "aviso aviso--error oculto" });

  const accionesGuardar = crear("div", { class: "fila" });
  const botonGuardar = crear("button", {
    type: "button",
    class: "boton boton--principal",
    text: "Guardar grabación",
  });
  const botonDescartarGuardado = crear("button", {
    type: "button",
    class: "boton boton--fantasma",
    text: "Descartar",
  });
  accionesGuardar.append(botonGuardar, botonDescartarGuardado);

  tarjetaGuardar.append(
    reproductorPrevia,
    resumenPrevia,
    campoTitulo.contenedor,
    campoDescripcion.contenedor,
    campoCategoria.contenedor,
    bloqueUbicacion,
    progreso,
    errorSubida,
    accionesGuardar,
  );
  nodo.append(tarjetaGuardar);

  /* ---------------- Lista ---------------- */
  const lista = crear("div", { class: "lista-audios" });
  nodo.append(lista);

  /* ================= Estado interno ================= */

  let grabador = null;
  let pendiente = null; // { blob, mimeType, duracionS, bytes, nombre, origen }
  let colaImportacion = [];
  let ubicacionPendiente = null;
  let quitarMarcadorMapa = null;
  let aoSalir = null;
  const reproductores = new Map();

  /* ================= Grabación ================= */

  botonGrabar.addEventListener("click", async () => {
    if (grabador?.estado === "grabando" || grabador?.estado === "pausado") return;

    botonGrabar.disabled = true;
    botonGrabar.textContent = "Preparando…";

    try {
      grabador = crearGrabador({
        alCambiar: ({ estado, duracion, nivel }) => {
          cronometro.textContent = formatearDuracion(duracion);
          rellenoNivel.style.width = `${Math.round(nivel * 100)}%`;

          if (estado === "grabando") {
            punto.classList.add("grabador__punto--activo");
            estadoTexto.textContent = "Grabando…";
            botonPausa.innerHTML = `${ICONO_PAUSA}<span>Pausar</span>`;
          } else if (estado === "pausado") {
            punto.classList.remove("grabador__punto--activo");
            estadoTexto.textContent = "En pausa";
            botonPausa.innerHTML = `${ICONO_REPRODUCIR}<span>Reanudar</span>`;
          }
        },
        alError: (mensaje) => {
          notificar(mensaje, "error", 7000);
        },
      });

      await grabador.iniciar();

      tarjetaGuardar.classList.add("oculto");
      pendiente = null;

      tarjetaGrabador.classList.remove("oculto");
      botonGrabar.disabled = false;
      botonGrabar.innerHTML = `${ICONO_MICROFONO}<span>Grabando…</span>`;
      botonGrabar.disabled = true;
      protegerSalida();
    } catch (error) {
      notificar(error.message, "error", 8000);
      grabador = null;
      botonGrabar.disabled = false;
      botonGrabar.innerHTML = `${ICONO_MICROFONO}<span>Grabar audio</span>`;
    }
  });

  botonPausa.addEventListener("click", () => {
    if (!grabador) return;
    if (grabador.estado === "grabando") grabador.pausar();
    else if (grabador.estado === "pausado") grabador.reanudar();
  });

  botonDetener.addEventListener("click", async () => {
    if (!grabador) return;
    botonDetener.disabled = true;
    botonPausa.disabled = true;

    try {
      const resultado = await grabador.detener();
      grabador = null;

      tarjetaGrabador.classList.add("oculto");
      botonGrabar.disabled = false;
      botonGrabar.innerHTML = `${ICONO_MICROFONO}<span>Grabar audio</span>`;
      botonDetener.disabled = false;
      botonPausa.disabled = false;

      mostrarPendiente({
        blob: resultado.blob,
        mimeType: resultado.mimeType,
        duracionS: resultado.duracionS,
        bytes: resultado.bytes,
        nombre: resultado.nombre,
        origen: "grabacion",
      });
    } catch (error) {
      notificar(error.message, "error", 7000);
      grabador = null;
      tarjetaGrabador.classList.add("oculto");
      botonGrabar.disabled = false;
      botonGrabar.innerHTML = `${ICONO_MICROFONO}<span>Grabar audio</span>`;
      botonDetener.disabled = false;
      botonPausa.disabled = false;
    }
  });

  botonDescartar.addEventListener("click", async () => {
    const ok = await confirmar({
      titulo: "Descartar la grabación",
      texto: "El audio que estás grabando se perderá y no se guardará en tu cuenta.",
      textoConfirmar: "Descartar",
      peligro: true,
    });
    if (!ok) return;

    grabador?.destruir();
    grabador = null;
    tarjetaGrabador.classList.add("oculto");
    botonGrabar.disabled = false;
    botonGrabar.innerHTML = `${ICONO_MICROFONO}<span>Grabar audio</span>`;
    notificar("Grabación descartada.", "info");
  });

  /* ================= Importación ================= */

  inputImportar.addEventListener("change", async () => {
    const archivos = Array.from(inputImportar.files ?? []);
    inputImportar.value = "";
    if (!archivos.length) return;

    colaImportacion = archivos;

    while (colaImportacion.length) {
      const archivo = colaImportacion.shift();
      const nombre = nombreNormalizado(archivo);

      const validacion = validarAudio({
        nombre: archivo.name,
        tipo: archivo.type,
        bytes: archivo.size,
      });

      if (!validacion.ok) {
        notificar(validacion.error, "error", 7000);
        continue;
      }

      const duracionS = await medirDuracion(archivo);

      const validacionDuracion = validarAudio({
        nombre: archivo.name,
        tipo: archivo.type,
        bytes: archivo.size,
        duracionS,
      });

      if (!validacionDuracion.ok) {
        notificar(validacionDuracion.error, "error", 7000);
        continue;
      }

      mostrarPendiente({
        blob: archivo,
        mimeType: archivo.type,
        duracionS,
        bytes: archivo.size,
        nombre,
        origen: "importacion",
      });

      // Espera a que el usuario guarde o descarte antes del siguiente.
      await esperarDecision();
    }
  });

  function esperarDecision() {
    return new Promise((resolver) => {
      resolutores.push(resolver);
    });
  }

  const resolutores = [];

  function resolverDecision() {
    const resolver = resolutores.shift();
    resolver?.();
  }

  /* ================= Guardado ================= */

  function mostrarPendiente(datos) {
    pendiente = datos;
    ubicacionPendiente = null;
    actualizarUbicacion();

    if (datos.blob instanceof Blob) {
      reproductorPrevia.src = URL.createObjectURL(datos.blob);
    } else {
      reproductorPrevia.removeAttribute("src");
    }

    const partes = [];
    if (datos.duracionS) partes.push(formatearDuracion(datos.duracionS));
    if (datos.bytes) partes.push(`${Math.round(datos.bytes / 1024)} KB`);
    partes.push(datos.origen === "importacion" ? "importado" : "grabado");
    resumenPrevia.textContent = partes.join(" · ");

    if (!campoTitulo.entrada.value.trim()) {
      campoTitulo.entrada.value = datos.nombre
        ? datos.nombre.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")
        : "";
    }

    errorSubida.classList.add("oculto");
    progreso.classList.add("oculto");
    tarjetaGuardar.classList.remove("oculto");
    protegerSalida();
  }

  botonDescartarGuardado.addEventListener("click", async () => {
    const ok = await confirmar({
      titulo: "Descartar la grabación",
      texto: "El audio no se guardará en tu cuenta y se perderá.",
      textoConfirmar: "Descartar",
      peligro: true,
    });
    if (!ok) return;
    limpiarPendiente();
  });

  botonGuardar.addEventListener("click", async () => {
    if (!pendiente) return;

    const validacion = validarAudio({
      nombre: pendiente.nombre,
      tipo: pendiente.mimeType,
      bytes: pendiente.bytes,
      duracionS: pendiente.duracionS,
    });

    if (!validacion.ok) {
      notificar(validacion.error, "error", 7000);
      return;
    }

    botonGuardar.disabled = true;
    botonGuardar.textContent = "Subiendo…";
    errorSubida.classList.add("oculto");
    progreso.classList.remove("oculto");
    progreso.value = 0;

    try {
      const { ruta } = await subirAudio(
        {
          userId,
          viajeId: viaje.id,
          etapaId: etapa.id,
          nombre: pendiente.nombre,
        },
        pendiente.blob,
        {
          contentType: pendiente.mimeType,
          onProgress: (fraccion) => {
            progreso.value = Math.round(fraccion * 100);
          },
        },
      );

      const registro = await crearAudio(userId, {
        viaje_id: viaje.id,
        etapa_id: etapa.id,
        path: ruta,
        nombre: pendiente.nombre,
        titulo: campoTitulo.entrada.value.trim(),
        descripcion: campoDescripcion.entrada.value,
        categoria: campoCategoria.entrada.value,
        mime_type: pendiente.mimeType,
        bytes: pendiente.bytes,
        duracion_s: pendiente.duracionS,
        lat: ubicacionPendiente?.lat ?? null,
        lon: ubicacionPendiente?.lon ?? null,
        precision_m: ubicacionPendiente?.precision ?? null,
        origen: pendiente.origen,
      });

      audios.unshift(registro);
      notificar("Grabación guardada.", "exito");
      limpiarPendiente();
      pintarLista();
      alCambiar?.(audios);
    } catch (error) {
      errorSubida.textContent = error.message;
      errorSubida.classList.remove("oculto");
    } finally {
      botonGuardar.disabled = false;
      botonGuardar.textContent = "Guardar grabación";
      progreso.classList.add("oculto");
    }
  });

  function limpiarPendiente() {
    if (pendiente?.blob instanceof Blob && reproductorPrevia.src) {
      URL.revokeObjectURL(reproductorPrevia.src);
    }
    reproductorPrevia.removeAttribute("src");
    pendiente = null;
    ubicacionPendiente = null;
    campoTitulo.entrada.value = "";
    campoDescripcion.entrada.value = "";
    campoCategoria.entrada.value = "nota";
    tarjetaGuardar.classList.add("oculto");
    quitarMarcadorMapa?.();
    quitarMarcadorMapa = null;
    resolverDecision();
    desprotegerSalida();
  }

  /* ================= Ubicación ================= */

  function actualizarUbicacion() {
    if (ubicacionPendiente) {
      textoUbicacion.textContent = `📍 ${ubicacionPendiente.lat.toFixed(5)}, ${ubicacionPendiente.lon.toFixed(5)}`;
      quitarUbicacion.classList.remove("oculto");
    } else {
      textoUbicacion.textContent = "Sin ubicación";
      quitarUbicacion.classList.add("oculto");
    }
  }

  botonMiUbicacion.addEventListener("click", async () => {
    botonMiUbicacion.disabled = true;
    try {
      const ubicacion = await pedirUbicacion({
        alError: (mensaje) => notificar(mensaje, "error", 6000),
      });
      ubicacionPendiente = ubicacion;
      actualizarUbicacion();
      dibujarMarcadorTemporal();
      notificar("Ubicación añadida a la grabación.", "exito");
    } catch {
      // El error ya se ha notificado.
    } finally {
      botonMiUbicacion.disabled = false;
    }
  });

  botonEnMapa.addEventListener("click", () => {
    const mapa = obtenerMapa?.();
    if (!mapa) {
      notificar(
        "Esta etapa no tiene un mapa GPX. Añade un fichero GPX para colocar el marcador.",
        "info",
        6000,
      );
      return;
    }

    quitarMarcadorMapa?.();

    botonEnMapa.classList.add("boton--principal");
    botonEnMapa.textContent = "Pulsa sobre el mapa…";

    quitarMarcadorMapa = mapa.alPulsarMapa((evento) => {
      const lat = Number(evento.latlng.lat.toFixed(6));
      const lon = Number(evento.latlng.lng.toFixed(6));
      ubicacionPendiente = { lat, lon, precision: null };
      actualizarUbicacion();
      dibujarMarcadorTemporal();
      quitarMarcadorMapa?.();
      quitarMarcadorMapa = null;
      botonEnMapa.classList.remove("boton--principal");
      botonEnMapa.textContent = "Colocar en el mapa";
      notificar("Marcador colocado en el mapa.", "exito");
    });

    notificar(
      "Pulsa sobre el mapa para colocar la marca de esta grabación.",
      "info",
      6000,
    );
  });

  quitarUbicacion.addEventListener("click", () => {
    ubicacionPendiente = null;
    actualizarUbicacion();
    dibujarMarcadorTemporal();
  });

  function dibujarMarcadorTemporal() {
    const mapa = obtenerMapa?.();
    if (!mapa) return;
    mapa.limpiarMarcadoresTemporales?.();
    if (!ubicacionPendiente) return;
    if (!coordenadasValidas(ubicacionPendiente.lat, ubicacionPendiente.lon)) return;
    mapa.dibujarMarcadorTemporal(ubicacionPendiente);
  }

  /* ================= Lista ================= */

  function pintarLista() {
    vaciar(lista);

    if (!audios.length) {
      lista.append(
        crear("p", {
          class: "texto-suave texto-pequeno",
          text: "Todavía no hay grabaciones en esta etapa.",
        }),
      );
      return;
    }

    for (const audio of audios) {
      const fila = crear("div", { class: "audio-item" });

      const icono = crear("span", { class: "audio-item__icono" });
      icono.innerHTML = ICONO_MICROFONO;
      fila.append(icono);

      const datos = crear("div", { class: "audio-item__datos" });
      const titulo = crear("strong", { text: audio.titulo ?? "Grabación sin título" });
      datos.append(titulo);

      const meta = crear("span", { class: "audio-item__meta" });
      const partes = [fecha(audio.creado_en)];
      if (audio.duracion_s) partes.push(formatearDuracion(audio.duracion_s));
      const categoria = CATEGORIAS_AUDIO.find((c) => c.valor === audio.categoria);
      if (categoria) partes.push(`${categoria.icono} ${categoria.etiqueta}`);
      if (Number.isFinite(audio.lat) && Number.isFinite(audio.lon)) partes.push("📍 con ubicación");
      meta.textContent = partes.join(" · ");
      datos.append(meta);

      if (audio.descripcion) {
        datos.append(crear("p", { class: "audio-item__descripcion", text: audio.descripcion }));
      }

      fila.append(datos);

      const accionesFila = crear("div", { class: "audio-item__acciones" });

      const botonReproducir = crear("button", {
        type: "button",
        class: "boton boton--contorno boton--pequeno",
        html: `${ICONO_REPRODUCIR}<span>Escuchar</span>`,
      });

      const reproductor = crear("audio", { class: "audio-reproductor oculto" });
      reproductor.controls = true;
      reproductor.preload = "none";

      botonReproducir.addEventListener("click", async () => {
        if (!reproductor.src) {
          botonReproducir.disabled = true;
          try {
            const url = await urlFirmada(audio.path, 3600);
            if (!url) throw new Error("No se ha podido generar el enlace de reproducción.");
            reproductor.src = url;
          } catch (error) {
            notificar(error.message, "error", 6000);
            botonReproducir.disabled = false;
            return;
          }
          botonReproducir.disabled = false;
        }

        reproductor.classList.toggle("oculto");
        if (reproductor.classList.contains("oculto")) {
          reproductor.pause();
          botonReproducir.innerHTML = `${ICONO_REPRODUCIR}<span>Escuchar</span>`;
        } else {
          reproductor.play().catch(() => {});
          botonReproducir.innerHTML = `${ICONO_PAUSA}<span>Pausa</span>`;
        }
      });

      reproductor.addEventListener("ended", () => {
        botonReproducir.innerHTML = `${ICONO_REPRODUCIR}<span>Escuchar</span>`;
      });

      const botonEditar = crear("button", {
        type: "button",
        class: "boton boton--contorno boton--pequeno",
        html: `${ICONO_LAPIZ}<span>Editar</span>`,
        attrs: { "aria-label": `Editar ${audio.titulo ?? "grabación"}` },
      });

      const botonBorrar = crear("button", {
        type: "button",
        class: "boton boton--peligro-contorno boton--pequeno",
        html: `${ICONO_PAPELERA}<span>Borrar</span>`,
        attrs: { "aria-label": `Borrar ${audio.titulo ?? "grabación"}` },
      });

      accionesFila.append(botonReproducir, botonEditar, botonBorrar);
      fila.append(accionesFila, reproductor);

      botonEditar.addEventListener("click", () => editarAudio(audio));
      botonBorrar.addEventListener("click", () => borrarAudio(audio));

      lista.append(fila);
    }
  }

  function editarAudio(audio) {
    const titulo = crearCampoTexto("Título", "", audio.titulo ?? "");
    const descripcion = crearCamparAreaConValor(
      "Descripción",
      "",
      audio.descripcion ?? "",
    );
    const categoria = crearCampoCategoria(audio.categoria ?? "nota");

    const error = crear("div", { class: "aviso aviso--error oculto" });

    const guardar = crear("button", {
      type: "button",
      class: "boton boton--principal",
      text: "Guardar cambios",
    });
    const cancelar = crear("button", {
      type: "button",
      class: "boton boton--contorno",
      text: "Cancelar",
    });

    const cerrar = abrirModal({
      titulo: "Editar la grabación",
      cuerpo: crear("div", {}, [
        titulo.contenedor,
        descripcion.contenedor,
        categoria.contenedor,
        error,
      ]),
      acciones: [cancelar, guardar],
    });

    cancelar.addEventListener("click", cerrar);

    guardar.addEventListener("click", async () => {
      guardar.disabled = true;
      try {
        const actualizado = await actualizarAudio(audio.id, userId, {
          titulo: titulo.entrada.value.trim() || "Grabación sin título",
          descripcion: descripcion.entrada.value,
          categoria: categoria.entrada.value,
        });
        const indice = audios.findIndex((a) => a.id === audio.id);
        if (indice >= 0) audios[indice] = actualizado;
        cerrar();
        pintarLista();
        alCambiar?.(audios);
        notificar("Grabación actualizada.", "exito");
      } catch (err) {
        error.textContent = err.message;
        error.classList.remove("oculto");
        guardar.disabled = false;
      }
    });
  }

  async function borrarAudio(audio) {
    const ok = await confirmar({
      titulo: "Eliminar la grabación",
      texto: `Se borrará «${audio.titulo ?? "esta grabación"}» de tu cuenta. Esta acción no se puede deshacer.`,
      textoConfirmar: "Eliminar",
      peligro: true,
    });
    if (!ok) return;

    try {
      await eliminarAudio(audio.id, userId);
      const indice = audios.findIndex((a) => a.id === audio.id);
      if (indice >= 0) audios.splice(indice, 1);
      pintarLista();
      alCambiar?.(audios);
      notificar("Grabación eliminada.", "exito");
    } catch (error) {
      notificar(error.message, "error", 6000);
    }
  }

  /* ================= Protección de salida ================= */

  function alCerrarVentana(evento) {
    evento.preventDefault();
    evento.returnValue = "";
    return "";
  }

  function protegerSalida() {
    if (aoSalir) return;
    aoSalir = alCerrarVentana;
    window.addEventListener("beforeunload", alCerrarVentana);
  }

  function desprotegerSalida() {
    if (!aoSalir) return;
    window.removeEventListener("beforeunload", aoSalir);
    aoSalir = null;
  }

  /* ================= Arranque ================= */

  async function cargar() {
    try {
      const listaAudios = await listarAudios(etapa.id, userId);
      audios.length = 0;
      audios.push(...listaAudios);
      pintarLista();
      alCambiar?.(audios);
    } catch (error) {
      const avisoError = crear("p", { class: "texto-pequeno texto-suave" });
      avisoError.textContent = `No se pudieron cargar las grabaciones: ${error.message}`;
      lista.append(avisoError);
    }
  }

  pintarLista();
  cargar();

  return {
    nodo,
    audios,
    tienePendientes: () => Boolean(pendiente) || grabador?.estado === "grabando" || grabador?.estado === "pausado",
    destruir: () => {
      grabador?.destruir();
      grabador = null;
      quitarMarcadorMapa?.();
      desprotegerSalida();
      for (const reproductor of reproductores.values()) reproductor.pause?.();
    },
  };
}

/* ---------------- Campos auxiliares ---------------- */

function crearCampoTexto(etiqueta, ayuda = "", valor = "") {
  const id = `audio-titulo-${Math.random().toString(36).slice(2, 8)}`;
  const entrada = crear("input", { class: "entrada", type: "text", value: valor, maxlength: 140 });
  entrada.id = id;

  const contenedor = crear("div", { class: "campo" });
  contenedor.append(
    crear("label", { class: "campo__etiqueta", text: etiqueta, attrs: { for: id } }),
    entrada,
  );
  if (ayuda) contenedor.append(crear("span", { class: "campo__ayuda", text: ayuda }));

  return { contenedor, entrada };
}

function crearCampoArea(etiqueta, ayuda = "", valor = "") {
  const id = `audio-desc-${Math.random().toString(36).slice(2, 8)}`;
  const entrada = crear("textarea", { class: "area", rows: 3, value: valor });
  entrada.id = id;
  entrada.style.minHeight = "90px";

  const contenedor = crear("div", { class: "campo" });
  contenedor.append(
    crear("label", { class: "campo__etiqueta", text: etiqueta, attrs: { for: id } }),
    entrada,
  );
  if (ayuda) contenedor.append(crear("span", { class: "campo__ayuda", text: ayuda }));

  return { contenedor, entrada };
}

function crearCamparAreaConValor(etiqueta, ayuda, valor) {
  return crearCampoArea(etiqueta, ayuda, valor);
}

function crearCampoCategoria(valor = "nota") {
  const id = `audio-cat-${Math.random().toString(36).slice(2, 8)}`;
  const entrada = crear("select", { class: "selector" });
  entrada.id = id;

  for (const categoria of CATEGORIAS_AUDIO) {
    const opcion = crear("option", { value: categoria.valor, text: `${categoria.icono} ${categoria.etiqueta}` });
    if (categoria.valor === valor) opcion.selected = true;
    entrada.append(opcion);
  }

  const contenedor = crear("div", { class: "campo" });
  contenedor.append(
    crear("label", { class: "campo__etiqueta", text: "Categoría", attrs: { for: id } }),
    entrada,
    crear("span", {
      class: "campo__ayuda",
      text: "Sirve para clasificar la grabación: nota de voz, naturaleza, ciudad, conversación u otros.",
    }),
  );

  return { contenedor, entrada };
}
