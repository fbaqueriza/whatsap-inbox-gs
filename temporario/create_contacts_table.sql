-- Script para crear la tabla de contactos del chat
-- Ejecutar en Supabase SQL Editor

-- Crear tabla para almacenar contactos del chat
CREATE TABLE IF NOT EXISTS chat_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  is_provider BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, phone_number)
);

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_chat_contacts_user_phone ON chat_contacts(user_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_chat_contacts_last_activity ON chat_contacts(last_activity);
CREATE INDEX IF NOT EXISTS idx_chat_contacts_is_provider ON chat_contacts(is_provider);
CREATE INDEX IF NOT EXISTS idx_chat_contacts_user_provider ON chat_contacts(user_id, is_provider);

-- Habilitar RLS (Row Level Security)
ALTER TABLE chat_contacts ENABLE ROW LEVEL SECURITY;

-- Política para permitir acceso solo a los contactos del usuario autenticado
CREATE POLICY "Users can manage their own contacts" ON chat_contacts
  FOR ALL USING (auth.uid() = user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
CREATE TRIGGER update_chat_contacts_updated_at 
  BEFORE UPDATE ON chat_contacts 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Función para actualizar last_activity cuando se recibe un mensaje
CREATE OR REPLACE FUNCTION update_contact_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar last_activity del contacto cuando se recibe un mensaje
  IF NEW.message_type = 'received' THEN
    UPDATE chat_contacts 
    SET last_activity = NEW.timestamp
    WHERE phone_number = NEW.contact_id 
    AND user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar last_activity cuando se recibe un mensaje
CREATE TRIGGER update_contact_activity_on_message
  AFTER INSERT ON whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_last_activity();

-- Verificar que la tabla se creó correctamente
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_contacts'
ORDER BY ordinal_position;

-- Verificar que los índices se crearon
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'chat_contacts';

-- Verificar que las políticas se crearon
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'chat_contacts';
