const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyTemplates() {
  console.log('🔍 Verificando templates de bimbinilo...\n');
  
  try {
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    if (!kapsoApiKey) {
      console.log('❌ KAPSO_API_KEY no configurada');
      return;
    }
    
    const businessAccountId = '1111665601092656';
    const KAPSO_API_URL = 'https://api.kapso.ai/meta/whatsapp/v23.0';
    
    const response = await fetch(`${KAPSO_API_URL}/${businessAccountId}/message_templates`, {
      headers: {
        'X-API-Key': kapsoApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('❌ Error obteniendo templates:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    const templates = data.data || [];
    
    console.log(`📋 Total de templates encontrados: ${templates.length}\n`);
    
    // Mostrar todos los templates
    if (templates.length > 0) {
      console.log('📝 Todos los templates encontrados:');
      templates.forEach((template, index) => {
        console.log(`\n${index + 1}. Nombre: ${template.name}`);
        console.log(`   ID: ${template.id}`);
        console.log(`   Estado: ${template.status}`);
        console.log(`   Idioma: ${template.language || 'N/A'}`);
        console.log(`   Categoría: ${template.category || 'N/A'}`);
      });
      console.log('');
    }
    
    const targetTemplates = ['inicializador_de_conv', 'evio_orden'];
    console.log('🔍 Buscando templates específicos:\n');
    
    targetTemplates.forEach(templateName => {
      const matchingTemplates = templates.filter(t => t.name === templateName);
      console.log(`📝 Template: ${templateName}`);
      if (matchingTemplates.length > 0) {
        matchingTemplates.forEach((template, index) => {
          console.log(`   ${index + 1}. ID: ${template.id}`);
          console.log(`      Estado: ${template.status}`);
          console.log(`      Idioma: ${template.language || 'N/A'}`);
          console.log(`      Categoría: ${template.category || 'N/A'}`);
        });
      } else {
        console.log(`   ⚠️ No encontrado`);
      }
      console.log('');
    });
    
    console.log('✅ Verificación completada');
    console.log('\n💡 Los templates están en estado PENDING y esperando aprobación de Meta.');
    console.log('   Una vez aprobados, estarán listos para usar.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyTemplates();

