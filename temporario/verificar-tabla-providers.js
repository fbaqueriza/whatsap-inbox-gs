require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarTablaProviders() {
  console.log('🔍 VERIFICANDO TABLA PROVIDERS\n');

  try {
    // 1. Verificar si la tabla providers existe
    console.log('📋 1. VERIFICANDO EXISTENCIA DE LA TABLA PROVIDERS');
    
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('*')
      .limit(5);
    
    if (providersError) {
      console.error('❌ Error accediendo a tabla providers:', providersError);
      console.log('💡 La tabla providers no existe o no es accesible');
      return;
    }
    
    console.log(`✅ Tabla providers existe y es accesible`);
    console.log(`📊 Número de proveedores en la tabla: ${providers.length}`);
    
    if (providers.length > 0) {
      console.log('\n📝 ESTRUCTURA DE LA TABLA PROVIDERS:');
      console.log('Columnas disponibles:', Object.keys(providers[0]));
      
      console.log('\n📋 PROVEEDORES ENCONTRADOS:');
      providers.forEach((provider, i) => {
        console.log(`  ${i + 1}. user_id: ${provider.user_id}, phone: ${provider.phone}, name: ${provider.name || 'N/A'}`);
      });
    } else {
      console.log('⚠️ La tabla providers está vacía');
    }
    
    // 2. Buscar específicamente el proveedor +5491135562673
    console.log('\n🔍 2. BUSCANDO PROVEEDOR ESPECÍFICO +5491135562673');
    
    const { data: proveedorEspecifico, error: proveedorError } = await supabase
      .from('providers')
      .select('*')
      .eq('phone', '5491135562673');
    
    if (proveedorError) {
      console.error('❌ Error buscando proveedor específico:', proveedorError);
    } else {
      console.log(`✅ Proveedor +5491135562673 encontrado: ${proveedorEspecifico.length > 0 ? 'SÍ' : 'NO'}`);
      
      if (proveedorEspecifico.length > 0) {
        const provider = proveedorEspecifico[0];
        console.log(`📱 Datos del proveedor:`);
        console.log(`   - user_id: ${provider.user_id}`);
        console.log(`   - phone: ${provider.phone}`);
        console.log(`   - name: ${provider.name || 'N/A'}`);
        console.log(`   - created_at: ${provider.created_at}`);
      } else {
        console.log('❌ PROBLEMA: El proveedor +5491135562673 no está registrado en la tabla providers');
        console.log('💡 Esto explica por qué los mensajes no se están guardando con user_id');
      }
    }
    
    // 3. Verificar si hay otros proveedores con números similares
    console.log('\n🔍 3. BUSCANDO PROVEEDORES CON NÚMEROS SIMILARES');
    
    const { data: proveedoresSimilares, error: similaresError } = await supabase
      .from('providers')
      .select('*')
      .or('phone.like.5491135562673,phone.like.+5491135562673');
    
    if (similaresError) {
      console.error('❌ Error buscando proveedores similares:', similaresError);
    } else {
      console.log(`✅ Proveedores con números similares: ${proveedoresSimilares.length}`);
      
      if (proveedoresSimilares.length > 0) {
        proveedoresSimilares.forEach((provider, i) => {
          console.log(`  ${i + 1}. phone: ${provider.phone}, user_id: ${provider.user_id}`);
        });
      }
    }
    
    // 4. Verificar usuarios de la app
    console.log('\n👥 4. VERIFICANDO USUARIOS DE LA APP');
    
    const { data: usuarios, error: usuariosError } = await supabase
      .from('users')
      .select('id, email')
      .limit(5);
    
    if (usuariosError) {
      console.error('❌ Error accediendo a tabla users:', usuariosError);
    } else {
      console.log(`✅ Usuarios de la app encontrados: ${usuarios.length}`);
      
      if (usuarios.length > 0) {
        console.log('📋 USUARIOS DISPONIBLES:');
        usuarios.forEach((user, i) => {
          console.log(`  ${i + 1}. id: ${user.id}, email: ${user.email}`);
        });
      }
    }
    
    // 5. Análisis del problema
    console.log('\n🔍 5. ANÁLISIS DEL PROBLEMA');
    
    if (proveedorEspecifico.length === 0) {
      console.log('❌ PROBLEMA IDENTIFICADO:');
      console.log('   - El proveedor +5491135562673 no está registrado en la tabla providers');
      console.log('   - Por eso saveMessageWithUserId no puede asignar un user_id');
      console.log('   - Los mensajes se guardan con user_id = null');
      
      console.log('\n💡 SOLUCIÓN:');
      console.log('   1. Registrar el proveedor +5491135562673 en la tabla providers');
      console.log('   2. Asignarle un user_id válido de la tabla users');
      console.log('   3. O modificar la lógica para usar un user_id por defecto');
      
    } else {
      console.log('✅ El proveedor está registrado correctamente');
      console.log('💡 El problema puede estar en otra parte del código');
    }
    
    // 6. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    console.log('1. Si el proveedor no está registrado, agregarlo a la tabla providers');
    console.log('2. Si está registrado, verificar que el user_id sea válido');
    console.log('3. Probar el webhook nuevamente después de la corrección');
    console.log('4. Verificar los logs del servidor en Vercel para más detalles');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarTablaProviders();
