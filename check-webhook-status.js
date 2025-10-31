const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWebhookStatus() {
  console.log('🔍 Verificando estado del webhook...');
  
  try {
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    if (!kapsoApiKey) {
      console.log('❌ KAPSO_API_KEY no configurada');
      return;
    }
    
    // Verificar configuración de WhatsApp
    const whatsappConfigId = 'bae605ec-7674-40da-8787-1990cc42cbb3';
    
    console.log(`📱 Verificando configuración: ${whatsappConfigId}`);
    
    const response = await fetch(`https://app.kapso.ai/api/v1/whatsapp_configs/${whatsappConfigId}`, {
      headers: {
        'X-API-Key': kapsoApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📤 Respuesta: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const configData = await response.json();
      console.log('✅ Configuración encontrada:');
      console.log(`   ID: ${configData.data.id}`);
      console.log(`   Estado: ${configData.data.status}`);
      console.log(`   Teléfono: ${configData.data.display_phone_number}`);
      console.log(`   Webhook verificado: ${configData.data.webhook_verified_at}`);
      console.log(`   Procesamiento entrante: ${configData.data.inbound_processing_enabled}`);
      
      // Verificar si hay webhook configurado
      if (configData.data.webhook_verified_at) {
        console.log('✅ Webhook está configurado y verificado');
      } else {
        console.log('⚠️ Webhook no está verificado');
      }
      
      if (configData.data.inbound_processing_enabled) {
        console.log('✅ Procesamiento de mensajes entrantes habilitado');
      } else {
        console.log('⚠️ Procesamiento de mensajes entrantes deshabilitado');
      }
      
    } else {
      const errorData = await response.text();
      console.log('❌ Error:', errorData);
    }
    
    // Verificar mensajes en la base de datos
    console.log('\n📨 Verificando mensajes en la base de datos...');
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (messagesError) {
      console.log('❌ Error obteniendo mensajes:', messagesError);
    } else {
      console.log(`📱 Total de mensajes: ${messages?.length || 0}`);
      if (messages && messages.length > 0) {
        messages.forEach((message, index) => {
          console.log(`\n${index + 1}. De: ${message.from_number}`);
          console.log(`   Texto: ${message.message_text}`);
          console.log(`   Dirección: ${message.direction}`);
          console.log(`   Plataforma: ${message.platform}`);
          console.log(`   Fecha: ${message.created_at}`);
        });
      } else {
        console.log('📭 No hay mensajes en la base de datos');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkWebhookStatus();
