import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoService } from '@/lib/kapsoService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Crea una configuración de WhatsApp de producción en Kapso
 * POST /api/whatsapp/create-production-config
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`🚀 [ProductionConfig-${requestId}] Iniciando creación de configuración de producción`);
    
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [ProductionConfig-${requestId}] Token de autenticación requerido`);
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log(`❌ [ProductionConfig-${requestId}] Token de autenticación inválido`);
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }
    
    console.log(`👤 [ProductionConfig-${requestId}] Usuario autenticado: ${user.id}`);
    
    const body = await request.json();
    const { 
      phone_number_id, 
      access_token, 
      business_account_id,
      display_phone_number,
      verified_name,
      webhook_url 
    } = body;
    
    // Validar campos requeridos
    if (!phone_number_id || !access_token || !display_phone_number) {
      console.log(`❌ [ProductionConfig-${requestId}] Campos requeridos faltantes`);
      return NextResponse.json({
        success: false,
        error: 'phone_number_id, access_token y display_phone_number son requeridos'
      }, { status: 400 });
    }
    
    // Verificar que el usuario no tenga ya una configuración activa
    const { data: existingConfigs, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);
    
    if (configError) {
      console.error(`❌ [ProductionConfig-${requestId}] Error verificando configuraciones existentes:`, configError);
      return NextResponse.json({
        success: false,
        error: 'Error verificando configuraciones existentes'
      }, { status: 500 });
    }
    
    if (existingConfigs && existingConfigs.length > 0) {
      console.log(`⚠️ [ProductionConfig-${requestId}] Usuario ya tiene configuración activa`);
      return NextResponse.json({
        success: false,
        error: 'Ya tienes una configuración de WhatsApp activa. Elimina la configuración actual antes de crear una nueva.'
      }, { status: 400 });
    }
    
    console.log(`📱 [ProductionConfig-${requestId}] Creando configuración en Kapso para número: ${display_phone_number}`);
    
    // Crear configuración en Kapso
    const kapsoService = new KapsoService();
    const webhookUrl = webhook_url || `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook`;
    
    const kapsoResponse = await kapsoService.createProductionConfig({
      phone_number: display_phone_number,
      name: verified_name || `WhatsApp ${display_phone_number}`,
      webhook_url: webhookUrl,
      meta_phone_number_id: phone_number_id,
      meta_access_token: access_token,
      meta_business_account_id: business_account_id
    });
    
    if (!kapsoResponse.data) {
      console.log(`❌ [ProductionConfig-${requestId}] Error creando configuración en Kapso`);
      return NextResponse.json({
        success: false,
        error: 'Error creando configuración en Kapso'
      }, { status: 500 });
    }
    
    console.log(`✅ [ProductionConfig-${requestId}] Configuración creada en Kapso:`, kapsoResponse.data.id);
    
    // Crear registro en Supabase
    const { data: configData, error: insertError } = await supabase
      .from('whatsapp_configs')
      .insert({
        user_id: user.id,
        phone_number: display_phone_number,
        kapso_config_id: kapsoResponse.data.id,
        meta_phone_number_id: phone_number_id,
        meta_access_token: access_token,
        meta_business_account_id: business_account_id,
        is_sandbox: false,
        is_active: true,
        webhook_url: webhookUrl,
        verified_name: verified_name
      })
      .select()
      .single();
    
    if (insertError) {
      console.error(`❌ [ProductionConfig-${requestId}] Error insertando en Supabase:`, insertError);
      
      // Intentar eliminar la configuración de Kapso si falla la inserción en Supabase
      try {
        await kapsoService.deleteWhatsAppConfig(kapsoResponse.data.id);
        console.log(`🧹 [ProductionConfig-${requestId}] Configuración de Kapso eliminada por rollback`);
      } catch (rollbackError) {
        console.error(`❌ [ProductionConfig-${requestId}] Error en rollback:`, rollbackError);
      }
      
      return NextResponse.json({
        success: false,
        error: 'Error guardando configuración en la base de datos'
      }, { status: 500 });
    }
    
    console.log(`✅ [ProductionConfig-${requestId}] Configuración guardada en Supabase:`, configData.id);
    
    // Respuesta exitosa
    return NextResponse.json({
      success: true,
      data: {
        id: configData.id,
        phone_number: configData.phone_number,
        kapso_config_id: configData.kapso_config_id,
        verified_name: configData.verified_name,
        is_sandbox: configData.is_sandbox,
        is_active: configData.is_active,
        webhook_url: configData.webhook_url,
        created_at: configData.created_at
      },
      message: 'Configuración de WhatsApp creada exitosamente'
    });
    
  } catch (error: any) {
    console.error(`❌ [ProductionConfig-${requestId}] Error inesperado:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
