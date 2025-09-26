-- RECREAR TABLA CONVERSATIONS SI ES NECESARIO
-- Ejecutar en Supabase Dashboard

-- 1. Verificar si existe la tabla conversations
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'conversations';

-- 2. Si no existe, crear la tabla conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(contact_id, user_id)
);

-- 3. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas de seguridad
CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON conversations
    FOR UPDATE USING (auth.uid() = user_id);

-- 6. Crear conversaciones para contactos existentes
INSERT INTO conversations (contact_id, user_id, last_message_at)
SELECT DISTINCT 
    contact_id, 
    user_id, 
    MAX(timestamp) as last_message_at
FROM whatsapp_messages 
WHERE user_id IS NOT NULL 
AND contact_id IS NOT NULL
GROUP BY contact_id, user_id
ON CONFLICT (contact_id, user_id) DO NOTHING;

-- 7. Actualizar mensajes existentes con conversation_id
UPDATE whatsapp_messages 
SET conversation_id = c.id
FROM conversations c
WHERE whatsapp_messages.contact_id = c.contact_id 
AND whatsapp_messages.user_id = c.user_id
AND whatsapp_messages.conversation_id IS NULL;
