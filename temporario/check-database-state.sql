-- VERIFICAR ESTADO DE LA BASE DE DATOS
-- Ejecutar estas consultas en Supabase Dashboard

-- 1. Verificar si existe la tabla conversations
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'conversations';

-- 2. Verificar estructura de la tabla conversations (si existe)
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'conversations'
ORDER BY ordinal_position;

-- 3. Verificar mensajes recientes
SELECT id, content, message_type, contact_id, user_id, timestamp, conversation_id
FROM whatsapp_messages 
WHERE contact_id = '+5491135562673' 
ORDER BY timestamp DESC 
LIMIT 10;

-- 4. Verificar órdenes recientes
SELECT id, order_number, status, created_at, updated_at, provider_id
FROM orders 
WHERE user_id = 'b5a237e6-c9f9-4561-af07-a1408825ab50' 
ORDER BY created_at DESC 
LIMIT 5;

-- 5. Verificar proveedores
SELECT id, name, phone, user_id
FROM providers 
WHERE phone = '+5491135562673';

-- 6. Verificar si hay conversaciones activas
SELECT id, contact_id, user_id, created_at, updated_at
FROM conversations 
WHERE contact_id = '+5491135562673' 
ORDER BY updated_at DESC 
LIMIT 5;
