import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [AutoNgrokWebhook] Configurando webhook con ngrok automáticamente...');

    const body = await request.json();
    const { kapsoConfigId } = body;

    if (!kapsoConfigId) {
      return NextResponse.json({
        success: false,
        error: 'kapsoConfigId es requerido'
      }, { status: 400 });
    }

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

    console.log('📊 [AutoNgrokWebhook] URLs obtenidas:', {
      ngrokUrl,
      webhookUrl,
      kapsoConfigId
    });

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

    console.log('🔧 [AutoNgrokWebhook] Configurando webhook en Kapso...');

    const response = await fetch(`${kapsoApiUrl}/whatsapp_configs/${kapsoConfigId}/webhook`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${kapsoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookConfig)
    });

    const responseData = await response.text();
    
    console.log('📊 [AutoNgrokWebhook] Respuesta de Kapso:', {
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
        kapsoConfigId,
        ngrokUrl,
        webhookUrl,
        status: response.status,
        response: responseData,
        instructions: {
          step1: 'Webhook configurado automáticamente',
          step2: 'Los mensajes de WhatsApp aparecerán en tiempo real',
          step3: 'No es necesario configurar nada más',
          step4: 'El sistema está listo para usar'
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [AutoNgrokWebhook] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
