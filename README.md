# Bitácora de Viaje

Plataforma multiusuario para crear y mantener diarios de viaje con fotografías, rutas GPX y diario sonoro.

## Características

- **Viajes y etapas** — Cada viajero organiza su viaje en etapas con fecha, lugares, diario de texto, galería de fotos y ruta GPX.
- **Fotografías** — Subida múltiple, redimensionado automático, pies de foto, visor ampliado.
- **Rutas GPX** — Importación con `@tmcw/togeojson`, trazado con Leaflet + OpenStreetMap, distancia, desnivel, perfil de elevación y marcadores de inicio/fin.
- **Diario sonoro** — Grabación con `MediaRecorder`, importación de audios, categorías, ubicación opcional (GPS o marcador en el mapa), reproducción con URLs firmadas, bucket privado.
- **Privacidad** — Autenticación con Supabase, RLS por usuario, archivos privados en Storage.
- **Responsive** — Funciona en móvil, tablet y ordenador. Preparado para PWA.
- **Español** — Toda la interfaz está en español.

## Tecnologías

- [Vite](https://vitejs.dev/) + HTML5, CSS3, JavaScript modular
- [Supabase](https://supabase.com/) (Auth, PostgreSQL, Storage)
- [Leaflet](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/)
- [@tmcw/togeojson](https://github.com/tmcw/togeojson)

## Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

Copia `.env.example` a `.env` y completa con los datos de tu proyecto:

```bash
cp .env.example .env
```

O bien introdúcelos desde la pantalla **Configuración** de la app (se guardan en `localStorage`).

### 3. Crear la base de datos y el Storage

Ejecuta los scripts SQL en el **SQL Editor** de Supabase (en orden):

1. `supabase/schema.sql` — Esquema base (perfiles, viajes, etapas, fotografías, RLS, buckets)
2. `supabase/migrations/20251021_audio_diario_sonoro.sql` — Diario sonoro (tabla `audio_recordings`, bucket `audios` privado, RLS)

Crea los buckets desde **Storage → Buckets**:

- `fotos` — público o con las políticas del script
- `gpx` — con las políticas del script
- `audios` — **PRIVADO** (obligatorio). Tamaño máximo recomendado: 25 MB. Tipos permitidos: `audio/*`

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Abre `http://localhost:5173`.

### 5. Construir para producción

```bash
npm run build
npm run preview
```

Los archivos se generan en `dist/`.

## Diario sonoro — Notas importantes

- **HTTPS obligatorio en producción** — La API `navigator.mediaDevices.getUserMedia()` solo funciona en contextos seguros (HTTPS) o `localhost`. En Termux con HTTP local funciona para pruebas, pero en un servidor público **debe** servirse por HTTPS.
- **Permiso del micrófono** — Solo se solicita cuando el usuario pulsa **Grabar audio**. Nunca al cargar la página.
- **Formato compatible** — La app detecta el `MIME type` soportado por el navegador (`audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, `audio/mp4` en iOS, etc.).
- **Privacidad** — Las grabaciones son **privadas por defecto**. Se guardan en un bucket **privado** de Supabase Storage. La reproducción usa **URLs firmadas** con caducidad. El campo `compartido` está preparado para una futura función, **sin activar**.
- **Ubicación opcional** — Se puede añadir la ubicación actual (con permiso explícito) o colocar un marcador sobre el mapa GPX.
- **Sin transcripción** — No se implementa transcripción automática en esta fase; queda prevista para el futuro.
- **Liberación del micrófono** — Se detiene y libera siempre al terminar, cancelar o salir de la vista.
- **Validaciones** — Se valida tipo, tamaño (máx. 25 MB) y duración (máx. 15 minutos). Se muestra progreso de subida.

## Diseño

- Estilo editorial de revista de viajes
- Colores: fondo blanco roto `#f6f2e9`, verde oscuro `#1e3b2f`, arena `#e3d2b8`, terracota `#b75d38`
- Tipografías: Fraunces (títulos) e Inter (texto), autoalojadas
- Menú inferior en móvil
- Preparado para PWA

## Estructura

```
bitacora-viaje/
├── index.html
├── package.json
├── vite.config.js
├── public/        # iconos, manifest, fuentes
├── src/
│   ├── lib/       # config, supabase, audio, mapa, gpx...
│   ├── store/     # sesiones, viajes, etapas, fotos, audio
│   ├── views/     # pantallas + panel de audio
│   └── styles/    # CSS modular
└── supabase/
    ├── schema.sql
    └── migrations/
```
