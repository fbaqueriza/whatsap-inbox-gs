/**
 * Script final para verificar que la migración esté completamente funcional
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes para Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const verifyMigrationComplete = async () => {
  console.log('🔍 Verificando migración completa...');
  
  try {
    // 1. Verificar tablas de Kapso
    console.log('📋 Verificando tablas de Kapso...');
    const { data: conversations, error: convError } = await supabase.from('kapso_conversations').select('id').limit(1);
    const { data: messages, error: msgError } = await supabase.from('kapso_messages').select('id').limit(1);
    const { data: contacts, error: contError } = await supabase.from('kapso_contacts').select('id').limit(1);

    if (convError && convError.code === '42P01' || msgError && msgError.code === '42P01' || contError && contError.code === '42P01') {
      console.error('❌ Las tablas de Kapso no existen. Ejecuta primero el SQL en Supabase.');
      return;
    } else if (convError || msgError || contError) {
      console.error('❌ Error verificando tablas:', convError || msgError || contError);
      return;
    }
    console.log('✅ Tablas de Kapso verificadas');

    // 2. Verificar archivos creados
    console.log('📁 Verificando archivos creados...');
    const fs = require('fs');
    const path = require('path');
    
    const filesToCheck = [
      'src/lib/kapsoSupabaseService.ts',
      'src/hooks/useKapsoRealtime.ts',
      'src/hooks/useSupabaseAuth.ts',
      'src/components/KapsoChatPanel.tsx',
      'src/app/kapso-chat/page.tsx',
      'src/app/api/kapso/sync/route.ts',
      'src/app/api/kapso/supabase-events/route.ts'
    ];

    let allFilesExist = true;
    filesToCheck.forEach(file => {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        console.log(`✅ ${file}`);
      } else {
        console.log(`❌ ${file} - NO ENCONTRADO`);
        allFilesExist = false;
      }
    });

    if (!allFilesExist) {
      console.error('❌ Algunos archivos no existen. Revisa la migración.');
      return;
    }
    console.log('✅ Todos los archivos creados correctamente');

    // 3. Verificar backup
    console.log('💾 Verificando backup...');
    const backupDir = path.join(__dirname, 'backup');
    if (fs.existsSync(backupDir)) {
      const backupFiles = fs.readdirSync(backupDir);
      console.log(`✅ Backup creado con ${backupFiles.length} archivos`);
      backupFiles.forEach(file => console.log(`   - ${file}`));
    } else {
      console.log('⚠️ Backup no encontrado');
    }

    // 4. Probar función de sincronización
    console.log('🔄 Probando función de sincronización...');
    const testUserId = '39a01409-56ed-4ae6-884a-148ad5edb1e1'; // Usuario existente
    
    const testData = {
      p_conversation_id: `test_conv_${Date.now()}`,
      p_phone_number: '5491135562673',
      p_contact_name: 'Usuario de Prueba Final',
      p_message_id: `test_msg_${Date.now()}`,
      p_from_number: '5491135562673',
      p_to_number: '5491141780300',
      p_content: 'Mensaje de verificación final',
      p_message_type: 'text',
      p_timestamp: new Date().toISOString(),
      p_user_id: testUserId
    };

    const { data: syncResult, error: syncError } = await supabase.rpc('sync_kapso_data', testData);

    if (syncError) {
      console.error('❌ Error en función de sincronización:', syncError);
      return;
    }
    console.log('✅ Función de sincronización funcionando:', syncResult);

    // 5. Probar estadísticas
    console.log('📊 Probando estadísticas...');
    const { data: stats, error: statsError } = await supabase.rpc('get_kapso_stats', { p_user_id: testUserId });

    if (statsError) {
      console.error('❌ Error obteniendo estadísticas:', statsError);
      return;
    }
    console.log('✅ Estadísticas:', stats);

    // 6. Limpiar datos de prueba
    console.log('🧹 Limpiando datos de prueba...');
    await supabase.from('kapso_messages').delete().eq('user_id', testUserId);
    await supabase.from('kapso_conversations').delete().eq('user_id', testUserId);
    await supabase.from('kapso_contacts').delete().eq('user_id', testUserId);
    console.log('✅ Datos de prueba limpiados');

    console.log('🎉 ¡MIGRACIÓN COMPLETAMENTE VERIFICADA!');
    console.log('📋 Sistema listo para usar con Kapso + Supabase');
    console.log('\n🔗 URLs importantes:');
    console.log('   - Página de prueba: http://localhost:3001/kapso-chat');
    console.log('   - Webhook: https://20690ec1f69d.ngrok-free.app/api/kapso/supabase-events');
    console.log('   - Sincronización: https://20690ec1f69d.ngrok-free.app/api/kapso/sync');
    console.log('   - SQL: temporario/KAPSO_SUPABASE_SETUP.sql');
    console.log('   - Instrucciones: temporario/MIGRATION_INSTRUCTIONS.md');
    console.log('   - Resumen: temporario/MIGRATION_SUMMARY.md');
    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('   1. Configura el webhook en Kapso');
    console.log('   2. Prueba la página: http://localhost:3001/kapso-chat');
    console.log('   3. Envía un mensaje de WhatsApp');
    console.log('   4. Verifica que aparezca en tiempo real');
    console.log('\n✅ ¡MIGRACIÓN COMPLETA Y FUNCIONAL!');

  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
  }
};

verifyMigrationComplete();
