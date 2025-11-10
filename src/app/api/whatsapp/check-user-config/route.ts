import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/whatsapp/check-user-config?userId=xxx
 * Consultar configuración de WhatsApp de un usuario antes de setup de templates
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'userId es requerido como query parameter' 
      }, { status: 400 });
    }

    console.log(`🔍 [CheckUserConfig] Consultando configuración para usuario: ${userId}`);

    // Obtener todas las configuraciones de WhatsApp del usuario (activas e inactivas)
    const { data: configs, error: configsError } = await supabase
      .from('user_whatsapp_config')
      .select('user_id, phone_number_id, kapso_config_id, whatsapp_phone_number, waba_id, is_active, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (configsError) {
      console.error('❌ [CheckUserConfig] Error obteniendo configuraciones:', configsError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo configuraciones',
        details: configsError.message
      }, { status: 500 });
    }

    if (!configs || configs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Usuario no tiene configuraciones de WhatsApp',
        configs: [],
        templates: {
          toCreate: [
            {
              name: 'inicializador_de_conv',
              language: 'es_AR',
              text: 'Hola! Te puedo comentar algo?'
            },
            {
              name: 'evio_orden',
              language: 'es_AR',
              header: 'Nueva orden {{company_name}}',
              body: 'Buen día {{contact_name}}! Espero que andes bien!\nEn cuanto me confirmes, paso el pedido de esta semana.'
            }
          ]
        }
      });
    }

    // Intentar obtener WABA_ID desde Kapso si no está guardado
    const configsWithWaba = await Promise.all(
      configs.map(async (config) => {
        let wabaId = config.waba_id;
        
        if (!wabaId && config.kapso_config_id) {
          try {
            const { WabaIdService } = await import('@/lib/wabaIdService');
            wabaId = await WabaIdService.getWabaIdFromKapsoConfig(config.kapso_config_id);
          } catch (error) {
            console.warn(`⚠️ [CheckUserConfig] No se pudo obtener WABA_ID para config ${config.kapso_config_id}:`, error);
          }
        }

        return {
          ...config,
          resolved_waba_id: wabaId || null
        };
      })
    );

    // Templates que se crearán
    const templates = {
      toCreate: [
        {
          name: 'inicializador_de_conv',
          language: 'es_AR',
          category: 'UTILITY',
          text: 'Hola! Te puedo comentar algo?',
          hasParameters: false
        },
        {
          name: 'evio_orden',
          language: 'es_AR',
          category: 'UTILITY',
          header: 'Nueva orden {{company_name}}',
          body: 'Buen día {{contact_name}}! Espero que andes bien!\nEn cuanto me confirmes, paso el pedido de esta semana.',
          hasParameters: true,
          parameters: ['company_name', 'contact_name']
        }
      ]
    };

    return NextResponse.json({
      success: true,
      userId,
      configs: configsWithWaba,
      templates,
      summary: {
        totalConfigs: configs.length,
        activeConfigs: configs.filter(c => c.is_active).length,
        configsWithPhoneNumberId: configs.filter(c => c.phone_number_id).length,
        configsWithKapsoConfigId: configs.filter(c => c.kapso_config_id).length,
        configsWithWabaId: configs.filter(c => c.waba_id).length
      }
    });

  } catch (error) {
    console.error('❌ [CheckUserConfig] Error inesperado:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

