-- =====================================================
-- SCRIPT DE CONFIGURACIÓN KAPSO + SUPABASE
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. CREAR TABLAS DE KAPSO
-- =====================================================

-- Tabla para conversaciones de WhatsApp sincronizadas por Kapso
CREATE TABLE IF NOT EXISTS kapso_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT UNIQUE NOT NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  status TEXT DEFAULT 'active',
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Tabla para mensajes de WhatsApp sincronizados por Kapso
CREATE TABLE IF NOT EXISTS kapso_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL,
  conversation_id TEXT REFERENCES kapso_conversations(conversation_id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL,
  status TEXT DEFAULT 'received',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Tabla para contactos de WhatsApp sincronizados por Kapso
CREATE TABLE IF NOT EXISTS kapso_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  contact_name TEXT,
  profile_picture_url TEXT,
  is_business BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. CREAR ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_kapso_conversations_user_id ON kapso_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_kapso_conversations_phone_number ON kapso_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_kapso_conversations_last_message_at ON kapso_conversations(last_message_at);

CREATE INDEX IF NOT EXISTS idx_kapso_messages_user_id ON kapso_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_kapso_messages_conversation_id ON kapso_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_kapso_messages_timestamp ON kapso_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_kapso_messages_from_number ON kapso_messages(from_number);

CREATE INDEX IF NOT EXISTS idx_kapso_contacts_user_id ON kapso_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_kapso_contacts_phone_number ON kapso_contacts(phone_number);

-- 3. CONFIGURAR ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE kapso_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kapso_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kapso_contacts ENABLE ROW LEVEL SECURITY;

-- 4. CREAR POLÍTICAS RLS
-- =====================================================

-- Políticas para kapso_conversations
CREATE POLICY "Users can view their own conversations" ON kapso_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" ON kapso_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON kapso_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON kapso_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para kapso_messages
CREATE POLICY "Users can view their own messages" ON kapso_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" ON kapso_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON kapso_messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON kapso_messages
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para kapso_contacts
CREATE POLICY "Users can view their own contacts" ON kapso_contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts" ON kapso_contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts" ON kapso_contacts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts" ON kapso_contacts
  FOR DELETE USING (auth.uid() = user_id);

-- 5. CREAR FUNCIÓN DE SINCRONIZACIÓN
-- =====================================================

CREATE OR REPLACE FUNCTION sync_kapso_data(
  p_conversation_id TEXT,
  p_phone_number TEXT,
  p_contact_name TEXT,
  p_message_id TEXT,
  p_from_number TEXT,
  p_to_number TEXT,
  p_content TEXT,
  p_message_type TEXT,
  p_timestamp TIMESTAMP WITH TIME ZONE,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_conversation_uuid UUID;
  v_message_uuid UUID;
  v_contact_uuid UUID;
BEGIN
  -- Insertar o actualizar contacto
  INSERT INTO kapso_contacts (phone_number, contact_name, user_id)
  VALUES (p_phone_number, p_contact_name, p_user_id)
  ON CONFLICT (phone_number) 
  DO UPDATE SET 
    contact_name = EXCLUDED.contact_name,
    updated_at = NOW()
  RETURNING id INTO v_contact_uuid;

  -- Insertar o actualizar conversación
  INSERT INTO kapso_conversations (
    conversation_id, 
    phone_number, 
    contact_name, 
    last_message_at, 
    user_id
  )
  VALUES (
    p_conversation_id, 
    p_phone_number, 
    p_contact_name, 
    p_timestamp, 
    p_user_id
  )
  ON CONFLICT (conversation_id) 
  DO UPDATE SET 
    contact_name = EXCLUDED.contact_name,
    last_message_at = EXCLUDED.last_message_at,
    updated_at = NOW()
  RETURNING id INTO v_conversation_uuid;

  -- Insertar mensaje
  INSERT INTO kapso_messages (
    message_id,
    conversation_id,
    from_number,
    to_number,
    content,
    message_type,
    timestamp,
    user_id
  )
  VALUES (
    p_message_id,
    p_conversation_id,
    p_from_number,
    p_to_number,
    p_content,
    p_message_type,
    p_timestamp,
    p_user_id
  )
  ON CONFLICT (message_id) DO NOTHING
  RETURNING id INTO v_message_uuid;

  RETURN json_build_object(
    'success', true,
    'conversation_id', v_conversation_uuid,
    'message_id', v_message_uuid,
    'contact_id', v_contact_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CREAR TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at automáticamente
CREATE TRIGGER update_kapso_conversations_updated_at 
  BEFORE UPDATE ON kapso_conversations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kapso_contacts_updated_at 
  BEFORE UPDATE ON kapso_contacts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. CREAR FUNCIÓN PARA OBTENER ESTADÍSTICAS
-- =====================================================

CREATE OR REPLACE FUNCTION get_kapso_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total_conversations INTEGER;
  v_total_messages INTEGER;
  v_total_contacts INTEGER;
  v_active_conversations INTEGER;
BEGIN
  -- Contar conversaciones
  SELECT COUNT(*) INTO v_total_conversations
  FROM kapso_conversations 
  WHERE user_id = p_user_id;

  -- Contar mensajes
  SELECT COUNT(*) INTO v_total_messages
  FROM kapso_messages 
  WHERE user_id = p_user_id;

  -- Contar contactos
  SELECT COUNT(*) INTO v_total_contacts
  FROM kapso_contacts 
  WHERE user_id = p_user_id;

  -- Contar conversaciones activas
  SELECT COUNT(*) INTO v_active_conversations
  FROM kapso_conversations 
  WHERE user_id = p_user_id AND status = 'active';

  RETURN json_build_object(
    'total_conversations', v_total_conversations,
    'total_messages', v_total_messages,
    'total_contacts', v_total_contacts,
    'active_conversations', v_active_conversations
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. VERIFICAR CONFIGURACIÓN
-- =====================================================

-- Verificar que las tablas se crearon correctamente
SELECT 
  'kapso_conversations' as table_name, 
  COUNT(*) as row_count 
FROM kapso_conversations
UNION ALL
SELECT 
  'kapso_messages' as table_name, 
  COUNT(*) as row_count 
FROM kapso_messages
UNION ALL
SELECT 
  'kapso_contacts' as table_name, 
  COUNT(*) as row_count 
FROM kapso_contacts;

-- Verificar que las políticas RLS están activas
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename LIKE 'kapso_%';

-- =====================================================
-- CONFIGURACIÓN COMPLETADA
-- =====================================================
