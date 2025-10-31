/**
 * Script para configurar templates para el usuario actual
 */

const userId = '23cceda2-e52d-4ec4-b93c-277b5576e8af'; // Usuario actual

const { whatsappTemplateSetupService } = require('../src/lib/whatsappTemplateSetupService');

async function setupTemplates() {
  try {
    console.log(`🔧 Configurando templates para usuario: ${userId}`);
    
    const result = await whatsappTemplateSetupService.setupTemplatesForUser(userId);
    
    if (result.success) {
      console.log(`✅ Templates configurados exitosamente: ${result.created} creados`);
    } else {
      console.error(`❌ Error configurando templates: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

setupTemplates();

