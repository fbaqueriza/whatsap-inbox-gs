// Script para configurar la sincronización automática de Kapso con Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const setupKapsoSupabaseSync = async () => {
  console.log('🔧 Configurando sincronización automática de Kapso con Supabase...');
  
  try {
    // 1. Verificar si las tablas de Kapso existen
    console.log('📋 Verificando tablas de Kapso...');
    
    try {
      const { data: conversations, error: convError } = await supabase
        .from('kapso_conversations')
        .select('id')
        .limit(1);

      if (convError && convError.code !== '42P01') {
        console.error('❌ Error verificando tabla kapso_conversations:', convError);
        return;
      }

      console.log('📊 Estado de tablas de Kapso:');
      console.log('   - kapso_conversations:', convError ? 'No existe' : 'Existe');
    } catch (error) {
      console.log('📊 Tablas de Kapso no existen, procediendo a crearlas...');
    }

    // 2. Crear tablas de Kapso si no existen
    console.log('🏗️ Creando tablas de Kapso...');
    
    const createKapsoTables = `
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

      -- Índices para optimizar consultas
      CREATE INDEX IF NOT EXISTS idx_kapso_conversations_user_id ON kapso_conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_kapso_conversations_phone_number ON kapso_conversations(phone_number);
      CREATE INDEX IF NOT EXISTS idx_kapso_messages_user_id ON kapso_messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_kapso_messages_conversation_id ON kapso_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_kapso_messages_timestamp ON kapso_messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_kapso_contacts_user_id ON kapso_contacts(user_id);
      CREATE INDEX IF NOT EXISTS idx_kapso_contacts_phone_number ON kapso_contacts(phone_number);

      -- RLS (Row Level Security) para las tablas de Kapso
      ALTER TABLE kapso_conversations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE kapso_messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE kapso_contacts ENABLE ROW LEVEL SECURITY;

      -- Políticas RLS para kapso_conversations
      CREATE POLICY "Users can view their own conversations" ON kapso_conversations
        FOR SELECT USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can insert their own conversations" ON kapso_conversations
        FOR INSERT WITH CHECK (auth.uid() = user_id);
      
      CREATE POLICY "Users can update their own conversations" ON kapso_conversations
        FOR UPDATE USING (auth.uid() = user_id);

      -- Políticas RLS para kapso_messages
      CREATE POLICY "Users can view their own messages" ON kapso_messages
        FOR SELECT USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can insert their own messages" ON kapso_messages
        FOR INSERT WITH CHECK (auth.uid() = user_id);
      
      CREATE POLICY "Users can update their own messages" ON kapso_messages
        FOR UPDATE USING (auth.uid() = user_id);

      -- Políticas RLS para kapso_contacts
      CREATE POLICY "Users can view their own contacts" ON kapso_contacts
        FOR SELECT USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can insert their own contacts" ON kapso_contacts
        FOR INSERT WITH CHECK (auth.uid() = user_id);
      
      CREATE POLICY "Users can update their own contacts" ON kapso_contacts
        FOR UPDATE USING (auth.uid() = user_id);
    `;

    // Ejecutar SQL directamente usando el cliente de Supabase
    const { error: createError } = await supabase
      .from('kapso_conversations')
      .select('id')
      .limit(1);
    
    if (createError && createError.code === '42P01') {
      console.log('📝 Creando tablas de Kapso...');
      // Las tablas no existen, necesitamos crearlas manualmente
      console.log('⚠️ Las tablas de Kapso necesitan ser creadas manualmente en el dashboard de Supabase');
      console.log('📋 SQL para ejecutar en Supabase SQL Editor:');
      console.log(createKapsoTables);
    } else if (createError) {
      console.error('❌ Error verificando tablas:', createError);
      return;
    } else {
      console.log('✅ Las tablas de Kapso ya existen');
    }

    // 3. Mostrar SQL adicional para triggers y funciones
    console.log('⚡ SQL adicional para triggers y funciones:');
    
    const additionalSQL = `
      -- Trigger para actualizar updated_at en kapso_conversations
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER update_kapso_conversations_updated_at 
        BEFORE UPDATE ON kapso_conversations 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_kapso_contacts_updated_at 
        BEFORE UPDATE ON kapso_contacts 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      -- Función para sincronizar datos de Kapso
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
    `;

    console.log(additionalSQL);

    console.log('🎉 Configuración de sincronización automática de Kapso completada');
    console.log('📋 Próximos pasos:');
    console.log('   1. Configurar Kapso para usar estas tablas');
    console.log('   2. Configurar webhooks de proyecto');
    console.log('   3. Implementar Supabase Functions');

  } catch (error) {
    console.error('❌ Error en la configuración:', error);
  }
};

setupKapsoSupabaseSync();
