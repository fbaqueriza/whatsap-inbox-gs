const https = require('https');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

async function makeRequest(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL('/rest/v1/rpc/exec_sql', supabaseUrl);
    
    const postData = JSON.stringify({ sql });
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=minimal'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = data ? JSON.parse(data) : {};
          resolve({ data: result, error: res.statusCode >= 400 ? { message: data } : null });
        } catch (err) {
          resolve({ data: null, error: { message: data } });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

async function executeSQLViaREST() {
  try {
    console.log('🚀 EJECUTANDO SQL VIA REST API');
    console.log('='.repeat(50));

    // Lista de comandos SQL a ejecutar
    const sqlCommands = [
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN DEFAULT false;',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS kapso_config_id VARCHAR(100);',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS meta_phone_number_id VARCHAR(100);',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS meta_access_token TEXT;',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS webhook_url TEXT;',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();'
    ];

    console.log(`📋 Ejecutando ${sqlCommands.length} comandos SQL...`);

    for (let i = 0; i < sqlCommands.length; i++) {
      const sql = sqlCommands[i];
      console.log(`\n${i + 1}/${sqlCommands.length} Ejecutando: ${sql.substring(0, 50)}...`);
      
      try {
        const { data, error } = await makeRequest(sql);
        
        if (error) {
          console.log(`   ❌ Error: ${error.message}`);
        } else {
          console.log(`   ✅ Comando ejecutado exitosamente`);
        }
      } catch (err) {
        console.log(`   ⚠️  Error ejecutando comando: ${err.message}`);
      }
    }

    console.log('\n🎉 COMANDOS SQL EJECUTADOS');
    return true;

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  executeSQLViaREST()
    .then(success => {
      if (success) {
        console.log('\n✅ Script completado');
        process.exit(0);
      } else {
        console.log('\n❌ Script falló');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { executeSQLViaREST };
