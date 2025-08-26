-- 🔧 SOLUCIÓN FINAL: Error "null value in column user_id violates not-null constraint"
-- Ejecutar en Supabase SQL Editor

-- PASO 1: Verificar el estado actual del campo user_id
SELECT 
  'ESTADO ACTUAL DE USER_ID' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
AND column_name = 'user_id';

-- PASO 2: SOLUCIÓN - Permitir NULL en user_id
ALTER TABLE whatsapp_messages 
ALTER COLUMN user_id DROP NOT NULL;

-- PASO 3: Verificar que el cambio se aplicó correctamente
SELECT 
  'DESPUÉS DEL CAMBIO' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
AND column_name = 'user_id';

-- PASO 4: Verificar que message_sid es TEXT (por si acaso)
SELECT 
  'VERIFICACIÓN MESSAGE_SID' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
AND column_name = 'message_sid';

-- PASO 5: Probar inserción de mensaje
INSERT INTO whatsapp_messages (
  id,
  content,
  timestamp,
  message_sid,
  contact_id,
  message_type,
  user_id,
  status
) VALUES (
  gen_random_uuid(),
  'Mensaje de prueba final',
  NOW(),
  'test_final_123',
  '+5491112345678',
  'received',
  NULL,
  'delivered'
) RETURNING id, message_sid, user_id;

-- PASO 6: Verificar que se insertó correctamente
SELECT 
  'VERIFICACIÓN FINAL' as info,
  id,
  message_sid,
  user_id,
  content,
  contact_id
FROM whatsapp_messages 
WHERE message_sid = 'test_final_123';

-- PASO 7: Limpiar mensaje de prueba
DELETE FROM whatsapp_messages WHERE message_sid = 'test_final_123';

-- ✅ RESULTADO ESPERADO:
-- user_id debe aparecer como "YES" en is_nullable
-- message_sid debe aparecer como "text"
-- La inserción de prueba debe funcionar sin errores
