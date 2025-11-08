const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTemplatesViaMetaAPI() {
  console.log('📝 Creando templates via Meta Graph API para bimbinilo...');
  
  try {
    // 1. Buscar usuario y configuración
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email === 'bimbinilo.ba@gmail.com');
    
    if (!user) {
      console.error('❌ Usuario no encontrado');
      return;
    }
    
    const { data: config } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (!config) {
      console.error('❌ Configuración activa no encontrada');
      return;
    }
    
    const businessAccountId = config.waba_id || '1111665601092656';
    console.log('✅ Configuración encontrada');
    console.log('📱 Business Account ID:', businessAccountId);
    
    // 2. Intentar obtener access token de Meta
    let accessToken = null;
    
    // Opción 1: Desde variable de entorno
    accessToken = process.env.META_ACCESS_TOKEN_BIMBINILO || process.env.WHATSAPP_API_KEY;
    
    // Opción 2: Desde la configuración en BD
    if (!accessToken && config.meta_access_token) {
      accessToken = config.meta_access_token;
      console.log('✅ Access token encontrado en BD');
    }
    
    // Opción 3: Intentar obtenerlo desde Kapso (poco probable que esté disponible)
    if (!accessToken) {
      console.log('🔍 Intentando obtener access token desde Kapso...');
      const kapsoApiKey = process.env.KAPSO_API_KEY;
      if (kapsoApiKey && config.kapso_config_id) {
        try {
          const response = await fetch(`https://app.kapso.ai/api/v1/whatsapp_configs/${config.kapso_config_id}`, {
            headers: {
              'X-API-Key': kapsoApiKey,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const details = await response.json();
            // Kapso normalmente no expone el access token, pero verificamos
            accessToken = details.data?.access_token || details.access_token;
            if (accessToken) {
              console.log('✅ Access token obtenido desde Kapso');
            }
          }
        } catch (e) {
          // Ignorar
        }
      }
    }
    
    if (!accessToken) {
      console.error('\n❌ Access token de Meta no encontrado');
      console.log('\n💡 Para crear templates via Meta API, necesitas:');
      console.log('   1. Obtener el access token desde Meta Business Manager:');
      console.log('      - Ir a https://business.facebook.com/');
      console.log('      - WhatsApp > Configuración > API');
      console.log('      - O desde Meta Developer Console');
      console.log('   2. Configurarlo como META_ACCESS_TOKEN_BIMBINILO en .env.local');
      console.log('   3. O guardarlo en meta_access_token de la configuración');
      console.log('\n📝 Alternativamente, puedes crear los templates manualmente desde:');
      console.log('   https://business.facebook.com/ > WhatsApp > Plantillas de mensajes');
      return;
    }
    
    console.log('✅ Access token encontrado');
    
    // 3. Templates que necesitamos crear
    const templates = [
      {
        name: 'inicializador_de_conv',
        language: 'es',
        category: 'UTILITY',
        components: [
          {
            type: 'BODY',
            text: '👋 ¡Hola! Iniciando conversación para coordinar pedidos.\n\nEste es un mensaje automático para reiniciar nuestra conversación. A partir de ahora puedes enviarme mensajes libremente para coordinar pedidos y consultas.\n\n¡Gracias por tu colaboración!'
          }
        ]
      },
      {
        name: 'evio_orden',
        language: 'es',
        category: 'UTILITY',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Nueva orden {{1}}'
          },
          {
            type: 'BODY',
            text: 'Buen día {{1}}! En cuanto me confirmes, paso el pedido de esta semana.'
          }
        ]
      }
    ];
    
    const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v23.0';
    
    console.log(`\n📱 Creando templates para Business Account: ${businessAccountId}`);
    
    // 4. Crear cada template
    let createdCount = 0;
    let failedCount = 0;
    
    for (const template of templates) {
      try {
        console.log(`\n📝 Creando template: ${template.name}`);
        
        const templateData = {
          name: template.name,
          language: template.language,
          category: template.category,
          components: template.components
        };
        
        const url = `${WHATSAPP_API_URL}/${businessAccountId}/message_templates`;
        console.log(`📤 URL: ${url}`);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(templateData)
        });
        
        const responseText = await response.text();
        console.log(`📤 Respuesta: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const responseData = JSON.parse(responseText);
          console.log(`✅ Template ${template.name} creado exitosamente`);
          console.log(`   ID: ${responseData.id || 'N/A'}`);
          console.log(`   Estado: ${responseData.status || 'PENDING'}`);
          createdCount++;
        } else {
          console.log(`❌ Error: ${responseText}`);
          
          try {
            const errorJson = JSON.parse(responseText);
            if (errorJson.error) {
              console.log(`   Código: ${errorJson.error.code || 'N/A'}`);
              console.log(`   Mensaje: ${errorJson.error.message || 'N/A'}`);
              
              // Si el template ya existe, contarlo como éxito
              if (errorJson.error.message && errorJson.error.message.includes('already exists')) {
                console.log(`ℹ️ Template ${template.name} ya existe`);
                createdCount++;
              } else {
                failedCount++;
              }
            } else {
              failedCount++;
            }
          } catch (e) {
            failedCount++;
          }
        }
        
      } catch (error) {
        console.log(`❌ Error inesperado: ${error.message}`);
        failedCount++;
      }
    }
    
    console.log('\n✅ Proceso completado');
    console.log(`📊 Resultados: ${createdCount} creados/ya existían, ${failedCount} fallidos`);
    
    if (createdCount > 0) {
      console.log('\n💡 IMPORTANTE:');
      console.log('   Los templates creados necesitan ser aprobados por Meta antes de poder usarse.');
      console.log('   Esto puede tardar desde minutos hasta 24 horas.');
      console.log('   Revisa el estado en: https://business.facebook.com/ > WhatsApp > Plantillas de mensajes');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTemplatesViaMetaAPI();

