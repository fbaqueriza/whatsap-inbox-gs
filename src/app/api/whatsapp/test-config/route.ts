import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const KAPSO_API_KEY = process.env.KAPSO_API_KEY?.trim();
const KAPSO_BASE_URL = 'https://app.kapso.ai/api/v1';

/**
 * Endpoint de diagnóstico para probar el flujo completo de obtención de phone_number_id
 * GET /api/whatsapp/test-config
 */
export async function GET(request: NextRequest) {
  const diagnostics: any = {
    step: 'inicio',
    timestamp: new Date().toISOString(),
    errors: [],
    warnings: [],
    success: false
  };

  try {
    // Paso 1: Verificar autenticación
    diagnostics.step = 'autenticacion';
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        userId = user?.id || null;
        
        if (authError) {
          diagnostics.errors.push(`Error de autenticación: ${authError.message}`);
        } else if (!userId) {
          diagnostics.errors.push('Usuario no encontrado después de autenticación');
        } else {
          diagnostics.userId = userId;
        }
      } catch (error) {
        diagnostics.errors.push(`Error obteniendo usuario: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      diagnostics.errors.push('Token de autenticación no proporcionado');
    }

    if (!userId) {
      return NextResponse.json({
        ...diagnostics,
        step: 'error_autenticacion',
        message: 'No se pudo autenticar el usuario'
      }, { status: 401 });
    }

    // Paso 2: Verificar variables de entorno
    diagnostics.step = 'variables_entorno';
    diagnostics.env = {
      hasKapsoApiKey: !!KAPSO_API_KEY,
      kapsoApiKeyLength: KAPSO_API_KEY?.length || 0,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey
    };

    if (!KAPSO_API_KEY) {
      diagnostics.errors.push('KAPSO_API_KEY no está configurada');
    }

    // Paso 3: Obtener configuración de la BD
    diagnostics.step = 'obtener_config_bd';
    const { data: config, error: configError } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      diagnostics.errors.push(`Error obteniendo configuración de BD: ${configError.message}`);
      return NextResponse.json({
        ...diagnostics,
        step: 'error_bd',
        message: 'Error obteniendo configuración de la base de datos'
      }, { status: 500 });
    }

    if (!config) {
      diagnostics.warnings.push('Usuario no tiene configuración activa');
      return NextResponse.json({
        ...diagnostics,
        step: 'sin_configuracion',
        message: 'Usuario no tiene configuración activa'
      }, { status: 404 });
    }

    diagnostics.config = {
      id: config.id,
      kapso_config_id: config.kapso_config_id,
      phone_number_id_in_db: (config as any).phone_number_id,
      whatsapp_phone_number: (config as any).whatsapp_phone_number,
      is_active: config.is_active
    };

    // Paso 4: Verificar si phone_number_id está en BD
    diagnostics.step = 'verificar_phone_number_id_bd';
    let phoneNumberId: string | undefined = (config as any).phone_number_id;

    if (phoneNumberId) {
      diagnostics.success = true;
      diagnostics.message = 'phone_number_id encontrado en BD';
      diagnostics.phone_number_id = phoneNumberId;
      return NextResponse.json(diagnostics);
    }

    // Paso 5: Intentar obtener phone_number_id de Kapso
    if (!config.kapso_config_id) {
      diagnostics.errors.push('No hay kapso_config_id disponible para obtener phone_number_id de Kapso');
      return NextResponse.json({
        ...diagnostics,
        step: 'error_sin_kapso_config_id',
        message: 'No hay kapso_config_id disponible'
      }, { status: 404 });
    }

    diagnostics.step = 'obtener_de_kapso';
    diagnostics.kapso_api_call = {
      url: `${KAPSO_BASE_URL}/whatsapp_configs/${config.kapso_config_id}`,
      method: 'GET'
    };

    try {
      const response = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${config.kapso_config_id}`, {
        method: 'GET',
        headers: {
          'X-API-Key': KAPSO_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      diagnostics.kapso_response = {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      };

      if (!response.ok) {
        const errorText = await response.text();
        diagnostics.errors.push(`Error de Kapso API (${response.status}): ${errorText}`);
        diagnostics.kapso_error = errorText;
        
        return NextResponse.json({
          ...diagnostics,
          step: 'error_kapso_api',
          message: `Error obteniendo configuración de Kapso: ${response.statusText}`
        }, { status: response.status });
      }

      const details = await response.json();
      diagnostics.kapso_response_data = details;
      
      // Buscar phone_number_id en diferentes ubicaciones
      phoneNumberId = details?.phone_number_id || 
                      details?.data?.phone_number_id ||
                      details?.whatsapp_config?.phone_number_id;

      diagnostics.phone_number_id_search = {
        in_root: !!details?.phone_number_id,
        in_data: !!details?.data?.phone_number_id,
        in_whatsapp_config: !!details?.whatsapp_config?.phone_number_id,
        found: !!phoneNumberId,
        value: phoneNumberId
      };

      if (phoneNumberId) {
        // Intentar guardar en BD
        diagnostics.step = 'guardar_en_bd';
        const { error: updateError } = await supabase
          .from('user_whatsapp_config')
          .update({ phone_number_id: phoneNumberId })
          .eq('id', config.id);

        if (updateError) {
          diagnostics.warnings.push(`Error guardando phone_number_id en BD: ${updateError.message}`);
        } else {
          diagnostics.phone_number_id_saved = true;
        }

        diagnostics.success = true;
        diagnostics.phone_number_id = phoneNumberId;
        diagnostics.message = 'phone_number_id obtenido exitosamente de Kapso';
        
        return NextResponse.json(diagnostics);
      } else {
        diagnostics.errors.push('La respuesta de Kapso no contiene phone_number_id');
        return NextResponse.json({
          ...diagnostics,
          step: 'error_sin_phone_number_id',
          message: 'phone_number_id no encontrado en la respuesta de Kapso'
        }, { status: 404 });
      }

    } catch (kapsoError) {
      diagnostics.errors.push(`Error llamando a Kapso API: ${kapsoError instanceof Error ? kapsoError.message : 'Unknown error'}`);
      diagnostics.kapso_exception = kapsoError instanceof Error ? {
        message: kapsoError.message,
        stack: kapsoError.stack
      } : kapsoError;
      
      return NextResponse.json({
        ...diagnostics,
        step: 'error_kapso_exception',
        message: 'Error excepción llamando a Kapso API'
      }, { status: 500 });
    }

  } catch (error) {
    diagnostics.errors.push(`Error general: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json({
      ...diagnostics,
      step: 'error_general',
      message: 'Error inesperado en el diagnóstico'
    }, { status: 500 });
  }
}
