import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 [CompleteAutoWebhook] Configurando webhook completo automáticamente...');

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
    const kapsoConfigId = 'bae605ec-7674-40da-8787-1990cc42cbb3';

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
      webhook_secret: process.env.KAPSO_WEBHOOK_SECRET || '2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb',
      events: [
        'message.received',
        'message.sent',
        'message.delivered',
        'message.read',
        'document.received',
        'media.received'
      ]
    };

    console.log('🔧 [CompleteAutoWebhook] Configurando webhook en Kapso:', {
      kapsoConfigId,
      webhookUrl,
      events: webhookConfig.events
    });

    const response = await fetch(`${kapsoApiUrl}/whatsapp_configs/${kapsoConfigId}/webhook`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${kapsoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookConfig)
    });

    const responseData = await response.text();
    
    console.log('📊 [CompleteAutoWebhook] Respuesta de Kapso:', {
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
      message: '🎉 ¡Webhook configurado automáticamente!',
      data: {
        kapsoConfigId,
        ngrokUrl,
        webhookUrl,
        status: response.status,
        response: responseData,
        instructions: {
          step1: '✅ Webhook configurado automáticamente en Kapso',
          step2: '✅ Los mensajes de WhatsApp aparecerán en tiempo real',
          step3: '✅ No es necesario configurar nada más',
          step4: '✅ El sistema está listo para usar',
          step5: '📱 Envía un mensaje de WhatsApp para probar'
        },
        nextSteps: [
          'El webhook está configurado automáticamente',
          'Los mensajes llegarán en tiempo real',
          'No necesitas hacer nada más',
          '¡El sistema está funcionando!'
        ]
      }
    });

  } catch (error: any) {
    console.error('❌ [CompleteAutoWebhook] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
