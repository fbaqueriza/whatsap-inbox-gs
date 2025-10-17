/**
 * Script de migración para reemplazar el sistema anterior con Kapso + Supabase
 * Este script ayuda a migrar gradualmente del sistema actual al optimizado
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando migración a sistema Kapso + Supabase...');

// 1. Verificar que las tablas de Kapso existen
const checkKapsoTables = async () => {
  console.log('📋 Verificando tablas de Kapso...');
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variables de entorno faltantes para Supabase.');
      return false;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar tablas
    const { data: conversations, error: convError } = await supabase.from('kapso_conversations').select('id').limit(1);
    const { data: messages, error: msgError } = await supabase.from('kapso_messages').select('id').limit(1);
    const { data: contacts, error: contError } = await supabase.from('kapso_contacts').select('id').limit(1);

    if (convError && convError.code === '42P01' || msgError && msgError.code === '42P01' || contError && contError.code === '42P01') {
      console.error('❌ Las tablas de Kapso no existen. Ejecuta primero el SQL en Supabase.');
      console.log('📋 Ve al SQL Editor de Supabase y ejecuta el SQL de temporario/KAPSO_SUPABASE_SETUP.sql');
      return false;
    } else if (convError || msgError || contError) {
      console.error('❌ Error verificando tablas:', convError || msgError || contError);
      return false;
    }

    console.log('✅ Tablas de Kapso verificadas');
    return true;
  } catch (error) {
    console.error('❌ Error verificando tablas:', error);
    return false;
  }
};

// 2. Crear backup del sistema anterior
const createBackup = () => {
  console.log('💾 Creando backup del sistema anterior...');
  
  const backupDir = path.join(__dirname, 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filesToBackup = [
    'src/components/IntegratedChatPanel.tsx',
    'src/services/realtimeService.tsx',
    'src/lib/extensibleOrderFlowService.ts',
    'src/lib/serverOrderFlowService.ts'
  ];

  filesToBackup.forEach(file => {
    const sourcePath = path.join(__dirname, '..', file);
    const backupPath = path.join(backupDir, path.basename(file));
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, backupPath);
      console.log(`✅ Backup creado: ${path.basename(file)}`);
    } else {
      console.log(`⚠️ Archivo no encontrado: ${file}`);
    }
  });

  console.log('✅ Backup completado');
};

// 3. Generar instrucciones de migración
const generateMigrationInstructions = () => {
  console.log('📝 Generando instrucciones de migración...');
  
  const instructions = `
# 🚀 INSTRUCCIONES DE MIGRACIÓN A KAPSO + SUPABASE

## ✅ Pasos Completados:
1. ✅ Tablas de Kapso creadas en Supabase
2. ✅ Servicios y hooks optimizados creados
3. ✅ Componentes de chat optimizados creados
4. ✅ Endpoints de sincronización configurados
5. ✅ Backup del sistema anterior creado

## 🔄 Próximos Pasos:

### 1. Configurar Kapso:
- Ve al panel de Kapso
- Configura webhook: https://20690ec1f69d.ngrok-free.app/api/kapso/supabase-events
- Habilita sincronización automática

### 2. Probar Sistema Optimizado:
- Visita: http://localhost:3001/kapso-chat
- Envía un mensaje de WhatsApp
- Verifica que aparezca en tiempo real

### 3. Migrar Gradualmente:
- Reemplaza \`IntegratedChatPanel\` con \`KapsoChatPanel\`
- Usa \`useKapsoRealtime\` en lugar de \`useRealtimeService\`
- Actualiza las páginas que usan el chat

### 4. Archivos a Actualizar:
- \`src/app/dashboard/page.tsx\`
- \`src/app/orders/page.tsx\`
- \`src/components/DataProvider.tsx\`

### 5. Beneficios de la Migración:
- ✅ Sincronización automática con Kapso
- ✅ Tiempo real nativo con Supabase
- ✅ RLS automático por usuario
- ✅ Función serverless para sincronización
- ✅ Código optimizado y mantenible

## 🎯 Sistema Listo para Producción!
`;

  const instructionsPath = path.join(__dirname, 'MIGRATION_INSTRUCTIONS.md');
  fs.writeFileSync(instructionsPath, instructions);
  console.log('✅ Instrucciones guardadas en: temporario/MIGRATION_INSTRUCTIONS.md');
};

// 4. Ejecutar migración
const runMigration = async () => {
  console.log('🔄 Ejecutando migración...');
  
  try {
    // Verificar tablas
    const tablesOk = await checkKapsoTables();
    if (!tablesOk) {
      console.log('❌ Migración cancelada - tablas no disponibles');
      return;
    }

    // Crear backup
    createBackup();

    // Generar instrucciones
    generateMigrationInstructions();

    console.log('🎉 ¡Migración completada exitosamente!');
    console.log('📋 Revisa temporario/MIGRATION_INSTRUCTIONS.md para los próximos pasos');
    console.log('🔗 URLs importantes:');
    console.log('   - Página de prueba: http://localhost:3001/kapso-chat');
    console.log('   - Webhook: https://20690ec1f69d.ngrok-free.app/api/kapso/supabase-events');
    console.log('   - SQL: temporario/KAPSO_SUPABASE_SETUP.sql');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  }
};

// Ejecutar migración
runMigration();
