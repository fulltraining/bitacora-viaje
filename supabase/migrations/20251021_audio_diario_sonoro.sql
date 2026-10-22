-- ============================================================
-- Bitácora de Viaje · Migración: Diario sonoro (audio)
-- Ejecutar en el editor SQL de Supabase o con supabase db push
--
-- Requisitos:
--   1. Tener instalados los esquemas base (perfiles, viajes, etapas, fotografias)
--   2. Crear los buckets "fotos" y "gpx" si aún no existen
--   3. Crear el bucket PRIVADO "audios" (no público)
--   4. Aplicar las políticas de Storage más abajo
--
-- IMPORTANTE: Las grabaciones son PRIVADAS por defecto.
-- No se generan URLs públicas permanentes; se usan URLs firmadas.
-- No se implementa transcripción automática en esta fase.
-- ============================================================

-- ========================= Bucket de Storage =========================
-- Crear desde el panel: Storage → Buckets → New bucket
-- Nombre: audios
-- Public: false (PRIVADO)
-- File size limit: 25 MB (recomendado)
-- Allowed MIME types: audio/* (recomendado)

-- ========================= Tabla de metadatos =========================
CREATE TABLE IF NOT EXISTS public.audio_recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  viaje_id UUID REFERENCES public.viajes(id) ON DELETE CASCADE NOT NULL,
  etapa_id UUID REFERENCES public.etapas(id) ON DELETE CASCADE NOT NULL,
  path TEXT NOT NULL,
  nombre TEXT,
  titulo TEXT DEFAULT 'Grabación sin título',
  descripcion TEXT DEFAULT '',
  categoria TEXT DEFAULT 'nota' CHECK (categoria IN ('nota','naturaleza','ciudad','conversacion','otros')),
  mime_type TEXT DEFAULT 'audio/webm',
  bytes BIGINT DEFAULT 0,
  duracion_s INTEGER,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  precision_m INTEGER,
  origen TEXT DEFAULT 'grabacion' CHECK (origen IN ('grabacion','importacion')),
  compartido BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para acelerar las consultas por etapa/viaje/usuario
CREATE INDEX IF NOT EXISTS idx_audio_recordings_etapa ON public.audio_recordings(etapa_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_viaje ON public.audio_recordings(viaje_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_user ON public.audio_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_creado ON public.audio_recordings(creado_en DESC);

-- Actualización automática de actualizado_en
CREATE OR REPLACE FUNCTION public.actualizar_audio_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audio_recordings_actualizado ON public.audio_recordings;
CREATE TRIGGER trg_audio_recordings_actualizado
  BEFORE UPDATE ON public.audio_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.actualizar_audio_timestamp();

-- ========================= RLS =========================
ALTER TABLE public.audio_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audios_solo_propietario_ver" ON public.audio_recordings;
CREATE POLICY "audios_solo_propietario_ver"
  ON public.audio_recordings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "audios_solo_propietario_crear" ON public.audio_recordings;
CREATE POLICY "audios_solo_propietario_crear"
  ON public.audio_recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "audios_solo_propietario_actualizar" ON public.audio_recordings;
CREATE POLICY "audios_solo_propietario_actualizar"
  ON public.audio_recordings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "audios_solo_propietario_borrar" ON public.audio_recordings;
CREATE POLICY "audios_solo_propietario_borrar"
  ON public.audio_recordings FOR DELETE
  USING (auth.uid() = user_id);

-- ========================= Storage: bucket "audios" PRIVADO =========================
-- Las políticas se aplican en storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audios_privados_subir" ON storage.objects;
CREATE POLICY "audios_privados_subir"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audios'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "audios_privados_leer" ON storage.objects;
CREATE POLICY "audios_privados_leer"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audios'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "audios_privados_actualizar" ON storage.objects;
CREATE POLICY "audios_privados_actualizar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'audios'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "audios_privados_borrar" ON storage.objects;
CREATE POLICY "audios_privados_borrar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audios'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ========================= Notas =========================
-- · El micrófono requiere HTTPS en producción (localhost y Termux HTTP son aceptables para desarrollo).
-- · Las grabaciones son PRIVADAS. El campo "compartido" está preparado para una futura función.
-- · NO se implementa transcripción automática en esta fase.
-- · Las URLs se generan con createSignedUrl (vencimiento configurable). NO usar getPublicUrl.
-- · Los datos de ubicación (lat/lon) son opcionales y solo se guardan con permiso explícito.
-- · Formatos soportados: WebM/Opus, OGG/Opus, M4A/MP4, MP3, WAV, AAC, FLAC. El cliente detecta el MIME compatible.
