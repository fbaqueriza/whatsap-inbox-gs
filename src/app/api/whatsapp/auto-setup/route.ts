import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [WhatsApp Auto-Setup] Iniciando configuración automática...');

    // 1. Autenticar usuario
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
        console.log('🔍 [WhatsApp Auto-Setup] Usuario autenticado:', userId);
      } catch (error) {
        console.error('❌ [WhatsApp Auto-Setup] Error obteniendo usuario:', error);
      }
    }

    if (!userId) {
      console.error('❌ [WhatsApp Auto-Setup] Usuario no autenticado');
      return NextResponse.json({ success: false, error: 'Usuario no autenticado' }, { status: 401 });
    }

    // 2. Verificar si ya tiene configuración
    const { data: existingConfig } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (existingConfig) {
      console.log('✅ [WhatsApp Auto-Setup] Usuario ya tiene configuración:', existingConfig);
      return NextResponse.json({ 
        success: true, 
        message: 'Usuario ya tiene configuración de WhatsApp',
        config: existingConfig 
      });
    }

    // 3. Crear configuración automática (sandbox para testing)
    const autoConfig = {
      user_id: userId,
      whatsapp_phone_number: '+541135562673', // Número de sandbox
      kapso_config_id: 'sandbox-config-' + userId.substring(0, 8),
      is_active: true,
      is_sandbox: true
    };

    const { data: newConfig, error } = await supabase
      .from('user_whatsapp_config')
      .insert(autoConfig)
      .select()
      .single();

    if (error) {
      console.error('❌ [WhatsApp Auto-Setup] Error creando configuración:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('✅ [WhatsApp Auto-Setup] Configuración creada exitosamente:', newConfig);

    // ✅ NUEVO: Configurar templates automáticamente
    try {
      console.log('🔧 [WhatsApp Auto-Setup] Configurando templates automáticamente...');
      const { whatsappTemplateSetupService } = await import('@/lib/whatsappTemplateSetupService');
      const templateResult = await whatsappTemplateSetupService.setupTemplatesForUser(userId);

      if (templateResult.success) {
        console.log(`✅ [WhatsApp Auto-Setup] Templates configurados: ${templateResult.created || 0} creados`);
      } else {
        console.warn('⚠️ [WhatsApp Auto-Setup] Templates no se pudieron configurar:', templateResult.error);
      }
    } catch (templateError) {
      console.error('❌ [WhatsApp Auto-Setup] Error configurando templates:', templateError);
      // No fallar el setup completo si los templates fallan
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Configuración de WhatsApp creada automáticamente',
      config: newConfig 
    });

  } catch (error) {
    console.error('❌ [WhatsApp Auto-Setup] Error en configuración automática:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
