import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const KAPSO_API_KEY = process.env.KAPSO_API_KEY?.trim();
const KAPSO_BASE_URL = 'https://app.kapso.ai/api/v1';

/**
 * Obtener detalles de configuración de WhatsApp desde Kapso
 */
async function getWhatsAppConfigDetails(whatsappConfigId: string) {
  if (!KAPSO_API_KEY) {
    throw new Error('KAPSO_API_KEY no está configurada');
  }

  const url = `${KAPSO_BASE_URL}/whatsapp_configs/${whatsappConfigId}`;
  console.log(`🔍 [Config Bypass] Llamando a Kapso API: ${url}`);
  console.log(`🔍 [Config Bypass] KAPSO_API_KEY presente: ${!!KAPSO_API_KEY}, longitud: ${KAPSO_API_KEY.length}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': KAPSO_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  console.log(`📡 [Config Bypass] Respuesta de Kapso - Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [Config Bypass] Error obteniendo detalles de configuración:', {
      status: response.status,
      statusText: response.statusText,
      errorText: errorText,
      kapso_config_id: whatsappConfigId
    });
    throw new Error(`Error obteniendo detalles en Kapso (${response.status}): ${errorText || response.statusText}`);
  }

  const details = await response.json();
  console.log(`📡 [Config Bypass] Respuesta JSON de Kapso (raw):`, JSON.stringify(details, null, 2));
  
  // Algunas respuestas vienen como { data: { ... } }
  const result = details?.data ?? details;
  console.log(`📡 [Config Bypass] Resultado procesado:`, JSON.stringify(result, null, 2));
  
  return result;
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

        // 3. Si no hay configuración activa, verificar si hay alguna configuración inactiva
    if (!config) {
      console.log('⚠️ [Config Bypass] Usuario sin configuración activa, verificando configuraciones inactivas...');
      
      // Verificar si hay alguna configuración (incluso inactiva) para este usuario
      const { data: anyConfig } = await supabase
        .from('user_whatsapp_config')
        .select('id, is_active, kapso_config_id, whatsapp_phone_number')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (anyConfig) {
        console.log('⚠️ [Config Bypass] Usuario tiene configuración pero está inactiva:', anyConfig);
        return NextResponse.json({
          success: false,
          error: 'Configuración de WhatsApp encontrada pero está inactiva. Por favor, activa tu configuración primero.',
          debug: {
            has_config: true,
            is_active: anyConfig.is_active,
            has_kapso_config_id: !!anyConfig.kapso_config_id
          }
        }, { status: 404 });
      } else {
        console.log('❌ [Config Bypass] Usuario no tiene ninguna configuración de WhatsApp');
        return NextResponse.json({
          success: false,
          error: 'No tienes una configuración de WhatsApp. Por favor, configura tu WhatsApp primero desde el panel de configuración.',
          debug: {
            has_config: false
          }
        }, { status: 404 });
      }
    }

        console.log('✅ [Config Bypass] Configuración encontrada:', {
      id: config.id,
      user_id: config.user_id,
      kapso_config_id: config.kapso_config_id,
      phone_number_id: (config as any).phone_number_id,
      whatsapp_phone_number: (config as any).whatsapp_phone_number
    });
    
    // 4. Obtener phone_number_id: primero de la BD, si no está, obtenerlo de Kapso
    let phoneNumberId: string | undefined = (config as any).phone_number_id;
    console.log(`🔍 [Config Bypass] phone_number_id en BD: ${phoneNumberId || 'NO ENCONTRADO'}`);

    // Si no está en la BD pero tenemos kapso_config_id, obtenerlo de Kapso
    if (!phoneNumberId && config.kapso_config_id) {
      try {
        console.log(`🔍 [Config Bypass] Obteniendo phone_number_id de Kapso usando kapso_config_id: ${config.kapso_config_id}`);
        console.log(`🔍 [Config Bypass] URL de Kapso: ${KAPSO_BASE_URL}/whatsapp_configs/${config.kapso_config_id}`);
        console.log(`🔍 [Config Bypass] KAPSO_API_KEY presente: ${!!KAPSO_API_KEY}`);
        
        const kapsoDetails = await getWhatsAppConfigDetails(config.kapso_config_id);
        console.log(`📡 [Config Bypass] Respuesta completa de Kapso:`, JSON.stringify(kapsoDetails, null, 2));
        
        // Buscar phone_number_id en diferentes posibles ubicaciones de la respuesta
        phoneNumberId = kapsoDetails?.phone_number_id || 
                        kapsoDetails?.data?.phone_number_id ||
                        kapsoDetails?.whatsapp_config?.phone_number_id;
        
        console.log(`✅ [Config Bypass] phone_number_id obtenido de Kapso: ${phoneNumberId || 'NO ENCONTRADO'}`);
        console.log(`🔍 [Config Bypass] Estructura de respuesta:`, {
          hasPhoneNumberId: !!kapsoDetails?.phone_number_id,
          hasData: !!kapsoDetails?.data,
          hasDataPhoneNumberId: !!kapsoDetails?.data?.phone_number_id,
          keys: kapsoDetails ? Object.keys(kapsoDetails) : []
        });

        // Opcionalmente, actualizar la BD con el phone_number_id obtenido
        if (phoneNumberId) {
          const { error: updateError } = await supabase
            .from('user_whatsapp_config')
            .update({ phone_number_id: phoneNumberId })
            .eq('id', config.id);
          if (updateError) {
            // Si el error es porque la columna no existe, solo loguearlo como warning
            if (updateError.code === '42703' || updateError.message?.includes('phone_number_id')) {
              console.warn('⚠️ [Config Bypass] La columna phone_number_id no existe en la tabla. Ejecuta el script SQL para agregarla: docs/add-phone-number-id-column.sql');
            } else {
              console.error('❌ [Config Bypass] Error guardando phone_number_id en BD:', updateError);
            }
          } else {
            console.log('💾 [Config Bypass] phone_number_id guardado en BD');
          }
        } else {
          console.error('❌ [Config Bypass] La respuesta de Kapso no contiene phone_number_id');
          console.error('❌ [Config Bypass] Estructura de respuesta recibida:', JSON.stringify(kapsoDetails, null, 2));
        }
      } catch (error) {
        console.error('❌ [Config Bypass] Error obteniendo phone_number_id de Kapso:', error);
        if (error instanceof Error) {
          console.error('❌ [Config Bypass] Mensaje de error:', error.message);
          console.error('❌ [Config Bypass] Stack:', error.stack);
        }
        // Re-lanzar el error para que se vea en los logs del servidor
        throw error;
      }
    } else if (!phoneNumberId && !config.kapso_config_id) {
      console.error('❌ [Config Bypass] No hay kapso_config_id disponible para obtener phone_number_id de Kapso');
    }

    // 5. Si aún no tenemos phone_number_id, no podemos continuar
    if (!phoneNumberId) {
      console.error('❌ [Config Bypass] phone_number_id no disponible en BD ni en Kapso');
      console.error('❌ [Config Bypass] Configuración completa:', JSON.stringify(config, null, 2));
      return NextResponse.json({
        success: false,
        error: 'phone_number_id no disponible. La configuración puede estar incompleta.',
        debug: {
          has_kapso_config_id: !!config.kapso_config_id,
          kapso_config_id: config.kapso_config_id,
          has_phone_number_id_in_db: !!(config as any).phone_number_id
        }
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
