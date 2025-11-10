const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * IMPORTANTE: Este script requiere el access token de Meta para el Business Account de bimbinilo.
 * El access token se puede obtener desde:
 * 1. Meta Business Manager > Configuración de la aplicación > Tokens
 * 2. O desde la configuración de WhatsApp en Kapso (si está disponible)
 * 
 * Para usar este script:
 * 1. Obtener el access token de Meta para el Business Account 1111665601092656
 * 2. Configurarlo como META_ACCESS_TOKEN_BIMBINILO en .env.local
 * 3. Ejecutar este script
 */

async function createTemplatesViaMetaAPI() {
  console.log('📝 Creando templates via Meta Graph API para bimbinilo...');
  
  try {
    // Buscar usuario bimbinilo
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email === 'bimbinilo.ba@gmail.com');
    
    if (!user) {
      console.error('❌ Usuario bimbinilo.ba@gmail.com no encontrado');
      return;
    }
    
    // Buscar configuración de WhatsApp
    const { data: configs, error: configError } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (configError || !configs || configs.length === 0) {
      console.error('❌ Configuración no encontrada');
      return;
    }
    
    const config = configs.find(c => c.is_active) || configs[0];
    const businessAccountId = config.waba_id || '1111665601092656';
    
    console.log('✅ Usuario encontrado:', user.id);
    console.log('📱 Configuración:', config.id);
    console.log('📱 Business Account ID:', businessAccountId);
    
    // Obtener access token de Meta
    // Opción 1: Desde variable de entorno específica
    let accessToken = process.env.META_ACCESS_TOKEN_BIMBINILO;
    
    // Opción 2: Intentar obtenerlo desde la configuración (si está guardado)
    if (!accessToken && config.meta_access_token) {
      accessToken = config.meta_access_token;
    }
    
    // Opción 3: Intentar obtenerlo desde Kapso
    if (!accessToken) {
      console.log('🔍 Intentando obtener access token desde Kapso...');
      const kapsoApiKey = process.env.KAPSO_API_KEY;
      if (kapsoApiKey) {
        try {
          const configDetailsResponse = await fetch(`https://app.kapso.ai/api/v1/whatsapp_configs/${config.kapso_config_id}`, {
            headers: {
              'X-API-Key': kapsoApiKey,
              'Content-Type': 'application/json'
            }
          });
          
          if (configDetailsResponse.ok) {
            const configDetails = await configDetailsResponse.json();
            // El access token podría estar en los detalles, aunque normalmente Kapso no lo expone
            console.log('📊 Detalles de Kapso obtenidos (revisando si hay access token)...');
          }
        } catch (e) {
          console.log('⚠️ No se pudo obtener desde Kapso');
        }
      }
    }
    
    if (!accessToken) {
      console.error('\n❌ Access token de Meta no encontrado');
      console.log('\n💡 Para crear templates via Meta API, necesitas:');
      console.log('   1. Obtener el access token de Meta desde Meta Business Manager');
      console.log('   2. Configurarlo como META_ACCESS_TOKEN_BIMBINILO en .env.local');
      console.log('   3. O guardarlo en meta_access_token de la configuración de WhatsApp');
      console.log('\n📝 Alternativamente, puedes crear los templates manualmente desde:');
      console.log('   https://business.facebook.com/ > WhatsApp > Plantillas de mensajes');
      return;
    }
    
    console.log('✅ Access token encontrado');
    
    // Templates que necesitamos crear
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
    
    // Crear cada template
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
        
        console.log(`📤 Respuesta: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const responseData = await response.json();
          console.log(`✅ Template ${template.name} creado exitosamente:`, JSON.stringify(responseData, null, 2));
        } else {
          const errorData = await response.text();
          console.log(`❌ Error creando template ${template.name}:`, errorData);
          
          try {
            const errorJson = JSON.parse(errorData);
            console.log('📋 Detalles del error:', JSON.stringify(errorJson, null, 2));
          } catch (e) {
            // Si no se puede parsear, ya se mostró como texto
          }
        }
        
      } catch (error) {
        console.log(`❌ Error inesperado creando template ${template.name}:`, error.message);
      }
    }
    
    console.log('\n✅ Proceso completado');
    console.log('\n💡 IMPORTANTE:');
    console.log('   Los templates creados necesitan ser aprobados por Meta antes de poder usarse.');
    console.log('   Revisa el estado en: https://business.facebook.com/ > WhatsApp > Plantillas de mensajes');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTemplatesViaMetaAPI();

