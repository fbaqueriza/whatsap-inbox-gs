-- Crear tabla de mensajes para WhatsApp
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_number VARCHAR(20) NOT NULL,
  to_number VARCHAR(20) NOT NULL,
  message_id VARCHAR(255) UNIQUE,
  message_type VARCHAR(50) NOT NULL DEFAULT 'text',
  message_text TEXT,
  message_content JSONB,
  timestamp TIMESTAMPTZ NOT NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status VARCHAR(50) NOT NULL DEFAULT 'sent',
  platform VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  kapso_message_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_from_number ON messages(from_number);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_platform ON messages(platform);

-- Crear función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS (Row Level Security)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Crear política para que los usuarios solo puedan ver sus propios mensajes
CREATE POLICY "Users can view their own messages" ON messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON messages
    FOR UPDATE USING (auth.uid() = user_id);

-- Permitir que el servicio role (para webhooks) pueda insertar mensajes
CREATE POLICY "Service role can insert messages" ON messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can select messages" ON messages
    FOR SELECT USING (true);
