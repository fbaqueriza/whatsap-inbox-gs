-- 🔍 DIAGNÓSTICO COMPLETO: Error "operator does not exist: uuid = text"
-- Ejecutar en Supabase SQL Editor para identificar TODOS los problemas

-- PASO 1: Verificar TODA la estructura de la tabla whatsapp_messages
SELECT 
  'ESTRUCTURA COMPLETA' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
ORDER BY ordinal_position;

-- PASO 2: Verificar específicamente campos que podrían ser UUID
SELECT 
  'CAMPOS UUID PROBLEMÁTICOS' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
AND data_type = 'uuid';

-- PASO 3: Verificar si hay datos que puedan causar problemas
SELECT 
  'ANÁLISIS DE DATOS' as info,
  COUNT(*) as total_messages,
  COUNT(CASE WHEN message_sid IS NOT NULL THEN 1 END) as messages_with_sid,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as messages_with_user_id
FROM whatsapp_messages;

-- PASO 4: Verificar si hay índices que puedan estar causando problemas
SELECT 
  'ÍNDICES PROBLEMÁTICOS' as info,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'whatsapp_messages';

-- PASO 5: Verificar las políticas RLS
SELECT 
  'POLÍTICAS RLS' as info,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'whatsapp_messages';

-- PASO 6: Verificar triggers
SELECT 
  'TRIGGERS' as info,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'whatsapp_messages';

-- PASO 7: Verificar restricciones
SELECT 
  'RESTRICCIONES' as info,
  constraint_name,
  constraint_type,
  table_name,
  column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'whatsapp_messages';

-- PASO 8: Verificar si la tabla está en Realtime
SELECT 
  'REALTIME' as info,
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables 
WHERE tablename = 'whatsapp_messages';
