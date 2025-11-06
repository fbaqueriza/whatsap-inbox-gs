import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WhatsAppConfigService } from '@/lib/whatsappConfigService';
import { kapsoService } from '@/lib/kapsoService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/whatsapp/setup-user
 * Configurar automáticamente WhatsApp para un usuario nuevo
 */
export async function POST(request: NextRequest) {
  try {
    // Obtener token de autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Crear cliente de Supabase con el token del usuario
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ [WhatsAppSetup] Error de autenticación:', authError);
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }

    console.log('📱 [WhatsAppSetup] Configurando WhatsApp para usuario nuevo:', user.id);

    // Usar servicios estáticos
    
    if (!kapsoService) {
      console.error('❌ [WhatsAppSetup] KapsoService no está disponible');
      return NextResponse.json({ 
        error: 'Servicio de Kapso no disponible' 
      }, { status: 503 });
    }

    // Verificar si el usuario ya tiene una configuración
    const existingConfigResult = await WhatsAppConfigService.getActiveConfig(user.id);
    
    if (existingConfigResult.success && existingConfigResult.config) {
      console.log('✅ [WhatsAppSetup] Usuario ya tiene configuración:', existingConfigResult.config.phone_number);
      return NextResponse.json({
        success: true,
        config: existingConfigResult.config,
        message: 'El usuario ya tiene una configuración de WhatsApp'
      });
    }

    // Obtener número de sandbox de Kapso
    const sandboxInfo = await kapsoService.getSandboxNumber();
    
    if (!sandboxInfo) {
      console.error('❌ [WhatsAppSetup] No hay número de sandbox disponible');
      return NextResponse.json({ 
        error: 'No hay número de sandbox disponible. Contacta al administrador.' 
      }, { status: 503 });
    }

    console.log('📱 [WhatsAppSetup] Número de sandbox encontrado:', sandboxInfo.phone_number);
    console.log('📱 [WhatsAppSetup] Config ID de Kapso:', sandboxInfo.config_id);

    // Crear configuración de sandbox para el usuario
    const createResult = await WhatsAppConfigService.createConfig(user.id, {
      phone_number: sandboxInfo.phone_number,
      is_sandbox: true,
      webhook_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/whatsapp/webhook`,
      kapso_config_id: sandboxInfo.config_id // 🔧 CORRECCIÓN: Guardar el config_id de Kapso
    });
    
    if (!createResult.success) {
      console.error('❌ [WhatsAppSetup] Error creando configuración:', createResult.error);
      return NextResponse.json({ 
        error: 'Error creando configuración de WhatsApp' 
      }, { status: 500 });
    }

    console.log('✅ [WhatsAppSetup] Configuración de WhatsApp creada exitosamente para usuario:', user.id);

    // ✅ Obtener y guardar WABA_ID automáticamente
    try {
      const { WabaIdService } = await import('@/lib/wabaIdService');
      const wabaId = await WabaIdService.resolveAndSaveWabaId(user.id, {
        kapsoConfigId: sandboxInfo.config_id
      });
      if (wabaId) {
        console.log('✅ [WhatsAppSetup] WABA_ID obtenido y guardado:', wabaId);
      }
    } catch (wabaError) {
      console.warn('⚠️ [WhatsAppSetup] No se pudo obtener WABA_ID, continuando sin él:', wabaError);
    }

    // ✅ NUEVO: Configurar templates automáticamente
    try {
      console.log('🔧 [WhatsAppSetup] Configurando templates automáticamente...');
      const { whatsappTemplateSetupService } = await import('@/lib/whatsappTemplateSetupService');
      const templateResult = await whatsappTemplateSetupService.setupTemplatesForUser(user.id);

      if (templateResult.success) {
        console.log(`✅ [WhatsAppSetup] Templates configurados: ${templateResult.created || 0} creados`);
      } else {
        console.warn('⚠️ [WhatsAppSetup] Templates no se pudieron configurar:', templateResult.error);
      }
    } catch (templateError) {
      console.error('❌ [WhatsAppSetup] Error configurando templates:', templateError);
      // No fallar el setup completo si los templates fallan
    }

    return NextResponse.json({
      success: true,
      config: createResult.config,
      message: 'Configuración de WhatsApp creada exitosamente'
    });

  } catch (error: any) {
    console.error('❌ [WhatsAppSetup] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
