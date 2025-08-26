-- 🔍 VERIFICAR Y CORREGIR CONFIGURACIÓN REALTIME
-- Ejecutar en Supabase SQL Editor

-- PASO 1: Verificar si la publicación supabase_realtime existe
SELECT 
  'PUBLICACIONES REALTIME' as info,
  pubname,
  puballtables,
  pubinsert,
  pubupdate,
  pubdelete
FROM pg_publication 
WHERE pubname = 'supabase_realtime';

-- PASO 2: Verificar qué tablas están en la publicación
SELECT 
  'TABLAS EN REALTIME' as info,
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- PASO 3: Verificar si whatsapp_messages está en la publicación
SELECT 
  'VERIFICACIÓN WHATSAPP_MESSAGES' as info,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = 'whatsapp_messages'
    ) THEN 'SÍ está en Realtime'
    ELSE 'NO está en Realtime'
  END as status;

-- PASO 4: Agregar whatsapp_messages a Realtime si no está
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'whatsapp_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
    RAISE NOTICE '✅ whatsapp_messages agregada a Realtime';
  ELSE
    RAISE NOTICE 'ℹ️ whatsapp_messages ya está en Realtime';
  END IF;
END $$;

-- PASO 5: Agregar otras tablas importantes si no están
DO $$
BEGIN
  -- Agregar orders si no está
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    RAISE NOTICE '✅ orders agregada a Realtime';
  END IF;

  -- Agregar pending_orders si no está
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'pending_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pending_orders;
    RAISE NOTICE '✅ pending_orders agregada a Realtime';
  END IF;

  -- Agregar chat_contacts si no está
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'chat_contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_contacts;
    RAISE NOTICE '✅ chat_contacts agregada a Realtime';
  END IF;
END $$;

-- PASO 6: Verificar configuración final
SELECT 
  'CONFIGURACIÓN FINAL' as info,
  tablename,
  'Incluida en Realtime' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- PASO 7: Verificar permisos de RLS
SELECT 
  'POLÍTICAS RLS WHATSAPP_MESSAGES' as info,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'whatsapp_messages';

-- ✅ RESULTADO ESPERADO:
-- Todas las tablas importantes deben aparecer en "CONFIGURACIÓN FINAL"
-- whatsapp_messages debe estar incluida en Realtime
-- Las políticas RLS deben permitir acceso autenticado
