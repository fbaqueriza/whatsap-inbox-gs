-- 🔍 DIAGNÓSTICO: Error en Trigger chat_contacts
-- Ejecutar en Supabase SQL Editor

-- PASO 1: Verificar la estructura de la tabla chat_contacts
SELECT 
  'ESTRUCTURA CHAT_CONTACTS' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'chat_contacts' 
ORDER BY ordinal_position;

-- PASO 2: Verificar la estructura de whatsapp_messages
SELECT 
  'ESTRUCTURA WHATSAPP_MESSAGES' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
ORDER BY ordinal_position;

-- PASO 3: Verificar si existe el trigger problemático
SELECT 
  'TRIGGERS EN WHATSAPP_MESSAGES' as info,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'whatsapp_messages';

-- PASO 4: Verificar la función del trigger
SELECT 
  'FUNCIÓN DEL TRIGGER' as info,
  proname as function_name,
  prosrc as function_source
FROM pg_proc 
WHERE proname = 'update_contact_last_activity';

-- PASO 5: Verificar si hay datos en chat_contacts
SELECT 
  'DATOS EN CHAT_CONTACTS' as info,
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as contacts_with_user_id,
  COUNT(CASE WHEN phone_number IS NOT NULL THEN 1 END) as contacts_with_phone
FROM chat_contacts;

-- PASO 6: Verificar si hay datos en whatsapp_messages
SELECT 
  'DATOS EN WHATSAPP_MESSAGES' as info,
  COUNT(*) as total_messages,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as messages_with_user_id,
  COUNT(CASE WHEN contact_id IS NOT NULL THEN 1 END) as messages_with_contact_id
FROM whatsapp_messages;
