import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KAPSO_API_KEY = process.env.KAPSO_API_KEY?.trim();
const KAPSO_BASE_URL = 'https://app.kapso.ai/api/v1';

/**
 * Función auxiliar para completar el setup de un usuario
 */
async function completeSetupForUser(userId: string, requestId: string) {
  // Obtener la configuración del usuario (debe tener kapso_config_id que es el customer_id)
  const { data: configData, error: configError } = await supabase
    .from('user_whatsapp_config')
    .select('id, kapso_config_id, whatsapp_phone_number')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (configError || !configData) {
    console.log(`❌ [CompleteSetup-${requestId}] No se encontró configuración para el usuario ${userId}`);
    return {
      success: false,
      error: 'No se encontró configuración de WhatsApp. Debes crear un customer primero.'
    };
  }
  
  const kapsoConfigId = configData.kapso_config_id;
  
  if (!kapsoConfigId) {
    console.log(`❌ [CompleteSetup-${requestId}] No hay kapso_config_id en la configuración para usuario ${userId}`);
    return {
      success: false,
      error: 'No hay kapso_config_id en la configuración. Debes crear un customer primero.'
    };
  }
  
  // Intentar primero obtener directamente los detalles del whatsapp_config
  console.log(`🔍 [CompleteSetup-${requestId}] Intentando obtener detalles directamente del whatsapp_config: ${kapsoConfigId}`);
  
  let activeConfig: any = null;
  
  try {
    const detailsResponse = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${kapsoConfigId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': KAPSO_API_KEY!,
        'Content-Type': 'application/json'
      }
    });
    
    if (detailsResponse.ok) {
      const details = await detailsResponse.json();
      activeConfig = details?.data ?? details;
      console.log(`✅ [CompleteSetup-${requestId}] Detalles obtenidos directamente del whatsapp_config`);
    } else {
      const errorText = await detailsResponse.text();
      console.log(`⚠️ [CompleteSetup-${requestId}] No se pudieron obtener detalles directamente, intentando como customer_id...`);
      
      // Si falla, intentar como customer_id
      const whatsappConfigsUrl = `${KAPSO_BASE_URL}/customers/${kapsoConfigId}/whatsapp_configs`;
      const whatsappConfigsResponse = await fetch(whatsappConfigsUrl, {
        method: 'GET',
        headers: {
          'X-API-Key': KAPSO_API_KEY!,
          'Content-Type': 'application/json'
        }
      });
      
      if (whatsappConfigsResponse.ok) {
        const whatsappConfigsData = await whatsappConfigsResponse.json();
        const whatsappConfigs = whatsappConfigsData?.data || whatsappConfigsData || [];
        if (whatsappConfigs.length > 0) {
          activeConfig = whatsappConfigs.find((config: any) => config.status === 'active') || whatsappConfigs[0];
          console.log(`✅ [CompleteSetup-${requestId}] Configuración encontrada vía customer_id`);
        }
      }
    }
  } catch (error: any) {
    console.error(`❌ [CompleteSetup-${requestId}] Error obteniendo detalles:`, error.message);
    return {
      success: false,
      error: `Error obteniendo configuración desde Kapso: ${error.message}`
    };
  }
  
  if (!activeConfig) {
    console.log(`⚠️ [CompleteSetup-${requestId}] No se pudo obtener la configuración desde Kapso`);
    return {
      success: false,
      error: 'No se encontraron configuraciones de WhatsApp. Asegúrate de haber completado el setup link correctamente.'
    };
  }
  
      console.log(`✅ [CompleteSetup-${requestId}] Configuración seleccionada:`, {
      id: activeConfig.id,
      phone_number: activeConfig.phone_number,
      display_phone_number: activeConfig.display_phone_number,
      status: activeConfig.status
    });
    
    // Obtener el número de teléfono de diferentes campos posibles
    const phoneNumber = activeConfig.phone_number || 
                        activeConfig.display_phone_number || 
                        activeConfig.display_phone_number_normalized || 
                        'pending';
    
    // Obtener detalles completos de la configuración para obtener phone_number_id
    let phoneNumberId: string | undefined = activeConfig.phone_number_id;
  
  if (!phoneNumberId) {
    try {
      console.log(`🔍 [CompleteSetup-${requestId}] Obteniendo detalles completos de la configuración...`);
      const detailsResponse = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${activeConfig.id}`, {
        method: 'GET',
        headers: {
          'X-API-Key': KAPSO_API_KEY!,
          'Content-Type': 'application/json'
        }
      });
      
      if (detailsResponse.ok) {
        const details = await detailsResponse.json();
        const detailsData = details?.data ?? details;
        phoneNumberId = detailsData?.phone_number_id || detailsData?.data?.phone_number_id;
        console.log(`✅ [CompleteSetup-${requestId}] phone_number_id obtenido: ${phoneNumberId}`);
      }
    } catch (error) {
      console.warn(`⚠️ [CompleteSetup-${requestId}] No se pudo obtener phone_number_id de los detalles:`, error);
    }
  }
  
      // Actualizar la configuración en Supabase
    const updateData: any = {
      whatsapp_phone_number: phoneNumber,
      kapso_config_id: activeConfig.id, // Ahora kapso_config_id es el whatsapp_config_id real
      is_active: activeConfig.status === 'active' || activeConfig.status === 'CONNECTED' || activeConfig.status === 'connected',
      is_sandbox: false
    };
  
  if (phoneNumberId) {
    updateData.phone_number_id = phoneNumberId;
  }
  
  console.log(`💾 [CompleteSetup-${requestId}] Actualizando configuración en Supabase:`, updateData);
  
  const { data: updatedConfig, error: updateError } = await supabase
    .from('user_whatsapp_config')
    .update(updateData)
    .eq('id', configData.id)
    .select()
    .single();
  
  if (updateError) {
    console.error(`❌ [CompleteSetup-${requestId}] Error actualizando configuración:`, updateError);
    return {
      success: false,
      error: `Error actualizando configuración: ${updateError.message}`
    };
  }
  
  console.log(`✅ [CompleteSetup-${requestId}] Configuración actualizada exitosamente`);
  
  return {
    success: true,
    message: 'Configuración de WhatsApp completada exitosamente',
    config: updatedConfig
  };
}

/**
 * Completar el proceso de configuración de WhatsApp después de que el usuario
 * complete el setup link y conecte su WhatsApp
 * GET /api/whatsapp/complete-setup (requiere autenticación)
 */
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`🔗 [CompleteSetup-${requestId}] Iniciando completado de configuración`);
    
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [CompleteSetup-${requestId}] Token de autenticación requerido`);
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log(`❌ [CompleteSetup-${requestId}] Token de autenticación inválido`);
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }
    
    console.log(`👤 [CompleteSetup-${requestId}] Usuario autenticado: ${user.id}`);
    
    const result = await completeSetupForUser(user.id, requestId);
    
    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error(`❌ [CompleteSetup-${requestId}] Error inesperado:`, error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

/**
 * Completar el proceso de configuración para un usuario específico
 * POST /api/whatsapp/complete-setup (sin autenticación, usando service role)
 * Body: { user_id: string }
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`🔗 [CompleteSetup-${requestId}] Iniciando completado de configuración (POST)`);
    
    const body = await request.json();
    const { user_id } = body;
    
    if (!user_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'user_id es requerido' 
      }, { status: 400 });
    }
    
    console.log(`👤 [CompleteSetup-${requestId}] Completando setup para usuario: ${user_id}`);
    
    const result = await completeSetupForUser(user_id, requestId);
    
    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error(`❌ [CompleteSetup-${requestId}] Error inesperado:`, error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
