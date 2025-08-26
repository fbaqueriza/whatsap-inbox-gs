-- Script para corregir el tipo de dato del campo message_sid
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar la estructura actual
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
AND column_name = 'message_sid';

-- 2. Cambiar el tipo de dato de message_sid de UUID a TEXT
ALTER TABLE whatsapp_messages 
ALTER COLUMN message_sid TYPE TEXT;

-- 3. Verificar que el cambio se aplicó correctamente
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
AND column_name = 'message_sid';

-- 4. Verificar que no hay errores en la tabla
SELECT COUNT(*) as total_messages FROM whatsapp_messages;

-- 5. Verificar que los índices siguen funcionando
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'whatsapp_messages' 
AND indexdef LIKE '%message_sid%';
