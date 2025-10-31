import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [AutoWebhookSetup] Configurando webhook automáticamente...');

    // Obtener usuario autenticado
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Token de autorización requerido'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Obtener configuración del usuario
    const { data: userConfig, error: configError } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (configError || !userConfig) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró configuración de WhatsApp para el usuario'
      }, { status: 404 });
    }

    console.log('📱 [AutoWebhookSetup] Configuración encontrada:', userConfig);

    // Obtener URL de ngrok
    let ngrokUrl: string;
    try {
      const ngrokResponse = await fetch('http://localhost:4040/api/tunnels');
      const ngrokData = await ngrokResponse.json();
      ngrokUrl = ngrokData.tunnels?.[0]?.public_url;
      
      if (!ngrokUrl) {
        return NextResponse.json({
          success: false,
          error: 'Ngrok no está ejecutándose. Ejecuta: ngrok http 3001'
        }, { status: 500 });
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar con ngrok. Asegúrate de que esté ejecutándose.'
      }, { status: 500 });
    }

    const webhookUrl = `${ngrokUrl}/api/kapso/supabase-events`;

    // Configurar webhook en Kapso
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    const kapsoApiUrl = process.env.KAPSO_API_URL || 'https://app.kapso.ai/api/v1';

    if (!kapsoApiKey) {
      return NextResponse.json({
        success: false,
        error: 'KAPSO_API_KEY no está configurada'
      }, { status: 500 });
    }

    const webhookConfig = {
      webhook_url: webhookUrl,
      events: ['message.received', 'message.sent', 'conversation.updated']
    };

    console.log('🔧 [AutoWebhookSetup] Configurando webhook en Kapso:', {
      kapsoConfigId: userConfig.kapso_config_id,
      webhookUrl,
      events: webhookConfig.events
    });

    const response = await fetch(`${kapsoApiUrl}/whatsapp_configs/${userConfig.kapso_config_id}/webhook`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${kapsoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookConfig)
    });

    const responseData = await response.text();
    
    console.log('📊 [AutoWebhookSetup] Respuesta de Kapso:', {
      status: response.status,
      statusText: response.statusText,
      response: responseData
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Error configurando webhook en Kapso',
        details: responseData,
        webhookUrl,
        ngrokUrl
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook configurado automáticamente con ngrok',
      data: {
        userId: user.id,
        userEmail: user.email,
        kapsoConfigId: userConfig.kapso_config_id,
        ngrokUrl,
        webhookUrl,
        status: response.status,
        response: responseData,
        instructions: {
          step1: '✅ Webhook configurado automáticamente',
          step2: '✅ Los mensajes de WhatsApp aparecerán en tiempo real',
          step3: '✅ No es necesario configurar nada más',
          step4: '✅ El sistema está listo para usar'
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [AutoWebhookSetup] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
