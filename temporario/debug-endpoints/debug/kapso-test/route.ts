import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoService } from '@/lib/kapsoService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    console.log('🔍 [Debug Kapso] Probando API de Kapso para usuario:', user.id);

    // Obtener configuración de WhatsApp del usuario
    const { data: userConfig, error: configError } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (configError || !userConfig) {
      return NextResponse.json({ 
        error: 'No se encontró configuración de WhatsApp',
        details: configError?.message
      }, { status: 400 });
    }

    console.log('📱 [Debug Kapso] Configuración encontrada:', {
      phone_number: userConfig.whatsapp_phone_number,
      kapso_config_id: userConfig.kapso_config_id,
      is_sandbox: userConfig.is_sandbox
    });

    // Probar KapsoService
    const kapsoService = new KapsoService();
    
    // 1. Probar obtener conversaciones
    let conversationsResult;
    try {
      console.log('🔍 [Debug Kapso] Probando getConversationsByConfig...');
      conversationsResult = await kapsoService.getConversationsByConfig(userConfig.kapso_config_id, {
        status: 'active',
        page: 1
      });
      console.log('✅ [Debug Kapso] Conversaciones obtenidas:', conversationsResult);
    } catch (kapsoError: any) {
      console.error('❌ [Debug Kapso] Error obteniendo conversaciones:', kapsoError);
      conversationsResult = { error: kapsoError.message, stack: kapsoError.stack };
    }

    // 2. Probar obtener todas las conversaciones (sin filtro)
    let allConversationsResult;
    try {
      console.log('🔍 [Debug Kapso] Probando getAllConversations...');
      allConversationsResult = await kapsoService.getAllConversations({
        status: 'active',
        page: 1
      });
      console.log('✅ [Debug Kapso] Todas las conversaciones:', allConversationsResult);
    } catch (kapsoError: any) {
      console.error('❌ [Debug Kapso] Error obteniendo todas las conversaciones:', kapsoError);
      allConversationsResult = { error: kapsoError.message, stack: kapsoError.stack };
    }

    // 3. Verificar variables de entorno de Kapso
    const kapsoEnvVars = {
      KAPSO_API_URL: process.env.KAPSO_API_URL ? '✅ Configurada' : '❌ No configurada',
      KAPSO_API_KEY: process.env.KAPSO_API_KEY ? '✅ Configurada' : '❌ No configurada',
      KAPSO_CUSTOMER_ID: process.env.KAPSO_CUSTOMER_ID ? '✅ Configurada' : '❌ No configurada'
    };

    return NextResponse.json({
      success: true,
      debug: {
        user: {
          id: user.id,
          email: user.email
        },
        config: {
          found: !!userConfig,
          data: userConfig,
          error: configError?.message
        },
        kapsoEnvVars,
        conversationsByConfig: conversationsResult,
        allConversations: allConversationsResult
      }
    });

  } catch (error: any) {
    console.error('❌ [Debug Kapso] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
