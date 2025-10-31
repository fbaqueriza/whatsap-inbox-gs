import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoPlatformService } from '@/lib/kapsoPlatformService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Crear un customer en Kapso Platform para el usuario autenticado
 * POST /api/whatsapp/create-kapso-customer
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`🚀 [KapsoCustomer-${requestId}] Iniciando creación de customer en Kapso Platform`);
    
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [KapsoCustomer-${requestId}] Token de autenticación requerido`);
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log(`❌ [KapsoCustomer-${requestId}] Token de autenticación inválido`);
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }
    
    console.log(`👤 [KapsoCustomer-${requestId}] Usuario autenticado: ${user.id}`);
    
    const body = await request.json();
    const { business_name } = body;
    
    // Verificar si el usuario ya tiene un customer en Kapso
    // Nota: Usamos kapso_config_id para almacenar customer_id temporalmente
    const { data: existingCustomer } = await supabase
      .from('whatsapp_configs')
      .select('kapso_config_id')
      .eq('user_id', user.id)
      .not('kapso_config_id', 'is', null)
      .single();
    
    if (existingCustomer?.kapso_config_id) {
      console.log(`⚠️ [KapsoCustomer-${requestId}] Usuario ya tiene customer en Kapso: ${existingCustomer.kapso_config_id}`);
      return NextResponse.json({
        success: true,
        customer_id: existingCustomer.kapso_config_id,
        message: 'Usuario ya tiene un customer en Kapso Platform'
      });
    }
    
    // Crear customer en Kapso Platform
    const kapsoPlatform = new KapsoPlatformService();
    const customerName = business_name || `Cliente ${user.email}`;
    
    console.log(`📱 [KapsoCustomer-${requestId}] Creando customer en Kapso: ${customerName}`);
    
    const customerResponse = await kapsoPlatform.createCustomer({
      name: customerName,
      external_customer_id: `customer_${user.id}_${Date.now()}`
    });
    
    const customerId = customerResponse.data.id;
    console.log(`✅ [KapsoCustomer-${requestId}] Customer creado en Kapso: ${customerId}`);
    
    // Guardar el customer_id en Supabase para referencia futura
    // Nota: La tabla actual no tiene kapso_customer_id, así que usamos kapso_config_id temporalmente
    console.log(`💾 [KapsoCustomer-${requestId}] Guardando customer en Supabase...`);
    
    const { data: insertData, error: updateError } = await supabase
      .from('whatsapp_configs')
      .insert({
        user_id: user.id,
        phone_number: 'pending', // Se configurará cuando conecten WhatsApp
        kapso_config_id: customerId, // Usar kapso_config_id para almacenar customer_id temporalmente
        is_sandbox: false,
        is_active: false // No activo hasta que conecten WhatsApp
      })
      .select();
    
    console.log(`💾 [KapsoCustomer-${requestId}] Resultado de inserción:`, { insertData, updateError });
    
    if (updateError) {
      console.error(`❌ [KapsoCustomer-${requestId}] Error guardando customer_id en Supabase:`, updateError);
      return NextResponse.json({ 
        success: false,
        error: `Error guardando customer en Supabase: ${updateError.message}` 
      }, { status: 500 });
    }
    
    console.log(`✅ [KapsoCustomer-${requestId}] Customer guardado en Supabase:`, insertData);
    
    console.log(`✅ [KapsoCustomer-${requestId}] Customer configurado exitosamente`);
    
    return NextResponse.json({
      success: true,
      customer_id: customerId,
      customer_name: customerName,
      message: 'Customer creado exitosamente en Kapso Platform'
    });

  } catch (error: any) {
    console.error(`❌ [KapsoCustomer-${requestId}] Error inesperado:`, error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
