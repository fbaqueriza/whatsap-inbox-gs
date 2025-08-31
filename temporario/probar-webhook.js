require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function probarWebhook() {
  console.log('🧪 PROBANDO FUNCIONAMIENTO DEL WEBHOOK\n');

  try {
    // 1. Verificar configuración
    console.log('🔧 1. VERIFICANDO CONFIGURACIÓN');
    
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    
    console.log(`✅ Webhook URL: ${webhookUrl}`);
    console.log(`✅ Verify Token: ${verifyToken ? 'Configurado' : 'NO CONFIGURADO'}`);
    
    // 2. Simular un mensaje de prueba
    console.log('\n📱 2. SIMULANDO MENSAJE DE PRUEBA');
    
    // Crear un mensaje de prueba que simule lo que enviaría Meta
    const mensajePrueba = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '1123051623072203',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '5491135562673',
              phone_number_id: '670680919470999'
            },
            contacts: [{
              profile: {
                name: 'Proveedor Test'
              },
              wa_id: '5491135562673'
            }],
            messages: [{
              from: '5491135562673',
              id: 'wamid.test_' + Date.now(),
              timestamp: Math.floor(Date.now() / 1000),
              text: {
                body: 'Mensaje de prueba desde webhook - ' + new Date().toLocaleString()
              },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };
    
    console.log('📤 Mensaje de prueba creado');
    console.log(`📝 Contenido: ${mensajePrueba.entry[0].changes[0].value.messages[0].text.body}`);
    
    // 3. Verificar mensajes antes de la prueba
    console.log('\n📊 3. VERIFICANDO MENSAJES ANTES DE LA PRUEBA');
    
    const { data: mensajesAntes, error: errorAntes } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', '+5491135562673')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Última hora
      .order('created_at', { ascending: false });
    
    if (errorAntes) {
      console.error('❌ Error obteniendo mensajes:', errorAntes);
      return;
    }
    
    console.log(`✅ Mensajes del proveedor en la última hora: ${mensajesAntes.length}`);
    
    // 4. Probar el webhook directamente
    console.log('\n🌐 4. PROBANDO WEBHOOK DIRECTAMENTE');
    
    try {
      const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
      
      console.log(`🔗 Enviando petición POST a: ${webhookUrl}`);
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mensajePrueba)
      });
      
      console.log(`📡 Respuesta del webhook: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const responseText = await response.text();
        console.log(`📄 Contenido de respuesta: ${responseText}`);
        console.log('✅ Webhook respondió correctamente');
      } else {
        console.log('❌ Webhook respondió con error');
      }
      
    } catch (error) {
      console.log('❌ Error probando webhook:', error.message);
      console.log('💡 Esto puede indicar que:');
      console.log('   - El servidor no está corriendo');
      console.log('   - La URL no es accesible');
      console.log('   - Hay un problema de conectividad');
    }
    
    // 5. Esperar un momento y verificar si se guardó el mensaje
    console.log('\n⏳ 5. ESPERANDO Y VERIFICANDO RESULTADO');
    
    console.log('⏰ Esperando 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const { data: mensajesDespues, error: errorDespues } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', '+5491135562673')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Última hora
      .order('created_at', { ascending: false });
    
    if (errorDespues) {
      console.error('❌ Error obteniendo mensajes después:', errorDespues);
      return;
    }
    
    console.log(`✅ Mensajes del proveedor después de la prueba: ${mensajesDespues.length}`);
    
    // 6. Analizar resultado
    console.log('\n🔍 6. ANÁLISIS DEL RESULTADO');
    
    const mensajesNuevos = mensajesDespues.length - mensajesAntes.length;
    
    if (mensajesNuevos > 0) {
      console.log('🎉 ¡ÉXITO! El webhook está funcionando correctamente');
      console.log(`📥 Se guardaron ${mensajesNuevos} mensajes nuevos`);
      
      // Mostrar el mensaje más reciente
      const mensajeMasReciente = mensajesDespues[0];
      console.log(`📝 Mensaje más reciente: ${mensajeMasReciente.content}`);
      console.log(`🕐 Timestamp: ${new Date(mensajeMasReciente.created_at).toLocaleString()}`);
      console.log(`🆔 Message SID: ${mensajeMasReciente.message_sid}`);
      
    } else {
      console.log('❌ PROBLEMA: No se guardaron mensajes nuevos');
      console.log('💡 Posibles causas:');
      console.log('   - El webhook no está procesando los mensajes');
      console.log('   - Hay un error en la función saveMessageWithUserId');
      console.log('   - El proveedor no está registrado correctamente');
      console.log('   - Hay un problema de permisos en la BD');
    }
    
    // 7. Verificar mensajes del webhook específicamente
    console.log('\n📋 7. VERIFICANDO MENSAJES DEL WEBHOOK');
    
    const mensajesWebhook = mensajesDespues.filter(msg => 
      msg.message_sid?.startsWith('webhook_') || 
      msg.content?.includes('Mensaje de prueba desde webhook')
    );
    
    console.log(`📥 Mensajes del webhook: ${mensajesWebhook.length}`);
    
    if (mensajesWebhook.length > 0) {
      console.log('✅ El webhook está guardando mensajes correctamente');
    } else {
      console.log('❌ El webhook no está guardando mensajes');
    }
    
    // 8. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    
    if (mensajesNuevos > 0) {
      console.log('✅ El webhook está funcionando correctamente');
      console.log('💡 Para que lleguen mensajes reales del proveedor:');
      console.log('   1. Verificar que el webhook esté suscrito a eventos de mensajes');
      console.log('   2. Probar enviando un mensaje real desde el WhatsApp del proveedor');
      console.log('   3. Verificar los logs del servidor en Vercel');
    } else {
      console.log('❌ El webhook no está funcionando');
      console.log('💡 Pasos para solucionar:');
      console.log('   1. Verificar que el servidor esté corriendo en Vercel');
      console.log('   2. Revisar los logs del servidor');
      console.log('   3. Verificar que el webhook esté suscrito a eventos');
      console.log('   4. Probar con un mensaje real del proveedor');
    }

  } catch (error) {
    console.error('❌ Error en prueba:', error);
  }
}

probarWebhook();
