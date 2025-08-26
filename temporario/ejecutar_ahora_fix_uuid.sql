-- ⚠️ SCRIPT CRÍTICO: Ejecutar INMEDIATAMENTE en Supabase SQL Editor
-- Este script soluciona el error "operator does not exist: uuid = text"

-- PASO 1: Verificar el problema actual
SELECT 
  'ESTADO ACTUAL' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
AND column_name IN ('message_sid', 'user_id');

-- PASO 2: Verificar si hay datos que puedan causar problemas
SELECT 
  'DATOS ACTUALES' as info,
  COUNT(*) as total_messages,
  COUNT(CASE WHEN message_sid IS NOT NULL THEN 1 END) as messages_with_sid
FROM whatsapp_messages;

-- PASO 3: SOLUCIÓN - Cambiar message_sid de UUID a TEXT
-- ⚠️ ESTE ES EL COMANDO QUE SOLUCIONA EL PROBLEMA
ALTER TABLE whatsapp_messages 
ALTER COLUMN message_sid TYPE TEXT;

-- PASO 4: Verificar que el cambio se aplicó correctamente
SELECT 
  'DESPUÉS DEL CAMBIO' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
AND column_name = 'message_sid';

-- PASO 5: Verificar que la tabla sigue funcionando
SELECT 
  'VERIFICACIÓN FINAL' as info,
  COUNT(*) as total_messages_ok
FROM whatsapp_messages;

-- PASO 6: Verificar índices
SELECT 
  'ÍNDICES' as info,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'whatsapp_messages' 
AND indexdef LIKE '%message_sid%';

-- ✅ RESULTADO ESPERADO:
-- El campo message_sid debe aparecer como "text" en lugar de "uuid"
-- No debe haber errores en la ejecución
-- La tabla debe seguir funcionando normalmente
