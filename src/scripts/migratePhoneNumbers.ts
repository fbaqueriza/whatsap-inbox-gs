/**
 * 🔧 SCRIPT DE MIGRACIÓN DE NÚMEROS DE TELÉFONO
 * 
 * Este script normaliza todos los números de teléfono existentes en la base de datos
 * al formato unificado +549XXXXXXXXXX para evitar inconsistencias futuras.
 * 
 * USO: npm run migrate:phones
 */

import { createClient } from '@supabase/supabase-js';
import { PhoneNumberService } from '../lib/phoneNumberService';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 🔧 CARGAR VARIABLES DE ENTORNO
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// 🔧 CONFIGURACIÓN
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno no configuradas');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 🔧 FUNCIÓN PRINCIPAL DE MIGRACIÓN
 */
async function migratePhoneNumbers() {
  console.log('🚀 Iniciando migración de números de teléfono...');
  console.log('📱 Formato objetivo: +549XXXXXXXXXX');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('---');

  try {
    // 🔧 PASO 1: Migrar números en tabla providers
    console.log('🔄 PASO 1: Migrando números en tabla providers...');
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('id, phone, name');

    if (providersError) {
      console.error('❌ Error obteniendo proveedores:', providersError);
      return;
    }

    let providersNormalized = 0;
    for (const provider of providers || []) {
      if (provider.phone) {
        const normalized = PhoneNumberService.normalizeUnified(provider.phone);
        if (normalized && normalized !== provider.phone) {
          try {
            const { error: updateError } = await supabase
              .from('providers')
              .update({ phone: normalized })
              .eq('id', provider.id);

            if (updateError) {
              console.error(`❌ Error actualizando proveedor ${provider.name}:`, updateError);
            } else {
              providersNormalized++;
              console.log(`✅ Proveedor ${provider.name}: ${provider.phone} → ${normalized}`);
            }
          } catch (error) {
            console.error(`❌ Error procesando proveedor ${provider.name}:`, error);
          }
        } else {
          console.log(`ℹ️  Proveedor ${provider.name}: Ya normalizado (${provider.phone})`);
        }
      }
    }

    console.log(`✅ Proveedores migrados: ${providersNormalized}/${providers?.length || 0}`);
    console.log('---');

    // 🔧 PASO 2: Migrar números en tabla pending_orders
    console.log('🔄 PASO 2: Migrando números en tabla pending_orders...');
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('pending_orders')
      .select('id, provider_phone, order_id');

    if (pendingError) {
      console.error('❌ Error obteniendo pedidos pendientes:', pendingError);
    } else {
      let pendingNormalized = 0;
      for (const order of pendingOrders || []) {
        if (order.provider_phone) {
          const normalized = PhoneNumberService.normalizeUnified(order.provider_phone);
          if (normalized && normalized !== order.provider_phone) {
            try {
              const { error: updateError } = await supabase
                .from('pending_orders')
                .update({ provider_phone: normalized })
                .eq('id', order.id);

              if (updateError) {
                console.error(`❌ Error actualizando pedido ${order.order_id}:`, updateError);
              } else {
                pendingNormalized++;
                console.log(`✅ Pedido ${order.order_id}: ${order.provider_phone} → ${normalized}`);
              }
            } catch (error) {
              console.error(`❌ Error procesando pedido ${order.order_id}:`, error);
            }
          } else {
            console.log(`ℹ️  Pedido ${order.order_id}: Ya normalizado (${order.provider_phone})`);
          }
        }
      }
      console.log(`✅ Pedidos pendientes migrados: ${pendingNormalized}/${pendingOrders?.length || 0}`);
    }

    console.log('---');

    // 🔧 PASO 3: Verificar consistencia
    console.log('🔄 PASO 3: Verificando consistencia...');
    const { data: allProviders, error: verifyError } = await supabase
      .from('providers')
      .select('phone');

    if (!verifyError && allProviders) {
      const inconsistentNumbers = allProviders.filter(p => p.phone && !p.phone.startsWith('+549'));
      if (inconsistentNumbers.length === 0) {
        console.log('✅ Todos los números están en formato consistente +549XXXXXXXXXX');
      } else {
        console.log(`⚠️  ${inconsistentNumbers.length} números aún no están normalizados`);
        inconsistentNumbers.forEach(p => console.log(`   - ${p.phone}`));
      }
    }

    console.log('---');
    console.log('🎉 Migración completada exitosamente!');
    console.log('📱 Todos los números ahora usan el formato unificado +549XXXXXXXXXX');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// 🔧 EJECUTAR MIGRACIÓN
if (require.main === module) {
  migratePhoneNumbers()
    .then(() => {
      console.log('✅ Script de migración completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en script de migración:', error);
      process.exit(1);
    });
}

export { migratePhoneNumbers };
