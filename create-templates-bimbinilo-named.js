const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAndCreateTemplates() {
  console.log('📝 Eliminando y recreando templates para bimbinilo con formato NAMED...\n');
  
  try {
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    if (!kapsoApiKey) {
      console.log('❌ KAPSO_API_KEY no configurada');
      return;
    }
    
    // 1. Buscar usuario
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email === 'bimbinilo.ba@gmail.com');
    
    if (!user) {
      console.error('❌ Usuario no encontrado');
      return;
    }
    
    // 2. Buscar configuración
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
    
    const KAPSO_API_URL = 'https://api.kapso.ai/meta/whatsapp/v23.0';
    
    // 3. Listar templates existentes para eliminarlos
    console.log('\n🔍 Buscando templates existentes para eliminar...');
    const listResponse = await fetch(`${KAPSO_API_URL}/${businessAccountId}/message_templates`, {
      headers: {
        'X-API-Key': kapsoApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (listResponse.ok) {
      const listData = await listResponse.json();
      const templates = listData.data || [];
      const templatesToDelete = templates.filter(t => 
        ['inicializador_de_conv', 'evio_orden'].includes(t.name)
      );
      
      console.log(`📋 Templates encontrados para eliminar: ${templatesToDelete.length}`);
      
      // Eliminar templates existentes
      for (const template of templatesToDelete) {
        try {
          console.log(`🗑️ Eliminando template: ${template.name} (ID: ${template.id})`);
          const deleteResponse = await fetch(
            `${KAPSO_API_URL}/${businessAccountId}/message_templates/${template.id}`,
            {
              method: 'DELETE',
              headers: {
                'X-API-Key': kapsoApiKey,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (deleteResponse.ok) {
            console.log(`✅ Template ${template.name} eliminado`);
          } else {
            const errorText = await deleteResponse.text();
            console.log(`⚠️ No se pudo eliminar ${template.name}: ${errorText}`);
          }
        } catch (error) {
          console.log(`⚠️ Error eliminando ${template.name}: ${error.message}`);
        }
      }
      
      // Esperar un momento para que Meta procese la eliminación
      if (templatesToDelete.length > 0) {
        console.log('\n⏳ Esperando 10 segundos para que Meta procese la eliminación...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        // Si no se encontraron templates pero Meta dice que están siendo eliminados, esperar
        console.log('\n⏳ Esperando 90 segundos por si hay templates en proceso de eliminación...');
        await new Promise(resolve => setTimeout(resolve, 90000));
      }
    }
    
    // 4. Crear templates con formato NAMED correcto
    console.log('\n📝 Creando templates con formato NAMED...\n');
    
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
              header_text: [['L\'igiene']]
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
        console.log(`   Contenido: ${template.components.find(c => c.type === 'BODY')?.text || template.components[0].text}`);
        
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
          console.log(`❌ Error: ${responseText}`);
          
          try {
            const errorJson = JSON.parse(responseText);
            if (errorJson.error) {
              console.log(`   Código: ${errorJson.error.code || 'N/A'}`);
              console.log(`   Mensaje: ${errorJson.error.message || 'N/A'}`);
              
              // Si el template ya existe, contar como éxito
              const errorMessage = errorJson.error.message || '';
              if (errorMessage.includes('already exists') || 
                  errorMessage.includes('Content in This Language Already Exists')) {
                console.log(`ℹ️ Template ${template.name} ya existe (espera unos minutos si acabas de eliminarlo)`);
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
        
        console.log('');
        
      } catch (error) {
        console.log(`❌ Error inesperado: ${error.message}\n`);
        failedCount++;
      }
    }
    
    console.log('✅ Proceso completado');
    console.log(`📊 Resultados: ${createdCount} creados, ${failedCount} fallidos`);
    
    if (createdCount > 0) {
      console.log('\n💡 IMPORTANTE:');
      console.log('   Los templates están en estado PENDING y esperando aprobación de Meta.');
      console.log('   Esto puede tardar desde minutos hasta 24 horas.');
      console.log('   Revisa el estado en: https://business.facebook.com/ > WhatsApp > Plantillas de mensajes');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

deleteAndCreateTemplates();

