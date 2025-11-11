const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTemplatesNamed() {
  console.log('📝 Creando templates para bimbinilo con formato NAMED...\n');
  
  try {
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    if (!kapsoApiKey) {
      console.log('❌ KAPSO_API_KEY no configurada');
      return;
    }
    
    // Buscar usuario y configuración
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
    const KAPSO_API_URL = 'https://api.kapso.ai/meta/whatsapp/v23.0';
    
    console.log('✅ Configuración encontrada');
    console.log('📱 Business Account ID:', businessAccountId);
    console.log('\n⏳ IMPORTANTE: Si los templates están siendo eliminados, espera 2-3 minutos antes de crear nuevos.\n');
    
    // Templates con formato NAMED correcto
    // Para HEADER con NAMED, según la documentación, el ejemplo puede no ser necesario o usar formato diferente
    // Intentaremos sin example en HEADER primero, o con el formato más simple
    const templates = [
      {
        name: 'inicializador_de_conv',
        language: 'es',
        category: 'UTILITY',
        parameter_format: 'NAMED',
        components: [
          {
            type: 'BODY',
            text: 'Hola! Este es un mensaje para que retomemos nuestra conversacion. En cuanto me respondas podemos seguir conversando.'
          }
        ]
      },
      {
        name: 'evio_orden',
        language: 'es',
        category: 'UTILITY',
        parameter_format: 'NAMED',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Nueva orden {{provider_name}}',
            example: {
              header_text: ['L\'igiene']
            }
          },
          {
            type: 'BODY',
            text: 'Buen día {{contact_name}}! A continuacion, paso el pedido de esta semana.',
            example: {
              body_text_named_params: [
                {
                  param_name: 'contact_name',
                  example: 'L\'igiene'
                }
              ]
            }
          }
        ]
      }
    ];
    
    let createdCount = 0;
    let failedCount = 0;
    
    for (const template of templates) {
      try {
        console.log(`📝 Creando template: ${template.name}`);
        
        const url = `${KAPSO_API_URL}/${businessAccountId}/message_templates`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'X-API-Key': kapsoApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(template)
        });
        
        const responseText = await response.text();
        
        if (response.ok) {
          const responseData = JSON.parse(responseText);
          console.log(`✅ Template ${template.name} creado exitosamente`);
          console.log(`   ID: ${responseData.id}`);
          console.log(`   Estado: ${responseData.status}`);
          createdCount++;
        } else {
          const errorJson = JSON.parse(responseText);
          const errorMsg = errorJson.error?.message || '';
          const errorCode = errorJson.error?.code;
          
          console.log(`❌ Error (${errorCode}): ${errorMsg}`);
          
          if (errorMsg.includes('being deleted')) {
            console.log(`   ⚠️ Template ${template.name} está siendo eliminado. Espera 2-3 minutos y vuelve a ejecutar el script.`);
          } else if (errorMsg.includes('already exists') || errorMsg.includes('Already Exists')) {
            console.log(`   ℹ️ Template ${template.name} ya existe`);
            createdCount++;
          } else if (errorMsg.includes('header_text')) {
            console.log(`   ⚠️ Formato del HEADER incorrecto. Intentando sin example...`);
            // Intentar sin example en HEADER
            if (template.name === 'evio_orden') {
              const templateWithoutHeaderExample = {
                ...template,
                components: template.components.map(comp => {
                  if (comp.type === 'HEADER') {
                    const { example, ...rest } = comp;
                    return rest;
                  }
                  return comp;
                })
              };
              
              const retryResponse = await fetch(url, {
                method: 'POST',
                headers: {
                  'X-API-Key': kapsoApiKey,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(templateWithoutHeaderExample)
              });
              
              const retryText = await retryResponse.text();
              if (retryResponse.ok) {
                const retryData = JSON.parse(retryText);
                console.log(`✅ Template ${template.name} creado (sin example en HEADER)`);
                console.log(`   ID: ${retryData.id}`);
                createdCount++;
              } else {
                console.log(`   ❌ Error en reintento: ${retryText}`);
                failedCount++;
              }
            } else {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        }
        
        console.log('');
        
        // Pequeña pausa entre templates
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.log(`❌ Error inesperado: ${error.message}\n`);
        failedCount++;
      }
    }
    
    console.log('✅ Proceso completado');
    console.log(`📊 Resultados: ${createdCount} creados, ${failedCount} fallidos`);
    
    if (createdCount > 0) {
      console.log('\n💡 Los templates están en estado PENDING esperando aprobación de Meta.');
    }
    
    if (failedCount > 0) {
      console.log('\n⚠️ Si los errores indican "being deleted", espera 2-3 minutos y vuelve a ejecutar este script.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTemplatesNamed();

