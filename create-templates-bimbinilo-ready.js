const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTemplates() {
  console.log('📝 Creando templates para bimbinilo con formato NAMED...\n');
  
  try {
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    if (!kapsoApiKey) {
      console.log('❌ KAPSO_API_KEY no configurada');
      return;
    }
    
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
    
    // Templates con formato NAMED - igual que baqufra pero con "A continuacion" en lugar de "en cuanto me confirmes"
    const templates = [
      {
        name: 'inicializador_de_conv',
        language: 'es_AR',
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
        language: 'es_AR',
        category: 'UTILITY',
        parameter_format: 'NAMED',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Nueva orden {{company_name}}',
            example: {
              header_text_named_params: [
                {
                  param_name: 'company_name',
                  example: 'L\'igiene'
                }
              ]
            }
          },
          {
            type: 'BODY',
            text: 'Buen día {{contact_name}}! En cuanto me confirmes, paso el pedido.',
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
        console.log(`\n📝 Creando template: ${template.name}`);
        
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
          const errorSubcode = errorJson.error?.error_subcode;
          const errorUserMsg = errorJson.error?.error_user_msg || '';
          
          console.log(`❌ Error: ${errorMsg}`);
          if (errorUserMsg) {
            console.log(`   📋 Detalle: ${errorUserMsg}`);
          }
          console.log(`   🔍 Código de error: ${errorSubcode}`);
          
          if (errorSubcode === 2388023) {
            console.log(`   ⚠️ Template ${template.name} está siendo eliminado por Meta.`);
            console.log(`   💡 Espera 2-3 minutos más y vuelve a ejecutar este script.`);
            failedCount++;
          } else if (errorSubcode === 2388024 || errorMsg.includes('already exists')) {
            console.log(`   ℹ️ Template ${template.name} ya existe.`);
            createdCount++;
          } else if (errorSubcode === 2388043) {
            console.log(`   ⚠️ Formato del HEADER incorrecto.`);
            console.log(`   🔄 Intentando diferentes formatos...`);
            
            // Intentar diferentes formatos para el HEADER
            if (template.name === 'evio_orden') {
              const formatsToTry = [
                // Formato 1: Sin example
                {
                  ...template,
                  components: template.components.map(comp => {
                    if (comp.type === 'HEADER') {
                      const { example, ...rest } = comp;
                      return rest;
                    }
                    return comp;
                  })
                },
                // Formato 2: Con header_text como array simple
                {
                  ...template,
                  components: template.components.map(comp => {
                    if (comp.type === 'HEADER') {
                      return {
                        ...comp,
                        example: {
                          header_text: ['L\'igiene']
                        }
                      };
                    }
                    return comp;
                  })
                },
                // Formato 3: Sin HEADER, solo BODY
                {
                  ...template,
                  components: template.components.filter(comp => comp.type !== 'HEADER')
                }
              ];
              
              let success = false;
              for (let i = 0; i < formatsToTry.length && !success; i++) {
                console.log(`   🔄 Intentando formato ${i + 1}/${formatsToTry.length}...`);
                
                const retryResponse = await fetch(url, {
                  method: 'POST',
                  headers: {
                    'X-API-Key': kapsoApiKey,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(formatsToTry[i])
                });
                
                const retryText = await retryResponse.text();
                if (retryResponse.ok) {
                  const retryData = JSON.parse(retryText);
                  console.log(`✅ Template ${template.name} creado exitosamente`);
                  console.log(`   ID: ${retryData.id}`);
                  console.log(`   Estado: ${retryData.status}`);
                  createdCount++;
                  success = true;
                } else {
                  const retryError = JSON.parse(retryText);
                  if (i === formatsToTry.length - 1) {
                    console.log(`   ❌ Todos los formatos fallaron. Último error: ${retryError.error?.message || retryText}`);
                    failedCount++;
                  }
                }
                
                // Pausa entre intentos
                if (!success && i < formatsToTry.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            }
          } else {
            failedCount++;
          }
        }
        
        // Pausa entre templates
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.log(`❌ Error inesperado: ${error.message}`);
        failedCount++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Proceso completado');
    console.log(`📊 Resultados: ${createdCount} creados, ${failedCount} fallidos`);
    
    if (createdCount === 2) {
      console.log('\n🎉 ¡Todos los templates fueron creados exitosamente!');
      console.log('💡 Los templates están en estado PENDING esperando aprobación de Meta.');
      console.log('   Revisa el estado en: https://business.facebook.com/ > WhatsApp > Plantillas de mensajes');
    } else if (failedCount > 0) {
      console.log('\n⚠️ Algunos templates fallaron.');
      console.log('   Si el error indica "being deleted", espera 2-3 minutos y vuelve a ejecutar:');
      console.log('   node create-templates-bimbinilo-ready.js');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTemplates();

