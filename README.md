# Bitácora de Viaje

Plataforma multiusuario para diarios de viaje con fotografías, rutas GPX y diario sonoro.

## Tecnologías
- Vite + HTML5/CSS3/JS modular
- Supabase (Auth, PostgreSQL, Storage)
- Leaflet + OpenStreetMap
- @tmcw/togeojson

## Requisitos
- Node.js 18+ / 20+
- Cuenta en Supabase

## Variables de entorno
Crea un archivo `.env` en la raíz (o configúralas desde la app en Ajustes/Configuración):

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_ANON_PUBLICA
```

**Notas de seguridad:**
- Usa ÚNICAMENTE la clave `anon` (pública). **Nunca** expongas la clave `service_role` en el cliente.
- Las claves `anon` se usan con las políticas RLS de Supabase. Debes tener RLS habilitado en todas las tablas.
- Los buckets `fotos`, `gpx` y `audios` deben ser **privados**. El contenido privado se accede con **URLs firmadas** (no URLs públicas permanentes).
- Las rutas de Storage siguen el patrón `uploads/{userId}/...` para que las políticas funcionen correctamente.

## Configuración de Supabase
1. En SQL Editor ejecuta `supabase/schema.sql`
2. Ejecuta `supabase/migrations/20251021_audio_diario_sonoro.sql`
3. En Storage crea/bloquea los buckets `fotos`, `gpx`, `audios` como **privados**
4. Verifica las políticas RLS en Authentication/Policies y Storage

## Desarrollo
```bash
npm install
npm run dev
```

## Compilación
```bash
npm run build
npm run preview
```

## Despliegue en GitHub Pages
El repositorio incluye workflows en `.github/workflows/`:
- `ci.yml` - Instala dependencias, compila (`npm run build`) y valida `dist/`
- `deploy-pages.yml` - Instala, compila, valida que `dist/` exista y despliega solo `dist/` con `actions/deploy-pages` manteniendo `base: "./"` en Vite.

Para desplegar: Settings > Pages > Source: GitHub Actions. Cada push a `main` compilará y desplegará.

## Funcionalidades críticas
- Autenticación (registro/inicio/cierre)
- Viajes y etapas (crear/editar/eliminar)
- Fotografías (subida/galería)
- GPX (importación con DOMParser, preservación de altitud, perfil de elevación)
- Diario sonoro (grabación, importación, categorías sin duplicados, ubicación opcional, reproducción con URLs firmadas, eliminación)
- Mapas con Leaflet/OpenStreetMap
