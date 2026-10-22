/* ============================================================
   Bitácora de Viaje · views/perfil.js
   Perfil del usuario: nombre, avatar, estadísticas y cierre de sesión.
   ============================================================ */

import { crear, vaciar } from "../lib/dom.js";
import { ICONOS } from "./_comunes.js";
import { actualizarPerfil, subirAvatar, cerrarSesion, obtenerEstado } from "../store/sesion.js";
import { listarViajes } from "../store/viajes.js";
import { exigirSupabase } from "../lib/supabase.js";
import { validarImagen, prepararImagen } from "../lib/imagen.js";
import { navegar } from "../lib/enrutador.js";
import { notificar, confirmar } from "../lib/ui.js";
import { iniciales, fecha, rangoFechas, numero } from "../lib/formato.js";

export default {
  titulo: "Mi perfil",

  async render({ sesion }) {
    const usuario = sesion.usuario;
    const nodo = crear("div", { class: "seccion envoltorio" });

    if (!usuario) {
      navegar("/acceso");
      return nodo;
    }

    const perfil = sesion.perfil;

    /* ---------- Cabecera ---------- */
    const cabecera = crear("header", { class: "perfil-cabecera" });
    const avatar = crear("div", { class: "avatar" });
    if (perfil?.avatar_url) {
      avatar.append(crear("img", { src: perfil.avatar_url, alt: "Tu avatar" }));
    } else {
      avatar.append(crear("span", { text: iniciales(perfil?.nombre ?? usuario.email) }));
    }

    const datos = crear("div", { class: "perfil-cabecera__datos" });
    datos.append(
      crear("p", { class: "kicker", text: "Mi perfil" }),
      crear("h1", { class: "perfil-cabecera__nombre", text: perfil?.nombre || "Viajero" }),
      crear("p", { class: "perfil-cabecera__correo", text: usuario.email }),
    );

    const acciones = crear("div", { class: "perfil-cabecera__acciones" });

    const inputAvatar = crear("input", {
      type: "file",
      accept: "image/jpeg,image/png,image/webp",
      class: "solo-lectores",
      attrs: { id: "avatar-archivo" },
    });

    const botonAvatar = crear("label", {
      class: "boton boton--contorno boton--pequeno",
      text: "Cambiar foto",
      attrs: { for: "avatar-archivo" },
    });

    const botonSalir = crear("button", {
      type: "button",
      class: "boton boton--peligro-contorno boton--pequeno",
      html: `<svg class="boton__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS.salir}</svg><span>Cerrar sesión</span>`,
    });

    acciones.append(botonAvatar, botonSalir, inputAvatar);

    cabecera.append(avatar, datos, acciones);
    nodo.append(cabecera);

    /* ---------- Avatar ---------- */
    inputAvatar.addEventListener("change", async () => {
      const archivo = inputAvatar.files?.[0];
      inputAvatar.value = "";
      if (!archivo) return;

      const validacion = validarImagen(archivo);
      if (!validacion.ok) {
        notificar(validacion.error, "error", 5000);
        return;
      }

      try {
        const preparada = await prepararImagen(archivo);
        await subirAvatar(preparada.blob);
        notificar("Foto de perfil actualizada.", "exito");
        const nuevaUrl = obtenerEstado().perfil?.avatar_url ?? null;
        if (nuevaUrl) avatar.replaceChildren(crear("img", { src: nuevaUrl, alt: "Tu avatar" }));
      } catch (error) {
        notificar(error.message, "error", 6000);
      }
    });

    /* ---------- Nombre ---------- */
    const seccionNombre = crear("section", { class: "bloque" });
    seccionNombre.append(
      crear("div", {
        class: "bloque__cabecera",
        html: `<div><p class="kicker">Datos</p><h2>Tu nombre</h2></div>`,
      }),
    );

    const formularioNombre = crear("form", { class: "fila", attrs: { novalidate: true } });
    const campoNombre = crear("input", {
      class: "entrada",
      type: "text",
      value: perfil?.nombre ?? "",
      maxlength: 80,
      placeholder: "Tu nombre",
      attrs: { "aria-label": "Tu nombre" },
    });
    campoNombre.style.maxWidth = "320px";
    const botonGuardar = crear("button", {
      type: "submit",
      class: "boton boton--principal",
      text: "Guardar",
    });
    formularioNombre.append(campoNombre, botonGuardar);

    formularioNombre.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const nombre = campoNombre.value.trim();
      if (!nombre) {
        notificar("El nombre no puede quedar vacío.", "error");
        return;
      }
      botonGuardar.disabled = true;
      try {
        await actualizarPerfil({ nombre });
        notificar("Nombre actualizado.", "exito");
        const titulo = cabecera.querySelector(".perfil-cabecera__nombre");
        if (titulo) titulo.textContent = nombre;
      } catch (error) {
        notificar(error.message, "error", 6000);
      } finally {
        botonGuardar.disabled = false;
      }
    });

    seccionNombre.append(formularioNombre);
    nodo.append(seccionNombre);

    /* ---------- Estadísticas ---------- */
    const [viajes, etapas, fotos] = await Promise.all([
      listarViajes(usuario.id),
      contarEtapas(usuario.id),
      contarFotos(usuario.id),
    ]);

    const seccionDatos = crear("section", { class: "bloque" });
    seccionDatos.append(
      crear("div", {
        class: "bloque__cabecera",
        html: `<div><p class="kicker">Resumen</p><h2>Tu archivo de viajes</h2></div>`,
      }),
    );

    const rejilla = crear("div", { class: "rejilla rejilla--2 estadisticas" });
    const datosEstadisticas = [
      ["Viajes", viajes.length, ICONOS.mapa],
      ["Etapas", etapas, ICONOS.texto],
      ["Fotografías", fotos, ICONOS.foto],
    ];
    for (const [etiqueta, valor, icono] of datosEstadisticas) {
      const tarjeta = crear("div", { class: "estadistica" });
      tarjeta.innerHTML = `
        <span class="estadistica__icono">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
               stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icono}</svg>
        </span>
        <strong class="estadistica__valor">${numero(valor)}</strong>
        <span class="estadistica__etiqueta">${etiqueta}</span>
      `;
      rejilla.append(tarjeta);
    }
    seccionDatos.append(rejilla);
    nodo.append(seccionDatos);

    /* ---------- Mis viajes ---------- */
    const seccionViajes = crear("section", { class: "bloque" });
    seccionViajes.append(
      crear("div", {
        class: "bloque__cabecera",
        html: `<div><p class="kicker">Bitácora</p><h2>Mis viajes</h2></div>
               <a class="enlace-sutil" href="#/viajes">Ver todos →</a>`,
      }),
    );

    if (!viajes.length) {
      seccionViajes.append(
        crear("p", {
          class: "texto-suave",
          text: "Todavía no has creado ningún viaje.",
        }),
      );
    } else {
      const lista = crear("div", { class: "lista-perfil" });
      for (const viaje of viajes.slice(0, 8)) {
        const fila = crear("a", { class: "fila-viaje", attrs: { href: `#/viaje/${viaje.id}` } });
        const miniatura = crear("div", { class: "fila-viaje__miniatura" });
        if (viaje.portada_url) {
          miniatura.append(crear("img", { src: viaje.portada_url, alt: "", loading: "lazy" }));
        } else {
          miniatura.append(crear("span", { text: (viaje.titulo || "·").charAt(0).toUpperCase() }));
        }
        const textos = crear("div", { class: "fila-viaje__textos" });
        textos.append(crear("strong", { text: viaje.titulo || "Viaje sin título" }));
        textos.append(
          crear("span", {
            text: `${viaje.destino ? `${viaje.destino} · ` : ""}${rangoFechas(
              viaje.fecha_inicio,
              viaje.fecha_fin,
            )}`,
          }),
        );
        fila.append(miniatura, textos);
        lista.append(fila);
      }
      seccionViajes.append(lista);
    }
    nodo.append(seccionViajes);

    /* ---------- Cerrar sesión ---------- */
    botonSalir.addEventListener("click", async () => {
      const ok = await confirmar({
        titulo: "Cerrar sesión",
        texto: "Podrás volver a entrar con tu correo y tu contraseña en cualquier momento.",
        textoConfirmar: "Cerrar sesión",
      });
      if (!ok) return;
      try {
        await cerrarSesion();
        notificar("Sesión cerrada. Hasta la próxima.", "exito");
        navegar("/");
      } catch (error) {
        notificar(error.message, "error", 6000);
      }
    });

    return nodo;
  },
};

async function contarEtapas(userId) {
  const supabase = exigirSupabase();
  const { count } = await supabase
    .from("etapas")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

async function contarFotos(userId) {
  const supabase = exigirSupabase();
  const { count } = await supabase
    .from("fotografias")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}
