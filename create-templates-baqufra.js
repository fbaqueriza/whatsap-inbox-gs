const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTemplatesForBaqufra() {
  console.log('📝 Creando templates para usuario baqufra...');
  
  try {
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    if (!kapsoApiKey) {
      console.log('❌ KAPSO_API_KEY no configurada');
      return;
    }
    
    // ID de la configuración de WhatsApp conectada
    const whatsappConfigId = 'bae605ec-7674-40da-8787-1990cc42cbb3';
    
    // Templates que necesitamos crear
    const templates = [
      {
        name: 'inicializador_de_conv',
        language_code: 'es',
        category: 'UTILITY',
        content: '👋 ¡Hola! Iniciando conversación para coordinar pedidos.\n\nEste es un mensaje automático para reiniciar nuestra conversación. A partir de ahora puedes enviarme mensajes libremente para coordinar pedidos y consultas.\n\n¡Gracias por tu colaboración!'
      },
      {
        name: 'evio_orden',
        language_code: 'es',
        category: 'UTILITY',
        content: '🛒 *NUEVA ORDEN - {{provider_name}}*\n\nBuen día {{contact_name}}! En cuanto me confirmes, paso el pedido de esta semana.'
      }
    ];
    
    console.log(`📱 Creando templates para configuración: ${whatsappConfigId}`);
    
    for (const template of templates) {
      try {
        console.log(`📝 Creando template: ${template.name}`);
        
        const templateData = {
          template: {
            business_account_id: '807116708882527', // Business Account ID de la configuración
            name: template.name,
            language_code: template.language_code,
            category: template.category,
            content: template.content
          }
        };
        
        const response = await fetch('https://app.kapso.ai/api/v1/whatsapp_templates', {
          method: 'POST',
          headers: {
            'X-API-Key': kapsoApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(templateData)
        });
        
        console.log(`📤 Respuesta de Kapso para ${template.name}: ${response.status} ${response.statusText}`);
        
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
    
    console.log('✅ Proceso de creación de templates completado');
    
    // Verificar templates creados
    console.log('\n🔍 Verificando templates creados...');
    const templatesResponse = await fetch('https://app.kapso.ai/api/v1/whatsapp_templates', {
      headers: {
        'X-API-Key': kapsoApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (templatesResponse.ok) {
      const templatesData = await templatesResponse.json();
      console.log(`📱 Total de templates: ${templatesData.data?.length || 0}`);
      if (templatesData.data && templatesData.data.length > 0) {
        templatesData.data.forEach((template, index) => {
          console.log(`\n${index + 1}. Nombre: ${template.name}`);
          console.log(`   Estado: ${template.status || 'N/A'}`);
          console.log(`   Idioma: ${template.language || 'N/A'}`);
          console.log(`   Categoría: ${template.category || 'N/A'}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTemplatesForBaqufra();
