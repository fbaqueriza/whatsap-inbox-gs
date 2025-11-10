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
    
    // Verificar si el usuario ya tiene un registro en user_whatsapp_config
    const { data: existingConfig, error: existingError } = await supabase
      .from('user_whatsapp_config')
      .select('id, kapso_config_id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    // Si ya hay un registro con kapso_config_id, retornarlo
    if (existingConfig?.kapso_config_id && !existingError) {
      console.log(`⚠️ [KapsoCustomer-${requestId}] Usuario ya tiene customer en Kapso: ${existingConfig.kapso_config_id}`);
      return NextResponse.json({
        success: true,
        customer_id: existingConfig.kapso_config_id,
        message: 'Usuario ya tiene un customer en Kapso Platform'
      });
    }
    
    // Si hay un registro pero sin kapso_config_id, actualizarlo
    if (existingConfig && !existingConfig.kapso_config_id) {
      console.log(`⚠️ [KapsoCustomer-${requestId}] Usuario ya tiene registro pero sin kapso_config_id, se actualizará más adelante`);
    }
    
    // Crear customer en Kapso Platform
    const kapsoPlatform = new KapsoPlatformService();
    const customerName = business_name || `Cliente ${user.email}`;
    
    console.log(`📱 [KapsoCustomer-${requestId}] Creando customer en Kapso: ${customerName}`);
    
    const customerResponse = await kapsoPlatform.createCustomer({
      name: customerName,
      external_customer_id: `customer_${user.id}_${Date.now()}`
    });
    
    // Verificar si la creación fue exitosa
    if (!customerResponse.success || !customerResponse.data) {
      console.error(`❌ [KapsoCustomer-${requestId}] Error creando customer en Kapso:`, customerResponse.error);
      return NextResponse.json({ 
        success: false,
        error: `Error creando customer en Kapso: ${customerResponse.error}` 
      }, { status: 500 });
    }
    
    const customerId = customerResponse.data.id;
    console.log(`✅ [KapsoCustomer-${requestId}] Customer creado en Kapso: ${customerId}`);
    
    // Guardar el customer_id en Supabase para referencia futura
    // Nota: La tabla actual no tiene kapso_customer_id, así que usamos kapso_config_id temporalmente
    console.log(`💾 [KapsoCustomer-${requestId}] Guardando customer en Supabase...`);
    
    // Si ya hay un registro, actualizarlo; si no, crearlo
    let savedData;
    if (existingConfig) {
      // Actualizar registro existente
      console.log(`💾 [KapsoCustomer-${requestId}] Actualizando registro existente...`);
      const { data: updateData, error: updateError } = await supabase
        .from('user_whatsapp_config')
        .update({
          kapso_config_id: customerId,
          whatsapp_phone_number: 'pending',
          is_sandbox: false,
          is_active: false
        })
        .eq('user_id', user.id)
        .select();
      
      console.log(`💾 [KapsoCustomer-${requestId}] Resultado de actualización:`, { updateData, updateError });
      
      if (updateError) {
        console.error(`❌ [KapsoCustomer-${requestId}] Error actualizando:`, updateError);
        const errorMessage = updateError.message || updateError.details || updateError.hint || JSON.stringify(updateError);
        return NextResponse.json({ 
          success: false,
          error: `Error actualizando customer en Supabase: ${errorMessage}` 
        }, { status: 500 });
      }
      
      savedData = updateData;
    } else {
      // Insertar nuevo registro
      console.log(`💾 [KapsoCustomer-${requestId}] Insertando nuevo registro...`);
      const { data: insertData, error: insertError } = await supabase
        .from('user_whatsapp_config')
        .insert({
          user_id: user.id,
          whatsapp_phone_number: 'pending',
          kapso_config_id: customerId,
          is_sandbox: false,
          is_active: false
        })
        .select();
      
      console.log(`💾 [KapsoCustomer-${requestId}] Resultado de inserción:`, { insertData, insertError });
      
      if (insertError) {
        console.error(`❌ [KapsoCustomer-${requestId}] Error insertando:`, insertError);
        const errorMessage = insertError.message || insertError.details || insertError.hint || JSON.stringify(insertError);
        return NextResponse.json({ 
          success: false,
          error: `Error insertando customer en Supabase: ${errorMessage}` 
        }, { status: 500 });
      }
      
      savedData = insertData;
    }
    
    console.log(`✅ [KapsoCustomer-${requestId}] Customer guardado en Supabase:`, savedData);
    
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
