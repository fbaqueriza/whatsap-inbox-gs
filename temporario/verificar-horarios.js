require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarHorarios() {
  try {
    console.log('🔍 Verificando horarios de entrega...\n');
    
    const { data, error } = await supabase
      .from('providers')
      .select('name, default_delivery_time')
      .order('name');
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('📊 Estado de horarios por proveedor:');
    data.forEach(provider => {
      const count = provider.default_delivery_time ? provider.default_delivery_time.length : 0;
      const times = provider.default_delivery_time ? provider.default_delivery_time.join(', ') : 'Sin configurar';
      console.log(`   - ${provider.name}: ${count} horarios [${times}]`);
    });
    
    console.log('\n✅ Verificación completada');
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

verificarHorarios();
