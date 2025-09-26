-- LLENAR TABLA CONVERSATIONS CON EL SCHEMA CORRECTO
-- Ejecutar en Supabase Dashboard

-- 1. Verificar el estado actual de la tabla conversations
SELECT COUNT(*) as total_conversations FROM conversations;

-- 2. Verificar contactos únicos en mensajes
SELECT 
    contact_id,
    COUNT(*) as message_count,
    MAX(timestamp) as last_message
FROM whatsapp_messages 
WHERE contact_id IS NOT NULL
GROUP BY contact_id
ORDER BY last_message DESC;

-- 3. Crear conversaciones para contactos existentes
INSERT INTO conversations (phone_number, contact_name, last_message_at, unread_count, is_active)
SELECT DISTINCT 
    contact_id as phone_number,
    COALESCE(
        (SELECT name FROM providers WHERE phone = whatsapp_messages.contact_id LIMIT 1),
        'Contacto'
    ) as contact_name,
    MAX(timestamp) as last_message_at,
    0 as unread_count,
    true as is_active
FROM whatsapp_messages 
WHERE contact_id IS NOT NULL
AND contact_id NOT IN (SELECT phone_number FROM conversations)
GROUP BY contact_id
ON CONFLICT (phone_number) DO UPDATE SET
    last_message_at = EXCLUDED.last_message_at,
    updated_at = NOW();

-- 4. Actualizar conversaciones existentes con el último mensaje
UPDATE conversations 
SET 
    last_message_at = subquery.last_message,
    updated_at = NOW()
FROM (
    SELECT 
        contact_id,
        MAX(timestamp) as last_message
    FROM whatsapp_messages 
    WHERE contact_id IS NOT NULL
    GROUP BY contact_id
) as subquery
WHERE conversations.phone_number = subquery.contact_id
AND conversations.last_message_at < subquery.last_message;

-- 5. Verificar el resultado
SELECT 
    id,
    phone_number,
    contact_name,
    last_message_at,
    unread_count,
    is_active,
    created_at,
    updated_at
FROM conversations 
ORDER BY last_message_at DESC
LIMIT 10;

-- 6. Verificar que los mensajes tengan conversation_id (si es necesario)
-- Nota: Si la tabla whatsapp_messages tiene una columna conversation_id, 
-- necesitaríamos vincularla aquí
