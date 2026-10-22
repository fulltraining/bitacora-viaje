/* ============================================================
   Bitácora de Viaje · views/etapa.js
   Etapa de un viaje: datos, diario, galería de fotos y ruta GPX.
   ============================================================ */

import { crear, vaciar, sanearNombre } from "../lib/dom.js";
import { crearCampo, ICONOS } from "./_comunes.js";
import { obtenerViaje } from "../store/viajes.js";
import { crearPanelAudio } from "./_audio.js";
import {
  listarEtapas,
  obtenerEtapa,
  crearEtapa,
  actualizarEtapa,
  eliminarEtapa,
  siguienteNumero,
} from "../store/etapas.js";
import { listarFotografias, crearFotografia, actualizarFotografia, eliminarFotografia } from "../store/fotografias.js";
import { validarImagen, prepararImagen } from "../lib/imagen.js";
import { analizarGpx } from "../lib/gpx.js";
import {
  subirArchivo,
  eliminarArchivo,
  rutaArchivo,
  BUCKET_FOTOS,
  BUCKET_GPX,
} from "../lib/almacen.js";
import { navegar } from "../lib/enrutador.js";
import { confirmar, notificar, abrirVisor, abrirModal, botonIcono } from "../lib/ui.js";
import { fecha, distancia, ascension, duracion } from "../lib/formato.js";
import { crearMapa, dibujarPerfilElevacion, COLOR_ETAPA } from "../lib/mapa.js";
import { perfilDesdeGeojson } from "../lib/gpx.js";

const TAMANO_MAX_GPX = 12 * 1024 * 1024;

export default {
  titulo: "Etapa",

  async render({ params, sesion }) {
    const userId = sesion.usuario?.id;
    const viajeId = params.id;
    const etapaId = params.etapaId;

    const nodo = crear("div", { class: "pagina-etapa" });

    if (!userId) {
      navegar("/acceso");
      return nodo;
    }

    const viaje = await obtenerViaje(viajeId, userId);
    if (!viaje) {
      notificar("El viaje no existe.", "error");
      navegar("/viajes");
      return nodo;
    }

    const esNueva = etapaId === "nueva";
    let etapa = null;

    if (!esNueva) {
      etapa = await obtenerEtapa(etapaId, userId);
      if (!etapa) {
        notificar("La etapa no existe.", "error");
        navegar(`/viaje/${viajeId}`);
        return nodo;
      }
    }

    const fotos = esNueva ? [] : await listarFotografias(etapa.id, userId);

    /* ================= Estado editable ================= */
    let modoEdicion = esNueva;

    /* ================= Contenedor ================= */
    const cabecera = crear("header", { class: "etapa-cabecera envoltorio" });
    const cuerpo = crear("div", { class: "etapa-cuerpo envoltorio envoltorio--estrecho" });

    const migas = crear("nav", { class: "migas", attrs: { "aria-label": "Ruta de navegación" } });
    migas.innerHTML = `
      <a href="#/viajes">Mis viajes</a>
      <span aria-hidden="true">/</span>
      <a href="#/viaje/${viaje.id}">${escapar(viaje.titulo || "Viaje")}</a>
      <span aria-hidden="true">/</span>
      <span aria-current="page">${esNueva ? "Nueva etapa" : `Etapa ${etapa.numero ?? ""}`}</span>
    `;
    cabecera.append(migas);

    const zonaTitulo = crear("div", { class: "etapa-cabecera__principal" });
    const tituloH = crear("h1", { class: "etapa-cabecera__titulo" });
    const acciones = crear("div", { class: "etapa-cabecera__acciones" });
    zonaTitulo.append(tituloH, acciones);
    cabecera.append(zonaTitulo);

    nodo.append(cabecera, cuerpo);

    /* ================= Campos ================= */
    const campoNumero = crearCampo({
      etiqueta: "Número de etapa",
      tipo: "number",
      name: "numero",
      valor: String(etapa?.numero ?? (await siguienteNumero(viajeId, userId))),
      min: 1,
      max: 999,
    });
    const campoFecha = crearCampo({
      etiqueta: "Fecha",
      tipo: "date",
      name: "fecha",
      valor: etapa?.fecha ?? "",
    });
    const campoTitulo = crearCampo({
      etiqueta: "Título de la etapa",
      name: "titulo",
      valor: etapa?.titulo ?? "",
      placeholder: "Por ejemplo, Del refugio de Benasque al Ibón de Estanés",
      maxlength: 140,
    });
    const campoSalida = crearCampo({
      etiqueta: "Lugar de salida",
      name: "salida",
      valor: etapa?.salida ?? "",
      placeholder: "Benasque",
      maxlength: 120,
    });
    const campoLlegada = crearCampo({
      etiqueta: "Lugar de llegada",
      name: "llegada",
      valor: etapa?.llegada ?? "",
      placeholder: "Estanés de Conca",
      maxlength: 120,
    });
    const campoDiario = crearCampo({
      etiqueta: "Diario de la etapa",
      tipo: "textarea",
      name: "diario",
      valor: etapa?.diario ?? "",
      placeholder:
        "Escribe el relato del día: por dónde empezaste, con quién, qué comiste, lo que hizo el tiempo…",
    });
    campoDiario.entrada.classList.add("area--diario");

    const filaNumeroFecha = crear("div", { class: "campo-fila" });
    filaNumeroFecha.append(campoNumero.contenedor, campoFecha.contenedor);

    const filaLugares = crear("div", { class: "campo-fila" });
    filaLugares.append(campoSalida.contenedor, campoLlegada.contenedor);

    const seccionDatos = crear("section", { class: "bloque bloque--editable" });
    seccionDatos.append(filaNumeroFecha, campoTitulo.contenedor, filaLugares);

    /* ================= Lectura ================= */
    const seccionLectura = crear("section", { class: "bloque bloque--lectura" });

    function pintarLectura() {
      vaciar(seccionLectura);

      const numero_ = etapa?.numero ?? (Number.parseInt(campoNumero.entrada.value, 10) || 1);
      const fechaValor = etapa?.fecha ?? campoFecha.entrada.value ?? "";
      const tituloValor = etapa?.titulo ?? campoTitulo.entrada.value ?? "";
      const salidaValor = etapa?.salida ?? campoSalida.entrada.value ?? "";
      const llegadaValor = etapa?.llegada ?? campoLlegada.entrada.value ?? "";
      const diarioValor = etapa?.diario ?? campoDiario.entrada.value ?? "";

      const meta = crear("div", { class: "etapa-lectura__meta" });
      if (fechaValor) {
        meta.append(
          crear("span", {
            class: "distintivo",
            html: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">${ICONOS.calendario}</svg> ${fecha(fechaValor)}`,
          }),
        );
      }
      if (salidaValor || llegadaValor) {
        meta.append(
          crear("span", {
            class: "distintivo distintivo--verde",
            html: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">${ICONOS.lugar}</svg> ${salidaValor || "?"} → ${llegadaValor || "?"}`,
          }),
        );
      }
      if (etapa?.distancia_m) {
        meta.append(crear("span", { class: "distintivo", text: distancia(etapa.distancia_m) }));
      }
      if (etapa?.ascenso_m) {
        meta.append(
          crear("span", { class: "distintivo", text: ascension(etapa.ascenso_m) }),
        );
      }
      if (etapa?.duracion_s) {
        meta.append(crear("span", { class: "distintivo", text: duracion(etapa.duracion_s) }));
      }
      seccionLectura.append(meta);

      if (tituloValor) {
        seccionLectura.append(crear("h2", { class: "etapa-lectura__titulo", text: tituloValor }));
      }

      if (diarioValor) {
        const parrafo = crear("p", { class: "parrafo-editorial etapa-lectura__diario" });
        parrafo.textContent = diarioValor;
        seccionLectura.append(parrafo);
      } else if (!modoEdicion) {
        seccionLectura.append(
          crear("p", {
            class: "texto-suave",
            text: "Esta etapa todavía no tiene diario. Pulsa «Editar» para escribir el relato del día.",
          }),
        );
      }
    }

    /* ================= Galería ================= */
    const seccionGaleria = crear("section", { class: "bloque" });

    /* ================= Audio ================= */
    const seccionAudio = crear("section", { class: "bloque" });
    let panelAudio = null;
    let audiosEtapa = [];
    let mapaGpxComponente = null;
    let capaAudios = null;

    async function pintarAudio() {
      vaciar(seccionAudio);
      panelAudio?.destruir?.();
      panelAudio = null;

      if (!etapa) {
        seccionAudio.append(
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
        seccionAudio.append(
          crear("p", {
            class: "texto-suave texto-pequeno",
            text: "Guarda la etapa para poder grabar o importar audios.",
          }),
        );
        return;
      }

      panelAudio = crearPanelAudio({
        userId,
        viaje,
        etapa,
        obtenerMapa: () => mapaGpxComponente,
        alCambiar: (lista) => {
          audiosEtapa = lista;
          actualizarIconosAudio();
        },
      });

    function actualizarIconosAudio() {
      if (!mapaGpxComponente) return;
      capaAudios?.remove?.();
      capaAudios = mapaGpxComponente.dibujarAudios(audiosEtapa, {
        alPulsar: (audio) => {
          notificar(audio.titulo ?? "Grabación", "info", 2500);
        },
      });
    }

    /* ================= GPX ================= */
    const seccionGpx = crear("section", { class: "bloque" });

    /** Mapas de Leaflet creados en esta vista (se destruyen al salir). */
    const componentesMapa = [];

    /* ================= Avisos y acciones ================= */
    const aviso = crear("div", { class: "aviso aviso--error oculto" });
    const barraAcciones = crear("div", { class: "barra-guardar oculto" });

    const botonGuardar = crear("button", {
      type: "button",
      class: "boton boton--principal",
      text: "Guardar etapa",
    });
    const botonCancelar = crear("button", {
      type: "button",
      class: "boton boton--fantasma",
      text: "Cancelar",
    });
    const botonEliminar = crear("button", {
      type: "button",
      class: "boton boton--peligro-contorno",
      text: "Eliminar etapa",
    });
    barraAcciones.append(botonEliminar, crear("span", { class: "espacio" }), botonCancelar, botonGuardar);

    cuerpo.append(seccionLectura, seccionDatos, seccionGaleria, seccionAudio, seccionGpx, aviso, barraAcciones);

    /* ================= Lógica ================= */

    function pintarCabecera() {
      vaciar(tituloH);
      tituloH.append(
        crear("span", {
          class: "etapa-cabecera__numero",
          text: `Etapa ${String(etapa?.numero ?? campoNumero.entrada.value ?? 1).padStart(2, "0")}`,
        }),
      );
      tituloH.append(
        crear("span", {
          text:
            etapa?.titulo ||
            campoTitulo.entrada.value ||
            (esNueva ? "Nueva etapa" : "Etapa"),
        }),
      );

      vaciar(acciones);
      if (!esNueva && !modoEdicion) {
        acciones.append(
          crear("button", {
            type: "button",
            class: "boton boton--contorno",
            html: `<svg class="boton__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">${ICONOS.lapiz}</svg><span>Editar</span>`,
            on: { click: () => cambiarModo(true) },
          }),
        );
      }
    }

    async function cambiarModo(editar) {
      modoEdicion = editar;
      seccionDatos.classList.toggle("oculto", !modoEdicion);
      seccionLectura.classList.toggle("oculto", modoEdicion);
      barraAcciones.classList.toggle("oculto", !modoEdicion);

      for (const campo of [campoNumero, campoFecha, campoTitulo, campoSalida, campoLlegada, campoDiario]) {
        campo.contenedor.classList.toggle("oculto", !modoEdicion);
      }

      pintarCabecera();
      pintarLectura();
      await pintarGaleria();
      await pintarAudio();
    }

    /* ---------- Galería ---------- */
    async function pintarGaleria() {
      vaciar(seccionGaleria);

      seccionGaleria.append(
        crear("div", {
          class: "bloque__cabecera",
          html: `
            <div>
              <p class="kicker">Galería</p>
              <h2>Fotografías</h2>
            </div>
          `,
        }),
      );

      const entrada = crear("input", {
        type: "file",
        accept: "image/jpeg,image/png,image/webp,image/gif",
        multiple: true,
        class: "solo-lectores",
        attrs: { id: "fotos-archivo" },
      });

      const botonAnadir = crear("label", {
        class: "boton boton--acento",
        html: `<svg class="boton__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONOS.mas}</svg><span>Añadir fotografías</span>`,
        attrs: { for: "fotos-archivo" },
      });

      const estado = crear("div", { class: "galeria__estado texto-pequeno texto-suave" });

      const rejilla = crear("div", { class: "galeria" });

      if (!fotos.length) {
        rejilla.append(
          crear("p", {
            class: "texto-suave texto-pequeno",
            text: "Todavía no hay fotografías en esta etapa.",
          }),
        );
      }

      fotos.forEach((foto, indice) => {
        const figura = crear("figure", { class: "miniatura-miniatura" });
        const marco = crear("button", {
          type: "button",
          class: "miniatura miniatura--grande",
          attrs: { "aria-label": `Ampliar fotografía ${indice + 1}` },
          on: {
            click: () =>
              abrirVisor(
                fotos.map((f) => ({ url: f.url, pie: f.pie })),
                indice,
              ),
          },
        });
        marco.append(crear("img", { src: foto.url, alt: foto.pie || "", loading: "lazy" }));
        figura.append(marco);

        const pie = crear("figcaption", { class: "miniatura-miniatura__pie" });
        pie.textContent = foto.pie || "Sin pie de foto";
        figura.append(pie);

        const herramientas = crear("div", { class: "miniatura-miniatura__acciones" });
        herramientas.append(
          botonIcono(
            ICONOS.lapiz,
            "Editar pie de foto",
            () => editarPie(foto),
            "boton boton--contorno boton--pequeno",
          ),
          botonIcono(
            ICONOS.papelera,
            "Eliminar fotografía",
            () => borrarFoto(foto),
            "boton boton--peligro-contorno boton--pequeno",
          ),
        );
        figura.append(herramientas);

        rejilla.append(figura);
      });

      seccionGaleria.append(rejilla, estado);
      seccionGaleria.append(crear("div", { class: "fila" }), botonAnadir, entrada);

      entrada.addEventListener("change", async () => {
        const archivos = Array.from(entrada.files ?? []);
        entrada.value = "";
        if (!archivos.length) return;

        if (!etapa) {
          notificar("Guarda la etapa antes de añadir fotografías.", "info");
          return;
        }

        let anadidas = 0;
        const rechazadas = [];

        for (const archivo of archivos) {
          const validacion = validarImagen(archivo);
          if (!validacion.ok) {
            rechazadas.push(`${archivo.name}: ${validacion.error}`);
            continue;
          }

          estado.textContent = `Subiendo ${anadidas + 1} de ${archivos.length}…`;

          try {
            const preparada = await prepararImagen(archivo);
            const ruta = rutaArchivo({
              userId,
              viajeId: viaje.id,
              etapaId: etapa.id,
              nombre: `${sanearNombre(preparada.nombre)}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 7)}.${preparada.tipo === "image/png" ? "png" : "jpg"}`,
            });

            const subida = await subirArchivo(BUCKET_FOTOS, ruta, preparada.blob, preparada.tipo);

            const nueva = await crearFotografia(userId, {
              viaje_id: viaje.id,
              etapa_id: etapa.id,
              path: subida.ruta,
              url: subida.url,
              nombre: archivo.name,
              pie: "",
              ancho: preparada.ancho,
              alto: preparado.alto,
              bytes: preparada.blob.size,
              orden: fotos.length + anadidas,
            });

            fotos.push(nueva);
            anadidas += 1;
          } catch (error) {
            rechazadas.push(`${archivo.name}: ${error.message}`);
          }
        }

        if (anadidas) {
          notificar(`${anadidas} fotografía${anadidas === 1 ? "" : "s"} añadida${anadidas === 1 ? "" : "s"}.`, "exito");
        }
        if (rechazadas.length) {
          notificar(rechazadas[0], "error", 7000);
        }

        estado.textContent = "";
        await pintarGaleria();
      });
    }

    function editarPie(foto) {
      const area = crear("textarea", { class: "area", rows: 4 });
      area.value = foto.pie ?? "";
      area.placeholder = "Describe la fotografía…";

      const error = crear("div", { class: "aviso aviso--error oculto" });

      const guardar = crear("button", {
        type: "button",
        class: "boton boton--principal",
        text: "Guardar pie",
      });
      const cancelar = crear("button", {
        type: "button",
        class: "boton boton--contorno",
        text: "Cancelar",
      });

      const cerrar = abrirModal({
        titulo: "Pie de la fotografía",
        texto: "Este texto aparecerá bajo la imagen y en el visor ampliado.",
        cuerpo: crear("div", {}, [area, error]),
        acciones: [cancelar, guardar],
      });

      cancelar.addEventListener("click", cerrar);

      guardar.addEventListener("click", async () => {
        guardar.disabled = true;
        try {
          const actualizada = await actualizarFotografia(foto.id, userId, {
            pie: area.value.trim(),
          });
          const indice = fotos.findIndex((f) => f.id === foto.id);
          if (indice >= 0) fotos[indice] = actualizada;
          cerrar();
          await pintarGaleria();
        } catch (err) {
          error.textContent = err.message;
          error.classList.remove("oculto");
          guardar.disabled = false;
        }
      });

      setTimeout(() => area.focus(), 60);
    }

    async function borrarFoto(foto) {
      const ok = await confirmar({
        titulo: "Eliminar fotografía",
        texto: "Se borrará la imagen de tu cuenta. Esta acción no se puede deshacer.",
        textoConfirmar: "Eliminar",
        peligro: true,
      });
      if (!ok) return;

      try {
        await eliminarFotografia(foto.id, userId);
        const indice = fotos.findIndex((f) => f.id === foto.id);
        if (indice >= 0) fotos.splice(indice, 1);
        notificar("Fotografía eliminada.", "exito");
        await pintarGaleria();
      } catch (error) {
        notificar(error.message, "error", 6000);
      }
    }

    /* ---------- GPX ---------- */
    async function pintarGpx() {
      vaciar(seccionGpx);

      seccionGpx.append(
        crear("div", {
          class: "bloque__cabecera",
          html: `
            <div>
              <p class="kicker">Ruta</p>
              <h2>Fichero GPX</h2>
            </div>
          `,
        }),
      );

      if (!etapa) {
        seccionGpx.append(
          crear("p", {
            class: "texto-suave texto-pequeno",
            text: "Guarda la etapa para poder adjuntar el fichero GPX de la ruta.",
          }),
        );
        return;
      }

      const entrada = crear("input", {
        type: "file",
        accept: ".gpx,application/gpx+xml,text/xml",
        class: "solo-lectores",
        attrs: { id: "gpx-archivo" },
      });

      const boton = crear("label", {
        class: "boton boton--contorno",
        html: `<svg class="boton__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS.gpx}</svg><span>${etapa.gpx_path ? "Sustituir GPX" : "Importar GPX"}</span>`,
        attrs: { for: "gpx-archivo" },
      });

      seccionGpx.append(crear("div", { class: "fila" }), boton, entrada);

      if (!etapa.gpx_path) {
        seccionGpx.append(
          crear("p", {
            class: "campo__ayuda",
            text: "Fichero .gpx exportado del GPS. Se valida, se dibuja en el mapa y se guardan distancia, desnivel y perfil de elevación.",
          }),
        );
        return;
      }

      /* Datos del recorrido */
      const datos = crear("div", { class: "panel-mapa__datos" });
      const definiciones = [
        ["Distancia", distancia(etapa.distancia_m)],
        ["Ascenso", etapa.ascenso_m ? ascension(etapa.ascenso_m) : "—"],
        ["Descenso", etapa.descenso_m ? ascension(-etapa.descenso_m) : "—"],
        ["Duración", etapa.duracion_s ? duracion(etapa.duracion_s) : "—"],
      ];
      for (const [etiqueta, valor] of definiciones) {
        const bloque = crear("div", { class: "dato" });
        bloque.append(crear("span", { class: "dato__etiqueta", text: etiqueta }));
        bloque.append(crear("strong", { class: "dato__valor", text: valor }));
        datos.append(bloque);
      }
      seccionGpx.append(datos);

      /* Mapa */
      if (etapa.puntos_gpx?.features?.length) {
        const mapaContenedor = crear("div", { class: "panel-mapa__mapa panel-mapa__mapa--etapa" });
        seccionGpx.append(mapaContenedor);

        const perfilContenedor = crear("div", { class: "panel-mapa__perfil" });
        seccionGpx.append(perfilContenedor);

        setTimeout(() => {
          const componente = crearMapa(mapaContenedor);
          componentesMapa.push(componente);
          mapaGpxComponente = componente;
          componente.dibujarRuta(etapa.puntos_gpx, { color: COLOR_ETAPA, peso: 4.2 });

          const coords = etapa.puntos_gpx.features.flatMap((f) => f.geometry?.coordinates ?? []);
          if (coords.length >= 2) {
            componente.dibujarExtremos(
              { lat: coords[0][1], lon: coords[0][0] },
              { lat: coords[coords.length - 1][1], lon: coords[coords.length - 1][0] },
            );
            componente.ajustar([
              [Math.min(...coords.map((c) => c[1])), Math.min(...coords.map((c) => c[0]))],
              [Math.max(...coords.map((c) => c[1])), Math.max(...coords.map((c) => c[0]))],
            ]);
          }
          componente.invalidar();
          actualizarIconosAudio();

          const perfil = perfilDesdeGeojson(etapa.puntos_gpx);
          if (perfil.length) {
            perfilContenedor.append(
              crear("h4", { class: "panel-mapa__perfil-titulo", text: "Perfil de elevación" }),
            );
            dibujarPerfilElevacion(perfilContenedor, perfil, { altura: 180 });
          }
        }, 0);
      }

      /* Enlaces */
      const enlaces = crear("div", { class: "fila" });
      if (etapa.gpx_url) {
        enlaces.append(
          crear("a", {
            class: "boton boton--fantasma boton--pequeno",
            text: "Descargar el GPX original",
            attrs: { href: etapa.gpx_url, target: "_blank", rel: "noopener" },
          }),
        );
      }
      enlaces.append(
        crear("button", {
          type: "button",
          class: "boton boton--peligro-contorno boton--pequeno",
          text: "Quitar el GPX",
          on: {
            click: async () => {
              const ok = await confirmar({
                titulo: "Quitar el fichero GPX",
                texto: "Se eliminará la ruta guardada en esta etapa. Los datos del diario y las fotografías se conservan.",
                textoConfirmar: "Quitar",
                peligro: true,
              });
              if (!ok) return;
              try {
                await actualizarEtapa(etapa.id, userId, {
                  gpx_path: null,
                  gpx_url: null,
                  distancia_m: null,
                  ascenso_m: null,
                  descenso_m: null,
                  duracion_s: null,
                  con_altitud: false,
                  puntos_gpx: null,
                });
                if (etapa.gpx_path) await eliminarArchivo(BUCKET_GPX, etapa.gpx_path).catch(() => {});
                etapa = { ...etapa, gpx_path: null, gpx_url: null, puntos_gpx: null };
                notificar("Fichero GPX eliminado.", "exito");
                await pintarGpx();
              } catch (error) {
                notificar(error.message, "error", 6000);
              }
            },
          },
        }),
      );
      seccionGpx.append(enlaces);

      /* Subida */
      entrada.addEventListener("change", async () => {
        const archivo = entrada.files?.[0];
        entrada.value = "";
        if (!archivo) return;

        if (!/\.gpx$/i.test(archivo.name)) {
          notificar("El fichero debe tener extensión .gpx.", "error");
          return;
        }
        if (archivo.size > TAMANO_MAX_GPX) {
          notificar("El fichero GPX supera el tamaño máximo (12 MB).", "error");
          return;
        }

      boton.textContent = "Procesando…";

      try {
          const texto = await archivo.text();
          const analisis = analizarGpx(texto);

          const ruta = rutaArchivo({
            userId,
            viajeId: viaje.id,
            etapaId: etapa.id,
            nombre: `${sanearNombre(archivo.name)}-${Date.now()}.gpx`,
          });

          const subida = await subirArchivo(
            BUCKET_GPX,
            ruta,
            new Blob([texto], { type: "application/gpx+xml" }),
            "application/gpx+xml",
          );

          const actualizado = await actualizarEtapa(etapa.id, userId, {
            gpx_path: subida.ruta,
            gpx_url: subida.url,
            distancia_m: Math.round(analisis.distancia),
            ascenso_m: Math.round(analisis.ascenso),
            descenso_m: Math.round(analisis.descenso),
            duracion_s: analisis.duracion,
            con_altitud: analisis.conAltitud,
            puntos_gpx: analisis.geojson,
          });

          if (etapa.gpx_path && etapa.gpx_path !== subida.ruta) {
            await eliminarArchivo(BUCKET_GPX, etapa.gpx_path).catch(() => {});
          }

          etapa = actualizado;
          notificar(
            `Ruta importada: ${distancia(analisis.distancia)}${
              analisis.conAltitud ? ` · ${ascension(analisis.ascenso)}` : ""
            }.`,
            "exito",
            5000,
          );
          await pintarGpx();
          actualizarIconosAudio();
        } catch (error) {
          notificar(error.message, "error", 8000);
          await pintarGpx();
        }
      });
    }

    /* ---------- Guardar / cancelar ---------- */
    botonGuardar.addEventListener("click", async () => {
      aviso.classList.add("oculto");

      const titulo = campoTitulo.entrada.value.trim();
      if (!titulo) {
        campoTitulo.mostrarError("La etapa necesita un título.");
        return;
      }
      campoTitulo.limpiarError();

      const datos = {
        numero: Number.parseInt(campoNumero.entrada.value, 10) || 1,
        fecha: campoFecha.entrada.value || null,
        titulo,
        salida: campoSalida.entrada.value.trim(),
        llegada: campoLlegada.entrada.value.trim(),
        diario: campoDiario.entrada.value,
      };

      botonGuardar.disabled = true;
      botonGuardar.textContent = "Guardando…";

      try {
        if (esNueva) {
          etapa = await crearEtapa(userId, viajeId, datos);
          notificar("Etapa creada.", "exito");
          navegar(`/viaje/${viajeId}/etapa/${etapa.id}`, { reemplazar: true });
          return;
        }

        etapa = await actualizarEtapa(etapa.id, userId, datos);
        modoEdicion = false;
        cambiarModo(false);
        notificar("Etapa guardada.", "exito");
      } catch (error) {
        aviso.textContent = error.message;
        aviso.classList.remove("oculto");
      } finally {
        botonGuardar.disabled = false;
        botonGuardar.textContent = "Guardar etapa";
      }
    });

    botonCancelar.addEventListener("click", () => {
      if (esNueva) {
        navegar(`/viaje/${viajeId}`);
        return;
      }
      campoNumero.entrada.value = String(etapa.numero ?? 1);
      campoFecha.entrada.value = etapa.fecha ?? "";
      campoTitulo.entrada.value = etapa.titulo ?? "";
      campoSalida.entrada.value = etapa.salida ?? "";
      campoLlegada.entrada.value = etapa.llegada ?? "";
      campoDiario.entrada.value = etapa.diario ?? "";
      modoEdicion = false;
      cambiarModo(false);
    });

    botonEliminar.addEventListener("click", async () => {
      if (esNueva) return;
      const ok = await confirmar({
        titulo: "Eliminar la etapa",
        texto: `Se borrarán el diario, las fotografías y el fichero GPX de la etapa ${etapa.numero}.`,
        textoConfirmar: "Eliminar etapa",
        peligro: true,
      });
      if (!ok) return;

      try {
        await eliminarEtapa(etapa.id, userId);
        notificar("Etapa eliminada.", "exito");
        navegar(`/viaje/${viajeId}`);
      } catch (error) {
        notificar(error.message, "error", 6000);
      }
    });

    /* ================= Dibujar ================= */
    pintarCabecera();
    pintarLectura();
    await pintarGaleria();
    await pintarAudio();
    await pintarGpx();
    actualizarIconosAudio();
    await cambiarModo(modoEdicion);

        nodo.alSalir = () => {
      for (const componente of componentesMapa) componente.destruir();
      componentesMapa.length = 0;
      panelAudio?.destruir?.();
      capaAudios?.remove?.();
    };

    return nodo;
};

function escapar(valor) {
  const div = document.createElement("div");
  div.textContent = valor ?? "";
  return div.innerHTML;
}
}
}
