-- Crear tabla kapso_messages para almacenar mensajes de Kapso
CREATE TABLE IF NOT EXISTS kapso_messages (
  id TEXT PRIMARY KEY,
  content TEXT,
  direction TEXT,
  phone_number TEXT,
  conversation_id TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  inserted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE kapso_messages ENABLE ROW LEVEL SECURITY;

-- Política para permitir SELECT (necesario para Realtime)
CREATE POLICY IF NOT EXISTS "Enable realtime for kapso_messages" ON kapso_messages
FOR SELECT USING (true);

-- Política para permitir INSERT (necesario para webhook)
CREATE POLICY IF NOT EXISTS "Enable insert for kapso_messages" ON kapso_messages
FOR INSERT WITH CHECK (true);

-- Agregar tabla a la publicación Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE kapso_messages;

-- Crear índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_kapso_messages_phone_number ON kapso_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_kapso_messages_conversation_id ON kapso_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_kapso_messages_created_at ON kapso_messages(created_at);
