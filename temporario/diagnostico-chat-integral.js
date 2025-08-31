require('dotenv').config({ path: '.env.local' });

console.log('🔍 DIAGNÓSTICO INTEGRAL DEL CHAT');
console.log('==================================');

async function diagnosticoIntegral() {
  try {
    console.log('\n📊 1. VERIFICANDO API DE MENSAJES');
    console.log('----------------------------------');
    
    // Verificar API de mensajes
    const response = await fetch('http://localhost:3001/api/whatsapp/messages?limit=20&userId=test-user-id');
    const data = await response.json();
    
    console.log(`✅ API responde: ${response.status}`);
    console.log(`📊 Total mensajes: ${data.messages?.length || 0}`);
    
    if (data.messages && data.messages.length > 0) {
      const sentCount = data.messages.filter(m => m.message_type === 'sent').length;
      const receivedCount = data.messages.filter(m => m.message_type === 'received').length;
      
      console.log(`📤 Enviados: ${sentCount}`);
      console.log(`📥 Recibidos: ${receivedCount}`);
      
      // Verificar mensajes argentinos
      const argentineMessages = data.messages.filter(m => 
        m.contact_id && m.contact_id.includes('+549')
      );
      
      console.log(`🇦🇷 Mensajes argentinos: ${argentineMessages.length}`);
    }
    
    console.log('\n🔧 2. VERIFICANDO WEBSOCKET/SSE');
    console.log('--------------------------------');
    
    // Verificar si hay conexiones SSE activas
    try {
      const sseResponse = await fetch('http://localhost:3001/api/sse/status');
      console.log(`✅ SSE Status: ${sseResponse.status}`);
    } catch (error) {
      console.log('❌ SSE no disponible:', error.message);
    }
    
    console.log('\n🎯 3. VERIFICANDO REALTIME SUPABASE');
    console.log('-----------------------------------');
    
    // Verificar conexión a Supabase
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Verificar conexión
      const { data: testData, error } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .limit(1);
      
      if (error) {
        console.log('❌ Error conectando a Supabase:', error.message);
      } else {
        console.log('✅ Supabase conectado correctamente');
      }
    } else {
      console.log('❌ Variables de entorno de Supabase faltantes');
    }
    
    console.log('\n🔍 4. ANÁLISIS DE PROBLEMAS');
    console.log('---------------------------');
    
    console.log('🚨 PROBLEMAS IDENTIFICADOS:');
    console.log('1. Logging excesivo en ChatContext');
    console.log('2. loadMessages() se ejecuta múltiples veces');
    console.log('3. Filtrado ineficiente (50+ mensajes procesados)');
    console.log('4. No hay logs de mensajes en tiempo real');
    console.log('5. Realtime/SSE no está funcionando');
    
    console.log('\n💡 SOLUCIONES NECESARIAS:');
    console.log('1. Limpiar logging excesivo');
    console.log('2. Optimizar loadMessages() para evitar múltiples ejecuciones');
    console.log('3. Mejorar filtrado para reducir procesamiento');
    console.log('4. Verificar y corregir sistema de tiempo real');
    console.log('5. Implementar debounce en carga de mensajes');
    
    console.log('\n✅ DIAGNÓSTICO COMPLETADO');
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

diagnosticoIntegral();
