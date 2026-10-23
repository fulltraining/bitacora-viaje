-- ============================================================
-- Bitácora de Viaje · Esquema base
-- Ejecutar antes de las migraciones
-- ============================================================

-- Perfiles
CREATE TABLE IF NOT EXISTS public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT DEFAULT 'Viajero',
  avatar_url TEXT,
  avatar_path TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfiles_ver_propio" ON public.perfiles;
CREATE POLICY "perfiles_ver_propio" ON public.perfiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "perfiles_crear_propio" ON public.perfiles;
CREATE POLICY "perfiles_crear_propio" ON public.perfiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "perfiles_actualizar_propio" ON public.perfiles;
CREATE POLICY "perfiles_actualizar_propio" ON public.perfiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger para crear perfil al registrarse
CREATE OR REPLACE FUNCTION public.crear_perfil_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.crear_perfil_usuario();

-- Viajes
CREATE TABLE IF NOT EXISTS public.viajes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  titulo TEXT NOT NULL,
  destino TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  descripcion TEXT DEFAULT '',
  portada_url TEXT,
  portada_path TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.viajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viajes_crud_propio" ON public.viajes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Etapas
CREATE TABLE IF NOT EXISTS public.etapas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  viaje_id UUID REFERENCES public.viajes(id) ON DELETE CASCADE NOT NULL,
  numero INTEGER DEFAULT 1,
  fecha DATE,
  titulo TEXT NOT NULL,
  salida TEXT,
  llegada TEXT,
  diario TEXT DEFAULT '',
  gpx_path TEXT,
  gpx_url TEXT,
  distancia_m NUMERIC,
  ascenso_m NUMERIC,
  descenso_m NUMERIC,
  duracion_s INTEGER,
  con_altitud BOOLEAN DEFAULT FALSE,
  puntos_gpx JSONB,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etapas_crud_propio" ON public.etapas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Fotografías
CREATE TABLE IF NOT EXISTS public.fotografias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  viaje_id UUID REFERENCES public.viajes(id) ON DELETE CASCADE NOT NULL,
  etapa_id UUID REFERENCES public.etapas(id) ON DELETE CASCADE NOT NULL,
  path TEXT NOT NULL,
  url TEXT NOT NULL,
  nombre TEXT,
  pie TEXT DEFAULT '',
  ancho INTEGER,
  alto INTEGER,
  bytes BIGINT,
  orden INTEGER DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fotografias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fotografias_crud_propio" ON public.fotografias
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Buckets (crear desde el panel si falla)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('gpx', 'gpx', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('audios', 'audios', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Políticas de Storage por usuario (fotos, gpx, audios)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fotos_crud_propietario" ON storage.objects;
CREATE POLICY "fotos_crud_propietario"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'fotos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'fotos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "gpx_crud_propietario" ON storage.objects;
CREATE POLICY "gpx_crud_propietario"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'gpx'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'gpx'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "audios_crud_propietario" ON storage.objects;
CREATE POLICY "audios_crud_propietario"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'audios'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'audios'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
