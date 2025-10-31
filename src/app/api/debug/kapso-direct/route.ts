import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoService } from '@/lib/kapsoService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Debug Kapso Direct] Probando API de Kapso directamente...');

    // Usar el usuario que sabemos que existe
    const testUser = {
      id: '23cceda2-e52d-4ec4-b93c-277b5576e8af',
      email: 'baqufra@gmail.com'
    };

    console.log('👤 [Debug Kapso Direct] Usando usuario de prueba:', testUser.email);

    // Obtener configuración de WhatsApp del usuario
    const { data: userConfig, error: configError } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', testUser.id)
      .eq('is_active', true)
      .single();

    if (configError || !userConfig) {
      return NextResponse.json({ 
        error: 'No se encontró configuración de WhatsApp para el usuario de prueba',
        details: configError?.message
      }, { status: 400 });
    }

    console.log('📱 [Debug Kapso Direct] Configuración encontrada:', {
      phone_number: userConfig.whatsapp_phone_number,
      kapso_config_id: userConfig.kapso_config_id,
      is_sandbox: userConfig.is_sandbox
    });

    // Verificar variables de entorno de Kapso
    const kapsoEnvVars = {
      KAPSO_API_URL: process.env.KAPSO_API_URL || 'https://app.kapso.ai/api/v1',
      KAPSO_API_KEY: process.env.KAPSO_API_KEY ? '✅ Configurada' : '❌ No configurada',
      KAPSO_CUSTOMER_ID: userConfig.kapso_config_id ? '✅ Configurada' : '❌ No configurada'
    };

    console.log('🔧 [Debug Kapso Direct] Variables de entorno:', kapsoEnvVars);

    // Probar KapsoService
    const kapsoService = new KapsoService();
    
    // 1. Probar obtener todas las conversaciones
    let allConversationsResult;
    try {
      console.log('🔍 [Debug Kapso Direct] Probando getAllConversations...');
      allConversationsResult = await kapsoService.getAllConversations({
        status: 'active',
        page: 1
      });
      console.log('✅ [Debug Kapso Direct] Todas las conversaciones obtenidas:', allConversationsResult);
    } catch (kapsoError: any) {
      console.error('❌ [Debug Kapso Direct] Error obteniendo todas las conversaciones:', kapsoError);
      allConversationsResult = { error: kapsoError.message, stack: kapsoError.stack };
    }

    // 2. Probar obtener conversaciones por configuración
    let conversationsByConfigResult;
    try {
      console.log('🔍 [Debug Kapso Direct] Probando getConversationsByConfig...');
      conversationsByConfigResult = await kapsoService.getConversationsByConfig(userConfig.kapso_config_id, {
        status: 'active',
        page: 1
      });
      console.log('✅ [Debug Kapso Direct] Conversaciones por configuración obtenidas:', conversationsByConfigResult);
    } catch (kapsoError: any) {
      console.error('❌ [Debug Kapso Direct] Error obteniendo conversaciones por configuración:', kapsoError);
      conversationsByConfigResult = { error: kapsoError.message, stack: kapsoError.stack };
    }

    return NextResponse.json({
      success: true,
      debug: {
        user: {
          id: testUser.id,
          email: testUser.email
        },
        config: {
          found: !!userConfig,
          data: userConfig,
          error: configError?.message
        },
        kapsoEnvVars,
        allConversations: allConversationsResult,
        conversationsByConfig: conversationsByConfigResult
      }
    });

  } catch (error: any) {
    console.error('❌ [Debug Kapso Direct] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
