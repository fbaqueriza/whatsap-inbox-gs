import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const KAPSO_API_KEY = process.env.KAPSO_API_KEY;
const KAPSO_BASE_URL = 'https://app.kapso.ai/api/v1';

/**
 * Obtener detalles de configuración de WhatsApp desde Kapso
 */
async function getWhatsAppConfigDetails(whatsappConfigId: string) {
  if (!KAPSO_API_KEY) {
    throw new Error('KAPSO_API_KEY no está configurada');
  }

  const response = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${whatsappConfigId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${KAPSO_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [Config Bypass] Error obteniendo detalles de configuración:', errorText);
    throw new Error(`Error obteniendo detalles en Kapso: ${response.statusText}`);
  }

  const details = await response.json();
  // Algunas respuestas vienen como { data: { ... } }
  return details?.data ?? details;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [Config Bypass] Obteniendo configuración WhatsApp...');

    // 1. Autenticar usuario
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
        console.log('🔍 [Config Bypass] Usuario autenticado:', userId);
      } catch (error) {
        console.error('❌ [Config Bypass] Error obteniendo usuario:', error);
      }
    }

    if (!userId) {
      console.error('❌ [Config Bypass] Usuario no autenticado');
      return NextResponse.json({ success: false, error: 'Usuario no autenticado' }, { status: 401 });
    }

    // 2. Usar SERVICE ROLE para bypass RLS
    const { data: config, error } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ [Config Bypass] Error obteniendo configuración:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 3. Si no hay configuración, devolver 404 (sin sandbox) 
    if (!config) {
      console.log('⚠️ [Config Bypass] Usuario sin configuración activa');
      return NextResponse.json({ success: false, error: 'Sin configuración activa' }, { status: 404 });
    }

    console.log('✅ [Config Bypass] Configuración encontrada:', config);
    
    // 4. Obtener phone_number_id: primero de la BD, si no está, obtenerlo de Kapso
    let phoneNumberId: string | undefined = (config as any).phone_number_id;
    
    // Si no está en la BD pero tenemos kapso_config_id, obtenerlo de Kapso
    if (!phoneNumberId && config.kapso_config_id) {
      try {
        console.log('🔍 [Config Bypass] Obteniendo phone_number_id de Kapso...');
        const kapsoDetails = await getWhatsAppConfigDetails(config.kapso_config_id);
        phoneNumberId = kapsoDetails?.phone_number_id;
        console.log('✅ [Config Bypass] phone_number_id obtenido de Kapso:', phoneNumberId);
        
        // Opcionalmente, actualizar la BD con el phone_number_id obtenido
        if (phoneNumberId) {
          await supabase
            .from('user_whatsapp_config')
            .update({ phone_number_id: phoneNumberId })
            .eq('id', config.id);
          console.log('💾 [Config Bypass] phone_number_id guardado en BD');
        }
      } catch (error) {
        console.warn('⚠️ [Config Bypass] No se pudo obtener phone_number_id de Kapso:', error);
      }
    }
    
    // 5. Si aún no tenemos phone_number_id, no podemos continuar
    if (!phoneNumberId) {
      console.error('❌ [Config Bypass] phone_number_id no disponible en BD ni en Kapso');
      return NextResponse.json({ 
        success: false, 
        error: 'phone_number_id no disponible. La configuración puede estar incompleta.' 
      }, { status: 404 });
    }
    
    // 6. Devolver configuración con phone_number_id
    return NextResponse.json({ 
      success: true, 
      data: {
        ...config,
        phone_number_id: phoneNumberId
      }
    });

  } catch (error) {
    console.error('❌ [Config Bypass] Error en bypass:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
