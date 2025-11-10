const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTemplatesForBimbinilo() {
  console.log('📝 Creando templates para usuario bimbinilo.ba@gmail.com usando Kapso API...');
  
  try {
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    if (!kapsoApiKey) {
      console.log('❌ KAPSO_API_KEY no configurada');
      return;
    }
    
    // 1. Buscar usuario
    console.log('🔍 Buscando usuario bimbinilo.ba@gmail.com...');
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Error buscando usuarios:', userError);
      return;
    }
    
    const user = users.users.find(u => u.email === 'bimbinilo.ba@gmail.com');
    if (!user) {
      console.error('❌ Usuario bimbinilo.ba@gmail.com no encontrado');
      return;
    }
    
    console.log('✅ Usuario encontrado:', user.id, user.email);
    
    // 2. Buscar configuración de WhatsApp activa
    console.log('🔍 Buscando configuración de WhatsApp activa...');
    const { data: config, error: configError } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (configError || !config) {
      console.error('❌ Configuración activa no encontrada:', configError);
      return;
    }
    
    const businessAccountId = config.waba_id || '1111665601092656';
    console.log('✅ Configuración encontrada');
    console.log('📱 Business Account ID:', businessAccountId);
    console.log('📱 Kapso Config ID:', config.kapso_config_id);
    
    // 3. Templates según la documentación de Kapso
    // Usando el formato correcto con components y parameter_format
    const templates = [
      {
        name: 'inicializador_de_conv',
        language: 'es',
        category: 'UTILITY',
        parameter_format: 'NAMED',
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
        parameter_format: 'POSITIONAL',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Nueva orden {{1}}',
            example: {
              header_text: ['L\'igiene']
            }
          },
          {
            type: 'BODY',
            text: 'Buen día {{1}}! En cuanto me confirmes, paso el pedido de esta semana.',
            example: {
              body_text: [['L\'igiene']]
            }
          }
        ]
      }
    ];
    
    // 4. Usar el endpoint correcto de Kapso según la documentación
    const KAPSO_API_URL = 'https://api.kapso.ai/meta/whatsapp/v23.0';
    
    console.log(`\n📱 Creando templates usando Kapso API para Business Account: ${businessAccountId}`);
    
    let createdCount = 0;
    let failedCount = 0;
    
    // 5. Crear cada template
    for (const template of templates) {
      try {
        console.log(`\n📝 Creando template: ${template.name}`);
        
        const url = `${KAPSO_API_URL}/${businessAccountId}/message_templates`;
        console.log(`📤 URL: ${url}`);
        console.log(`📤 Body:`, JSON.stringify(template, null, 2));
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'X-API-Key': kapsoApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(template)
        });
        
        const responseText = await response.text();
        console.log(`📤 Respuesta: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const responseData = JSON.parse(responseText);
          console.log(`✅ Template ${template.name} creado exitosamente`);
          console.log(`   ID: ${responseData.id || 'N/A'}`);
          console.log(`   Estado: ${responseData.status || 'PENDING'}`);
          console.log(`   Categoría: ${responseData.category || 'N/A'}`);
          createdCount++;
        } else {
          console.log(`❌ Error: ${responseText}`);
          
          try {
            const errorJson = JSON.parse(responseText);
            if (errorJson.error) {
              console.log(`   Código: ${errorJson.error.code || 'N/A'}`);
              console.log(`   Mensaje: ${errorJson.error.message || 'N/A'}`);
            }
            
            // Si el template ya existe, contarlo como éxito parcial
            const errorMessage = errorJson.error?.message || responseText;
            if (errorMessage.includes('already exists') || 
                errorMessage.includes('duplicate') ||
                errorMessage.includes('already')) {
              console.log(`ℹ️ Template ${template.name} ya existe`);
              createdCount++;
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
      console.log('   O en Kapso: https://app.kapso.ai/');
    }
    
    // 6. Verificar templates creados
    console.log('\n🔍 Verificando templates creados...');
    const templatesResponse = await fetch(`${KAPSO_API_URL}/${businessAccountId}/message_templates`, {
      headers: {
        'X-API-Key': kapsoApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (templatesResponse.ok) {
      const templatesData = await templatesResponse.json();
      const allTemplates = templatesData.data || templatesData || [];
      
      console.log(`📱 Total de templates encontrados: ${Array.isArray(allTemplates) ? allTemplates.length : 'N/A'}`);
      
      const targetTemplates = ['inicializador_de_conv', 'evio_orden'];
      targetTemplates.forEach(templateName => {
        const matchingTemplates = Array.isArray(allTemplates) 
          ? allTemplates.filter(t => t.name === templateName)
          : [];
        console.log(`\n📝 Template: ${templateName}`);
        if (matchingTemplates.length > 0) {
          matchingTemplates.forEach((template, index) => {
            console.log(`   ${index + 1}. ID: ${template.id || 'N/A'}`);
            console.log(`      Estado: ${template.status || 'N/A'}`);
            console.log(`      Categoría: ${template.category || 'N/A'}`);
            console.log(`      Idioma: ${template.language || 'N/A'}`);
          });
        } else {
          console.log(`   ⚠️ No encontrado aún (puede tardar unos segundos en aparecer)`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTemplatesForBimbinilo();

