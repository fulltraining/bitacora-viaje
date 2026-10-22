/* ============================================================
   Bitácora de Viaje · views/viaje-formulario.js
   Alta y edición de viajes (incluye la fotografía de portada).
   ============================================================ */

import { crear, vaciar } from "../lib/dom.js";
import { crearCampo, ICONOS } from "./_comunes.js";
import { crearViaje, actualizarViaje, obtenerViaje } from "../store/viajes.js";
import { validarImagen, prepararImagen } from "../lib/imagen.js";
import {
  subirArchivo,
  eliminarArchivo,
  rutaArchivo,
  BUCKET_FOTOS,
} from "../lib/almacen.js";
import { navegar } from "../lib/enrutador.js";
import { notificar } from "../lib/ui.js";
import { bytes as formatearBytes } from "../lib/formato.js";

export default {
  titulo: "Viaje",

  async render({ params, sesion }) {
    const userId = sesion.usuario?.id;
    const nodo = crear("div", { class: "seccion envoltorio envoltorio--estrecho" });

    if (!userId) {
      navegar("/acceso");
      return nodo;
    }

    const esNuevo = params.id === "nuevo";
    let viaje = null;

    if (!esNuevo) {
      viaje = await obtenerViaje(params.id, userId);
      if (!viaje) {
        notificar("El viaje no existe.", "error");
        navegar("/viajes");
        return nodo;
      }
    }

    /* ---------- Encabezado ---------- */
    const cabecera = crear("div", { class: "seccion__cabecera" });
    cabecera.innerHTML = `
      <div class="seccion__titulo">
        <p class="kicker">${esNuevo ? "Nuevo" : "Edición"}</p>
        <h1>${esNuevo ? "Crear un viaje" : "Editar el viaje"}</h1>
      </div>
      <a class="enlace-sutil" href="${esNuevo ? "#/viajes" : `#/viaje/${viaje.id}`}">← Volver</a>
    `;
    nodo.append(cabecera);

    /* ---------- Formulario ---------- */
    const formulario = crear("form", { class: "formulario-viaje", attrs: { novalidate: true } });

    const campoTitulo = crearCampo({
      etiqueta: "Título del viaje",
      name: "titulo",
      valor: viaje?.titulo ?? "",
      placeholder: "Por ejemplo, Cruce de los Pirineos",
      requerido: true,
      maxlength: 120,
      autofocus: true,
    });

    const campoDestino = crearCampo({
      etiqueta: "País o destino",
      name: "destino",
      valor: viaje?.destino ?? "",
      placeholder: "España · Pirineos",
      maxlength: 120,
      ayuda: "El lugar principal de tu viaje.",
    });

    const filaFechas = crear("div", { class: "campo-fila" });
    const campoInicio = crearCampo({
      etiqueta: "Fecha de inicio",
      tipo: "date",
      name: "fecha_inicio",
      valor: viaje?.fecha_inicio ?? "",
    });
    const campoFin = crearCampo({
      etiqueta: "Fecha de finalización",
      tipo: "date",
      name: "fecha_fin",
      valor: viaje?.fecha_fin ?? "",
    });
    filaFechas.append(campoInicio.contenedor, campoFin.contenedor);

    const campoDescripcion = crearCampo({
      etiqueta: "Descripción general",
      tipo: "textarea",
      name: "descripcion",
      valor: viaje?.descripcion ?? "",
      placeholder:
        "El contexto del viaje: por qué lo hiciste, con quién, qué buscabas. Este texto encabeza el diario.",
    });

    /* ---------- Portada ---------- */
    const bloquePortada = crear("div", { class: "bloque-portada" });
    bloquePortada.append(
      crear("p", { class: "campo__etiqueta", text: "Fotografía de portada" }),
    );

    const zonaPortada = crear("div", { class: "zona-portada" });
    const previsualizacion = crear("div", { class: "zona-portada__previa" });

    const inputArchivo = crear("input", {
      type: "file",
      accept: "image/jpeg,image/png,image/webp,image/gif",
      class: "solo-lectores",
      attrs: { id: "portada-archivo" },
    });

    let portadaPreparada = null;
    let portadaQuitada = false;

    const pintarPrevia = () => {
      vaciar(previsualizacion);
      if (portadaPreparada) {
        previsualizacion.append(
          crear("img", {
            src: URL.createObjectURL(portadaPreparada.blob),
            alt: "Vista previa de la portada",
            class: "zona-portada__imagen",
          }),
        );
        previsualizacion.append(
          crear("span", {
            class: "texto-pequeno texto-suave",
            text: `${portadaPreparada.nombre} · ${formatearBytes(portadaPreparada.blob.size)}`,
          }),
        );
        return;
      }
      if (!portadaQuitada && viaje?.portada_url) {
        previsualizacion.append(
          crear("img", {
            src: viaje.portada_url,
            alt: "Portada actual",
            class: "zona-portada__imagen",
          }),
        );
        previsualizacion.append(
          crear("span", {
            class: "texto-pequeno texto-suave",
            text: "Portada actual",
          }),
        );
        return;
      }
      previsualizacion.append(
        crear("div", {
          class: "zona-portada__vacia",
          html: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONOS.foto}</svg><span>Sin portada</span>`,
        }),
      );
    };

    const etiquetaArchivo = crear("label", {
      class: "boton boton--contorno",
      text: "Elegir fotografía",
      attrs: { for: "portada-archivo" },
    });

    const botonQuitar = crear("button", {
      type: "button",
      class: "boton boton--peligro-contorno boton--pequeno oculto",
      text: "Quitar portada",
    });

    botonQuitar.addEventListener("click", () => {
      portadaPreparada = null;
      portadaQuitada = true;
      inputArchivo.value = "";
      botonQuitar.classList.add("oculto");
      pintarPrevia();
    });

    inputArchivo.addEventListener("change", async () => {
      const archivo = inputArchivo.files?.[0];
      if (!archivo) return;

      const validacion = validarImagen(archivo);
      if (!validacion.ok) {
        notificar(validacion.error, "error", 5000);
        inputArchivo.value = "";
        return;
      }

      try {
        portadaPreparada = await prepararImagen(archivo);
        portadaQuitada = false;
        botonQuitar.classList.remove("oculto");
        pintarPrevia();
      } catch (error) {
        notificar(`No se pudo procesar la imagen: ${error.message}`, "error", 5000);
      }
    });

    zonaPortada.append(previsualizacion);
    const accionesPortada = crear("div", { class: "fila" });
    accionesPortada.append(etiquetaArchivo, botonQuitar, inputArchivo);
    zonaPortada.append(accionesPortada);
    bloquePortada.append(zonaPortada);

    const ayudaPortada = crear("p", {
      class: "campo__ayuda",
      text: "JPG, PNG o WEBP de hasta 12 MB. La imagen se redimensiona automáticamente antes de subirla.",
    });
    bloquePortada.append(ayudaPortada);

    formulario.append(
      campoTitulo.contenedor,
      campoDestino.contenedor,
      filaFechas,
      campoDescripcion.contenedor,
      bloquePortada,
    );

    const aviso = crear("div", { class: "aviso aviso--error oculto" });

    const acciones = crear("div", { class: "fila fila--final formulario-viaje__acciones" });
    const botonCancelar = crear("a", {
      class: "boton boton--fantasma",
      text: "Cancelar",
      attrs: { href: esNuevo ? "#/viajes" : `#/viaje/${viaje.id}` },
    });
    const botonGuardar = crear("button", {
      type: "submit",
      class: "boton boton--principal boton--grande",
      text: esNuevo ? "Crear viaje" : "Guardar cambios",
    });
    acciones.append(botonCancelar, botonGuardar);

    formulario.append(aviso, acciones);

    /* ---------- Envío ---------- */
    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      aviso.classList.add("oculto");

      const titulo = campoTitulo.entrada.value.trim();
      const destino = campoDestino.entrada.value.trim();
      const fechaInicio = campoInicio.entrada.value;
      const fechaFin = campoFin.entrada.value;
      const descripcion = campoDescripcion.entrada.value;

      let valido = true;
      if (!titulo) {
        campoTitulo.mostrarError("El viaje necesita un título.");
        valido = false;
      } else campoTitulo.limpiarError();

      if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
        campoFin.mostrarError("La fecha final no puede ser anterior a la inicial.");
        valido = false;
      } else campoFin.limpiarError();

      if (!valido) return;

      botonGuardar.disabled = true;
      botonGuardar.textContent = esNuevo ? "Creando…" : "Guardando…";

      try {
        let portadaUrl = viaje?.portada_url ?? null;
        let portadaPath = viaje?.portada_path ?? null;

        if (portadaPreparada) {
          const ruta = rutaArchivo({
            userId,
            viajeId: esNuevo ? "nuevo" : viaje.id,
            prefijo: "portada",
            nombre: portadaPreparada.nombre,
          });
          const subida = await subirArchivo(
            BUCKET_FOTOS,
            ruta,
            portadaPreparada.blob,
            portadaPreparada.tipo,
          );
          portadaUrl = subida.url;
          portadaPath = subida.ruta;
        } else if (portadaQuitada) {
          portadaUrl = null;
          portadaPath = null;
        }

        const datos = {
          titulo,
          destino,
          fecha_inicio: fechaInicio || null,
          fecha_fin: fechaFin || null,
          descripcion,
          portada_url: portadaUrl,
          portada_path: portadaPath,
        };

        if (esNuevo) {
          const nuevo = await crearViaje(userId, datos);
          notificar("¡Viaje creado! Ya puedes añadir sus etapas.", "exito");
          navegar(`/viaje/${nuevo.id}`);
        } else {
          await actualizarViaje(viaje.id, userId, datos);

          if (portadaPath && viaje.portada_path && portadaPath !== viaje.portada_path) {
            await eliminarArchivo(BUCKET_FOTOS, viaje.portada_path).catch(() => {});
          }
          if (portadaQuitada && viaje.portada_path) {
            await eliminarArchivo(BUCKET_FOTOS, viaje.portada_path).catch(() => {});
          }

          notificar("Viaje actualizado.", "exito");
          navegar(`/viaje/${viaje.id}`);
        }
      } catch (error) {
        aviso.textContent = error.message;
        aviso.classList.remove("oculto");
        botonGuardar.disabled = false;
        botonGuardar.textContent = esNuevo ? "Crear viaje" : "Guardar cambios";
      }
    });

    nodo.append(formulario);

    pintarPrevia();

    return nodo;
  },
};
