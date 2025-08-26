-- Script para verificar y corregir la estructura de la tabla whatsapp_messages
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar la estructura actual de la tabla
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
ORDER BY ordinal_position;

-- 2. Si message_sid está definido como UUID, cambiarlo a TEXT
-- (Descomentar las siguientes líneas si es necesario)

-- ALTER TABLE whatsapp_messages 
-- ALTER COLUMN message_sid TYPE TEXT;

-- 3. Si user_id está definido como UUID pero permite NULL, asegurar que sea correcto
-- (Descomentar las siguientes líneas si es necesario)

-- ALTER TABLE whatsapp_messages 
-- ALTER COLUMN user_id TYPE UUID,
-- ALTER COLUMN user_id DROP NOT NULL;

-- 4. Verificar que los índices estén correctos
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'whatsapp_messages';

-- 5. Verificar las políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'whatsapp_messages';

-- 6. Verificar que la tabla esté en la publicación de Realtime
SELECT 
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables 
WHERE tablename = 'whatsapp_messages';
