/**
 * Script para ejecutar el setup de templates directamente
 */

// Cargar variables de entorno
require('dotenv').config({ path: '.env.local' });

async function setupTemplates() {
  try {
    console.log('🔧 Iniciando configuración de templates...');
    
    const userId = '23cceda2-e52d-4ec4-b93c-277b5576e8af';
    
    // Importar el servicio
    const { whatsappTemplateSetupService } = require('../src/lib/whatsappTemplateSetupService');
    
    const result = await whatsappTemplateSetupService.setupTemplatesForUser(userId);
    
    if (result.success) {
      console.log(`✅ Templates configurados: ${result.created} creados`);
      process.exit(0);
    } else {
      console.error(`❌ Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setupTemplates();

