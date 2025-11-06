import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WhatsAppConfigService, CreateWhatsAppConfigRequest } from '@/lib/whatsappConfigService';
import { KapsoService } from '@/lib/kapsoService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/whatsapp/configs
 * Obtener configuraciones de WhatsApp del usuario autenticado
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener token de autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }

    console.log('📱 [WhatsAppConfigs] Obteniendo configuraciones para usuario:', user.id);

    // Obtener configuraciones del usuario
    const result = await WhatsAppConfigService.getUserConfigs(user.id);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Error obteniendo configuraciones' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      configs: result.configs || []
    });

  } catch (error: any) {
    console.error('❌ [WhatsAppConfigs] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

/**
 * POST /api/whatsapp/configs
 * Crear nueva configuración de WhatsApp para el usuario autenticado
 */
export async function POST(request: NextRequest) {
  try {
    // Obtener token de autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }

    const body = await request.json();
    const { phone_number, is_sandbox, webhook_url } = body;

    if (!phone_number) {
      return NextResponse.json({ 
        error: 'El número de teléfono es requerido' 
      }, { status: 400 });
    }

    console.log('📱 [WhatsAppConfigs] Creando configuración para usuario:', user.id);
    console.log('📱 [WhatsAppConfigs] Datos:', { phone_number, is_sandbox, webhook_url });

    // Crear configuración en Kapso si no es sandbox
    let kapsoConfigId: string | undefined;
    if (!is_sandbox) {
      try {
        const kapsoService = new KapsoService();
        const kapsoConfig = await kapsoService.createWhatsAppConfig({
          phone_number,
          name: `WhatsApp Config - ${user.email}`,
          is_sandbox: false,
          webhook_url: webhook_url || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/whatsapp/webhook`
        });
        
        kapsoConfigId = kapsoConfig.data.id;
        console.log('✅ [WhatsAppConfigs] Configuración creada en Kapso:', kapsoConfigId);
      } catch (error) {
        console.error('❌ [WhatsAppConfigs] Error creando configuración en Kapso:', error);
        return NextResponse.json({ 
          error: 'Error creando configuración en Kapso' 
        }, { status: 500 });
      }
    }

    // Crear configuración en nuestra base de datos
    const configData: CreateWhatsAppConfigRequest = {
      phone_number,
      is_sandbox: is_sandbox || false,
      webhook_url
    };

    const result = await WhatsAppConfigService.createConfig(user.id, configData);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Error creando configuración' 
      }, { status: 500 });
    }

    // Actualizar con el ID de Kapso si se creó
    if (kapsoConfigId && result.config) {
      await WhatsAppConfigService.updateConfig(result.config.id, {
        kapso_config_id: kapsoConfigId
      }, user.id);

      // ✅ Obtener y guardar WABA_ID automáticamente
      try {
        const { WabaIdService } = await import('@/lib/wabaIdService');
        const wabaId = await WabaIdService.resolveAndSaveWabaId(user.id, {
          kapsoConfigId: kapsoConfigId
        });
        if (wabaId) {
          console.log('✅ [WhatsAppConfigs] WABA_ID obtenido y guardado:', wabaId);
        }
      } catch (wabaError) {
        console.warn('⚠️ [WhatsAppConfigs] No se pudo obtener WABA_ID, continuando sin él:', wabaError);
      }
    }

    // ✅ NUEVO: Configurar templates automáticamente
    try {
      console.log('🔧 [WhatsAppConfigs] Configurando templates automáticamente...');
      const { whatsappTemplateSetupService } = await import('@/lib/whatsappTemplateSetupService');
      const templateResult = await whatsappTemplateSetupService.setupTemplatesForUser(user.id);

      if (templateResult.success) {
        console.log(`✅ [WhatsAppConfigs] Templates configurados: ${templateResult.created || 0} creados`);
      } else {
        console.warn('⚠️ [WhatsAppConfigs] Templates no se pudieron configurar:', templateResult.error);
      }
    } catch (templateError) {
      console.error('❌ [WhatsAppConfigs] Error configurando templates:', templateError);
      // No fallar el setup completo si los templates fallan
    }

    return NextResponse.json({
      success: true,
      config: result.config
    });

  } catch (error: any) {
    console.error('❌ [WhatsAppConfigs] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
