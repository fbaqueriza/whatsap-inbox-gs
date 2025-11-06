import { NextRequest, NextResponse } from 'next/server';
import { whatsappTemplateSetupService } from '@/lib/whatsappTemplateSetupService';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/whatsapp/setup-templates-all-users
 * Configurar templates de WhatsApp para todos los usuarios existentes con WhatsApp configurado
 * 
 * Este endpoint ejecuta la configuración automática de templates (evio_orden e inicializador_de_conv)
 * para todos los usuarios que ya tienen WhatsApp configurado.
 * 
 * Requiere autenticación de administrador (opcional, puede ser público para uso interno)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [SetupTemplatesAll] Iniciando configuración de templates para todos los usuarios...');

    // Opcional: Verificar autenticación si se requiere
    // const authHeader = request.headers.get('authorization');
    // if (!authHeader || !authHeader.startsWith('Bearer ')) {
    //   return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    // }

    // Permite recibir WABA_IDs directamente en el body
    let body: { wabaIds?: Record<string, string> } = {};
    try {
      body = await request.json().catch(() => ({}));
    } catch {
      // Si no hay body, continuar sin problemas
    }
    const providedWabaIds = body.wabaIds || {};

    // Obtener todos los usuarios con configuración de WhatsApp activa para diagnóstico
    const { data: configs, error: configsError } = await supabase
      .from('user_whatsapp_config')
      .select('user_id, phone_number_id, kapso_config_id, whatsapp_phone_number, is_active')
      .eq('is_active', true);

    if (configsError) {
      console.error('❌ [SetupTemplatesAll] Error obteniendo configuraciones:', configsError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo configuraciones',
        details: configsError.message
      }, { status: 500 });
    }

    const uniqueUserIds = Array.from(new Set(configs?.map(c => c.user_id) || []));
    console.log(`📊 [SetupTemplatesAll] Encontrados ${uniqueUserIds.length} usuarios únicos con WhatsApp configurado`);

    // Ejecutar configuración para todos los usuarios (con WABA_IDs proporcionados si los hay)
    const result = await whatsappTemplateSetupService.setupTemplatesForAllUsers(providedWabaIds);

    // Agregar información de diagnóstico a la respuesta
    const diagnosticInfo = {
      totalConfigs: configs?.length || 0,
      uniqueUsers: uniqueUserIds.length,
      configsWithPhoneNumberId: configs?.filter(c => c.phone_number_id).length || 0,
      configsWithKapsoConfigId: configs?.filter(c => c.kapso_config_id).length || 0,
      configsDetail: configs?.map(c => ({
        user_id: c.user_id,
        has_phone_number_id: !!c.phone_number_id,
        has_kapso_config_id: !!c.kapso_config_id,
        phone_number: c.whatsapp_phone_number
      })) || []
    };

    if (result.success) {
      console.log(`✅ [SetupTemplatesAll] Procesados ${result.processed} usuarios, creados ${result.created} templates`);
      return NextResponse.json({
        success: true,
        message: `Templates configurados para ${result.processed} usuarios`,
        processed: result.processed,
        created: result.created,
        errors: result.errors.length > 0 ? result.errors : undefined,
        details: result.details || [],
        diagnostic: diagnosticInfo
      });
    } else {
      console.error(`❌ [SetupTemplatesAll] Error en configuración:`, result.errors);
      return NextResponse.json({
        success: false,
        error: 'Error configurando templates',
        errors: result.errors,
        details: result.details || [],
        diagnostic: diagnosticInfo
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [SetupTemplatesAll] Error inesperado:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
