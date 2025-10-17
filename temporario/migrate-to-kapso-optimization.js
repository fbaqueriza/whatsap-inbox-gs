// Script de migración para optimizar el sistema con Kapso + Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const migrateToKapsoOptimization = async () => {
  console.log('🚀 Iniciando migración a optimización de Kapso...');
  
  try {
    // 1. Verificar si las tablas de Kapso existen
    console.log('📋 Verificando tablas de Kapso...');
    
    const { data: conversations, error: convError } = await supabase
      .from('kapso_conversations')
      .select('id')
      .limit(1);

    if (convError && convError.code === '42P01') {
      console.log('⚠️ Las tablas de Kapso no existen. Ejecuta primero el script de configuración.');
      console.log('📋 Ejecuta: node temporario/setup-kapso-supabase-sync.js');
      return;
    }

    console.log('✅ Tablas de Kapso verificadas');

    // 2. Migrar datos existentes de whatsapp_messages a kapso_messages
    console.log('🔄 Migrando mensajes existentes...');
    
    const { data: existingMessages, error: messagesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .limit(100); // Migrar en lotes

    if (messagesError) {
      console.error('❌ Error obteniendo mensajes existentes:', messagesError);
      return;
    }

    if (existingMessages && existingMessages.length > 0) {
      console.log(`📊 Encontrados ${existingMessages.length} mensajes para migrar`);
      
      for (const message of existingMessages) {
        try {
          // Mapear mensaje existente a formato de Kapso
          const conversationId = `conv_${message.contact_id}_${Date.now()}`;
          
          const { error: syncError } = await supabase.rpc('sync_kapso_data', {
            p_conversation_id: conversationId,
            p_phone_number: message.contact_id,
            p_contact_name: null,
            p_message_id: message.id,
            p_from_number: message.contact_id,
            p_to_number: 'unknown',
            p_content: message.content,
            p_message_type: message.message_type || 'text',
            p_timestamp: message.timestamp,
            p_user_id: message.user_id
          });

          if (syncError) {
            console.error(`❌ Error migrando mensaje ${message.id}:`, syncError);
          } else {
            console.log(`✅ Mensaje ${message.id} migrado exitosamente`);
          }
        } catch (error) {
          console.error(`❌ Error inesperado migrando mensaje ${message.id}:`, error);
        }
      }
    } else {
      console.log('📭 No hay mensajes existentes para migrar');
    }

    // 3. Crear endpoint de migración
    console.log('🔧 Creando endpoint de migración...');
    
    const migrationEndpoint = `
// Endpoint de migración temporal
// POST /api/kapso/migrate

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const { data: messages, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .limit(1000);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let migrated = 0;
    let errors = 0;

    for (const message of messages || []) {
      try {
        const conversationId = \`conv_\${message.contact_id}_\${Date.now()}\`;
        
        await supabase.rpc('sync_kapso_data', {
          p_conversation_id: conversationId,
          p_phone_number: message.contact_id,
          p_contact_name: null,
          p_message_id: message.id,
          p_from_number: message.contact_id,
          p_to_number: 'unknown',
          p_content: message.content,
          p_message_type: message.message_type || 'text',
          p_timestamp: message.timestamp,
          p_user_id: message.user_id
        });

        migrated++;
      } catch (error) {
        errors++;
        console.error('Error migrando mensaje:', error);
      }
    }

    return NextResponse.json({
      success: true,
      migrated,
      errors,
      total: messages?.length || 0
    });

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
    `;

    console.log('📝 Endpoint de migración creado:');
    console.log(migrationEndpoint);

    // 4. Crear script de verificación
    console.log('🔍 Creando script de verificación...');
    
    const verificationScript = `
// Script para verificar la migración
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const verifyMigration = async () => {
  console.log('🔍 Verificando migración...');
  
  // Verificar conversaciones
  const { data: conversations, error: convError } = await supabase
    .from('kapso_conversations')
    .select('*');
  
  console.log('📊 Conversaciones de Kapso:', conversations?.length || 0);
  
  // Verificar mensajes
  const { data: messages, error: msgError } = await supabase
    .from('kapso_messages')
    .select('*');
  
  console.log('📊 Mensajes de Kapso:', messages?.length || 0);
  
  // Verificar contactos
  const { data: contacts, error: contactError } = await supabase
    .from('kapso_contacts')
    .select('*');
  
  console.log('📊 Contactos de Kapso:', contacts?.length || 0);
  
  if (convError) console.error('❌ Error verificando conversaciones:', convError);
  if (msgError) console.error('❌ Error verificando mensajes:', msgError);
  if (contactError) console.error('❌ Error verificando contactos:', contactError);
};

verifyMigration();
    `;

    console.log('📝 Script de verificación:');
    console.log(verificationScript);

    console.log('🎉 Migración a optimización de Kapso completada');
    console.log('📋 Próximos pasos:');
    console.log('   1. Ejecutar el SQL en Supabase SQL Editor');
    console.log('   2. Configurar Kapso para usar las nuevas tablas');
    console.log('   3. Actualizar el frontend para usar KapsoChatPanel');
    console.log('   4. Probar la migración con el script de verificación');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
  }
};

migrateToKapsoOptimization();
