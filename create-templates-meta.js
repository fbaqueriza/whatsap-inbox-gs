const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTemplatesViaMeta() {
  console.log('📝 Creando templates via Meta Graph API...');
  
  try {
    // Obtener configuración de WhatsApp del usuario baqufra
    const { data: configData, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (configError || !configData || configData.length === 0) {
      console.log('❌ No hay configuraciones de WhatsApp');
      return;
    }
    
    const config = configData[0];
    console.log(`👤 Usuario: ${config.user_id}`);
    console.log(`📱 Configuración: ${config.kapso_config_id}`);
    
    // Datos de la configuración de WhatsApp conectada
    const businessAccountId = '807116708882527';
    const phoneNumberId = '842420582288633';
    
    console.log(`📱 Business Account ID: ${businessAccountId}`);
    console.log(`📱 Phone Number ID: ${phoneNumberId}`);
    
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
            type: 'BODY',
            text: '🛒 *NUEVA ORDEN - {{provider_name}}*\n\nBuen día {{contact_name}}! En cuanto me confirmes, paso el pedido de esta semana.'
          }
        ]
      }
    ];
    
    // Intentar crear templates usando Meta Graph API directamente
    const accessToken = process.env.META_ACCESS_TOKEN; // Necesitarías configurar esto
    
    if (!accessToken) {
      console.log('❌ META_ACCESS_TOKEN no configurado');
      console.log('💡 Para crear templates via Meta, necesitas:');
      console.log('   1. Un access token de Meta con permisos de WhatsApp Business');
      console.log('   2. Configurar META_ACCESS_TOKEN en .env.local');
      console.log('   3. O crear los templates manualmente en WhatsApp Business Manager');
      return;
    }
    
    for (const template of templates) {
      try {
        console.log(`📝 Creando template via Meta: ${template.name}`);
        
        const templateData = {
          name: template.name,
          language: template.language,
          category: template.category,
          components: template.components
        };
        
        const response = await fetch(`https://graph.facebook.com/v18.0/${businessAccountId}/message_templates`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(templateData)
        });
        
        console.log(`📤 Respuesta de Meta para ${template.name}: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const responseData = await response.json();
          console.log(`✅ Template ${template.name} creado exitosamente:`, responseData);
        } else {
          const errorData = await response.text();
          console.log(`❌ Error creando template ${template.name}:`, errorData);
        }
        
      } catch (error) {
        console.log(`❌ Error inesperado creando template ${template.name}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTemplatesViaMeta();
