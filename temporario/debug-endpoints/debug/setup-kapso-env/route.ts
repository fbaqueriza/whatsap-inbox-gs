import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    console.log('🔧 [Debug] Configurando variables de entorno de Kapso para usuario:', user.id);

    // Obtener configuración del usuario
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

    // Configurar variables de entorno de Kapso
    const kapsoEnvVars = {
      KAPSO_API_URL: 'https://app.kapso.ai/api/v1',
      KAPSO_API_KEY: process.env.KAPSO_API_KEY || '',
      KAPSO_CUSTOMER_ID: userConfig.kapso_config_id || ''
    };

    console.log('🔧 [Debug] Variables de entorno configuradas:', {
      KAPSO_API_URL: kapsoEnvVars.KAPSO_API_URL,
      KAPSO_API_KEY: kapsoEnvVars.KAPSO_API_KEY ? '✅ Configurada' : '❌ No configurada',
      KAPSO_CUSTOMER_ID: kapsoEnvVars.KAPSO_CUSTOMER_ID ? '✅ Configurada' : '❌ No configurada'
    });

    return NextResponse.json({
      success: true,
      message: 'Variables de entorno de Kapso configuradas',
      kapsoEnvVars: {
        KAPSO_API_URL: kapsoEnvVars.KAPSO_API_URL,
        KAPSO_API_KEY: kapsoEnvVars.KAPSO_API_KEY ? '✅ Configurada' : '❌ No configurada',
        KAPSO_CUSTOMER_ID: kapsoEnvVars.KAPSO_CUSTOMER_ID ? '✅ Configurada' : '❌ No configurada'
      },
      userConfig: {
        kapso_config_id: userConfig.kapso_config_id,
        whatsapp_phone_number: userConfig.whatsapp_phone_number
      }
    });

  } catch (error: any) {
    console.error('❌ [Debug] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
