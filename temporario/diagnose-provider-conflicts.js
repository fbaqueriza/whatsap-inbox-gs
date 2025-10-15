// Script para diagnosticar conflictos de proveedores entre usuarios
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseProviderConflicts() {
  console.log('🔍 DIAGNÓSTICO: Conflictos de Proveedores entre Usuarios');
  console.log('=====================================================');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('');

  try {
    // 1. Obtener todos los usuarios
    console.log('📋 PASO 1: Obteniendo usuarios...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .order('email');

    if (usersError) {
      console.error('❌ Error obteniendo usuarios:', usersError);
      return;
    }

    console.log(`✅ Encontrados ${users.length} usuarios`);
    users.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id})`);
    });
    console.log('');

    // 2. Obtener todos los proveedores
    console.log('📋 PASO 2: Obteniendo proveedores...');
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('id, user_id, name, phone, email')
      .order('phone');

    if (providersError) {
      console.error('❌ Error obteniendo proveedores:', providersError);
      return;
    }

    console.log(`✅ Encontrados ${providers.length} proveedores`);
    console.log('');

    // 3. Agrupar proveedores por teléfono
    console.log('📋 PASO 3: Analizando duplicados por teléfono...');
    const phoneGroups = {};
    
    providers.forEach(provider => {
      const phone = provider.phone;
      if (!phoneGroups[phone]) {
        phoneGroups[phone] = [];
      }
      phoneGroups[phone].push(provider);
    });

    // 4. Encontrar teléfonos duplicados
    const duplicatePhones = Object.entries(phoneGroups)
      .filter(([phone, providers]) => providers.length > 1);

    if (duplicatePhones.length === 0) {
      console.log('✅ No se encontraron teléfonos duplicados entre usuarios');
    } else {
      console.log(`⚠️  Encontrados ${duplicatePhones.length} teléfonos duplicados:`);
      console.log('');

      duplicatePhones.forEach(([phone, phoneProviders]) => {
        console.log(`📱 TELÉFONO: ${phone}`);
        phoneProviders.forEach(provider => {
          const user = users.find(u => u.id === provider.user_id);
          console.log(`   👤 Usuario: ${user?.email || 'DESCONOCIDO'} (${provider.user_id})`);
          console.log(`   🏢 Proveedor: ${provider.name}`);
          console.log(`   📧 Email: ${provider.email || 'N/A'}`);
          console.log(`   🆔 ID: ${provider.id}`);
          console.log('');
        });
        console.log('---');
      });
    }

    // 5. Analizar el teléfono específico del problema
    const problemPhone = '+5491135562673';
    console.log(`📋 PASO 4: Análisis específico del teléfono ${problemPhone}...`);
    
    const problemProviders = providers.filter(p => p.phone === problemPhone);
    
    if (problemProviders.length === 0) {
      console.log(`⚠️  No se encontró el teléfono ${problemPhone} en la base de datos`);
      
      // Buscar variaciones
      const variations = [
        '+541135562673',
        '5491135562673',
        '541135562673',
        '5491135562673',
        '5491135562673'
      ];
      
      console.log('🔍 Buscando variaciones...');
      variations.forEach(variation => {
        const found = providers.filter(p => p.phone === variation);
        if (found.length > 0) {
          console.log(`   ✅ Encontrado con formato: ${variation}`);
          found.forEach(provider => {
            const user = users.find(u => u.id === provider.user_id);
            console.log(`      👤 ${user?.email || 'DESCONOCIDO'} - ${provider.name}`);
          });
        }
      });
    } else {
      console.log(`✅ Encontrados ${problemProviders.length} proveedores con el teléfono ${problemPhone}:`);
      problemProviders.forEach(provider => {
        const user = users.find(u => u.id === provider.user_id);
        console.log(`   👤 Usuario: ${user?.email || 'DESCONOCIDO'} (${provider.user_id})`);
        console.log(`   🏢 Proveedor: ${provider.name}`);
        console.log(`   📧 Email: ${provider.email || 'N/A'}`);
        console.log(`   🆔 ID: ${provider.id}`);
        console.log('');
      });
    }

    // 6. Estadísticas generales
    console.log('📋 PASO 5: Estadísticas generales...');
    console.log(`   Total usuarios: ${users.length}`);
    console.log(`   Total proveedores: ${providers.length}`);
    console.log(`   Promedio proveedores por usuario: ${(providers.length / users.length).toFixed(2)}`);
    console.log(`   Teléfonos únicos: ${Object.keys(phoneGroups).length}`);
    console.log(`   Teléfonos duplicados: ${duplicatePhones.length}`);

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

diagnoseProviderConflicts();
