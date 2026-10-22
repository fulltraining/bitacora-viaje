/* ============================================================
   Bitácora de Viaje · views/inicio.js
   Portada de la plataforma.
   ============================================================ */

import { crear } from "../lib/dom.js";
import { navegar } from "../lib/enrutador.js";

const CARACTERISTICAS = [
  {
    numero: "01",
    titulo: "Fotografías que cuentan la historia",
    texto:
      "Cada etapa admite varias imágenes, con su propio pie de foto. La portada de tu viaje es lo primero que ve quien lo abre.",
    icono: `<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="8.5" cy="10" r="1.7" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m4 17 4.8-4.8a1.5 1.5 0 0 1 2.1 0L16 17M14 14l1.8-1.8a1.5 1.5 0 0 1 2.1 0L20.5 14.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  },
  {
    numero: "02",
    titulo: "Tus rutas GPX sobre el mapa",
    texto:
      "Importa el fichero GPX del GPS y obtén la distancia, el desnivel y el perfil de elevación. El recorrido se dibuja con Leaflet y OpenStreetMap.",
    icono: `<path d="M9 20 4 21l1-5 8.5-8.5M13.5 5.5l2-2a2.1 2.1 0 0 1 3 3l-2 2M10.5 9.5 15 14M14 11l2.5-2.5M8.5 14.5 6 17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    numero: "03",
    titulo: "Un diario de verdad",
    texto:
      "Texto libre, fecha, lugar de salida y llegada. Sin plantillas ni límites: la bitácora la escribes tú, etapa a etapa.",
    icono: `<path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3v6h6M8.5 13h7M8.5 17h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  },
];

export default {
  titulo: "Bitácora de Viaje",

  render({ sesion }) {
    const conectado = Boolean(sesion.usuario);

    const nodo = crear("div", { class: "inicio" });

    /* ---------- Portada ---------- */
    const portada = crear("section", { class: "portada" });
    portada.innerHTML = `
      <div class="portada__fondo" aria-hidden="true">
        <span class="portada__sol"></span>
        <svg class="portada__curvas" viewBox="0 0 1200 600" preserveAspectRatio="none">
          <path d="M0 470 C 160 400, 300 520, 470 452 S 760 360, 920 424 S 1110 500, 1200 430" />
          <path d="M0 512 C 180 442, 320 556, 490 492 S 790 402, 940 464 S 1120 540, 1200 474" />
          <path d="M0 552 C 200 486, 340 596, 510 532 S 820 446, 970 504 S 1140 578, 1200 516" />
          <path d="M0 596 C 220 532, 360 636, 530 574 S 840 492, 990 546 S 1150 616, 1200 558" />
        </svg>
      </div>

      <div class="portada__contenido envoltorio">
        <p class="kicker">Plataforma de diarios de viaje</p>
        <h1 class="portada__titulo">Cada viaje merece<br />un recuerdo <em>escrito</em></h1>
        <p class="entradilla portada__entradilla">
          Bitácora de Viaje es tu cuaderno de rutas: fotografías, diario por etapas y mapas
          que dibujan cada trayecto. Todo guardado en la nube y disponible en el móvil,
          la tablet y el ordenador.
        </p>
        <div class="portada__acciones">
          ${
            conectado
              ? `<a class="boton boton--acento boton--grande" href="#/viajes">Ver mis viajes</a>
                 <a class="boton boton--contorno boton--grande" href="#/perfil">Mi perfil</a>`
              : `<a class="boton boton--acento boton--grande" href="#/registro">Crear mi bitácora</a>
                 <a class="boton boton--contorno boton--grande" href="#/acceso">Ya tengo cuenta</a>`
          }
        </div>
        <p class="portada__nota">Gratis · Tus datos son tuyos · Funciona sin conexión</p>
      </div>

      <div class="portada__faldon envoltorio" aria-hidden="true">
        <div class="faldon__marco">
          <div class="faldon__imagen faldon__imagen--1"></div>
          <div class="faldon__imagen faldon__imagen--2"></div>
          <div class="faldon__imagen faldon__imagen--3"></div>
        </div>
      </div>
    `;

    // Limpieza del texto de la entradilla (protege el HTML de la plantilla).
    const entradilla = portada.querySelector(".portada__entradilla");
    if (entradilla) {
      entradilla.textContent =
        "Bitácora de Viaje es tu cuaderno de rutas: fotografías, diario por etapas y mapas que dibujan cada trayecto. Todo guardado en la nube y disponible en el móvil, la tablet y el ordenador.";
    }

    nodo.append(portada);

    /* ---------- Manifiesto ---------- */
    const manifiesto = crear("section", { class: "seccion envoltorio" });
    manifiesto.innerHTML = `
      <div class="manifiesto">
        <p class="kicker">La idea</p>
        <h2>Un cuaderno de campo para quien<br />prefiere perderse con detalle</h2>
        <div class="manifiesto__columnas">
          <p class="parrafo-editorial">
            Hay viajes que se cuentan con una foto y hay viajes que se cuentan con un
            track, una hora deamanecer y la lista de lo que se llevó en la mochila.
            La bitácora digital no viene a sustituir al cuaderno de papel: viene a
            guardar lo que el papel no puede, la ruta completa, el desnivel
            acumulado y las imágenes que pesan.
          </p>
          <div class="manifiesto__datos">
            <div><strong>Multiusuario</strong><span>Cada viajero tiene su propio espacio</span></div>
            <div><strong>Sin límites</strong><span>Tantas etapas y fotos como quieras</span></div>
            <div><strong>Mapas reales</strong><span>Leaflet + OpenStreetMap</span></div>
            <div><strong>Listo para PWA</strong><span>Se instala en el móvil</span></div>
          </div>
        </div>
      </div>
    `;

    // El párrafo con drop-cap necesita texto plano.
    const parrafo = manifiesto.querySelector(".parrafo-editorial");
    if (parrafo) {
      parrafo.textContent =
        "Hay viajes que se cuentan con una foto y hay viajes que se cuentan con un track, una hora de amanecer y la lista de lo que se llevó en la mochila. La bitácora digital no viene a sustituir al cuaderno de papel: viene a guardar lo que el papel no puede, la ruta completa, el desnivel acumulado y las imágenes que pesan.";
    }

    nodo.append(manifiesto);

    /* ---------- Características ---------- */
    const caracteristicas = crear("section", { class: "seccion envoltorio" });
    const rejilla = crear("div", { class: "rejilla rejilla--2 caracteristicas" });

    for (const item of CARACTERISTICAS) {
      const tarjeta = crear("article", { class: "caracteristica" });
      tarjeta.innerHTML = `
        <span class="caracteristica__numero">${item.numero}</span>
        <span class="caracteristica__icono">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
               stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${item.icono}</svg>
        </span>
        <h3>${item.titulo}</h3>
        <p>${item.texto}</p>
      `;
      rejilla.append(tarjeta);
    }

    caracteristicas.innerHTML = `
      <div class="seccion__cabecera">
        <div class="seccion__titulo">
          <p class="kicker">Qué incluye</p>
          <h2>Todo lo necesario para documentar el camino</h2>
        </div>
        <span class="regla"></span>
      </div>
    `;
    caracteristicas.append(rejilla);
    nodo.append(caracteristicas);

    /* ---------- Cierre ---------- */
    const cierre = crear("section", { class: "seccion envoltorio" });
    cierre.innerHTML = `
      <div class="cierre">
        <p class="kicker">Empieza hoy</p>
        <h2>Tu primer viaje puede empezar con una foto</h2>
        <p class="entradilla">
          Crea una cuenta, abre tu bitácora y añade la primera etapa. El resto
          vendrás solo, etapa a etapa.
        </p>
        <div class="fila" style="justify-content:center;margin-top:1.6rem">
          ${
            conectado
              ? `<a class="boton boton--acento boton--grande" href="#/viajes">Ir a mis viajes</a>`
              : `<a class="boton boton--acento boton--grande" href="#/registro">Crear mi bitácora</a>
                 <a class="boton boton--fantasma boton--grande" href="#/acceso">Iniciar sesión</a>`
          }
        </div>
      </div>
    `;
    nodo.append(cierre);

    return nodo;
  },
};
