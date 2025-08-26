-- 🔍 VERIFICAR ESTADO ACTUAL después del cambio
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar el tipo de dato actual de message_sid
SELECT 
  'TIPO ACTUAL DE MESSAGE_SID' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
AND column_name = 'message_sid';

-- 2. Verificar si hay datos en la tabla
SELECT 
  'DATOS EN LA TABLA' as info,
  COUNT(*) as total_messages
FROM whatsapp_messages;

-- 3. Verificar si hay algún mensaje con message_sid
SELECT 
  'MENSAJES CON MESSAGE_SID' as info,
  COUNT(*) as messages_with_sid,
  COUNT(CASE WHEN message_sid IS NOT NULL THEN 1 END) as non_null_sid
FROM whatsapp_messages;

-- 4. Verificar la estructura completa de la tabla
SELECT 
  'ESTRUCTURA COMPLETA' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
ORDER BY ordinal_position;

-- 5. Intentar insertar un mensaje de prueba
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
  'Mensaje de prueba',
  NOW(),
  'test_message_123',
  '+5491112345678',
  'received',
  NULL,
  'delivered'
) RETURNING id, message_sid;

-- 6. Verificar que el mensaje se insertó correctamente
SELECT 
  'VERIFICACIÓN INSERCIÓN' as info,
  id,
  message_sid,
  content,
  contact_id
FROM whatsapp_messages 
WHERE message_sid = 'test_message_123';

-- 7. Limpiar mensaje de prueba
DELETE FROM whatsapp_messages WHERE message_sid = 'test_message_123';
