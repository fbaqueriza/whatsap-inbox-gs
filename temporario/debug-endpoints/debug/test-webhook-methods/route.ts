import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔧 [WebhookConfigTest] Probando diferentes métodos para configurar webhook...');

    // Obtener URL de ngrok
    let ngrokUrl: string;
    try {
      const ngrokResponse = await fetch('http://localhost:4040/api/tunnels');
      const ngrokData = await ngrokResponse.json();
      ngrokUrl = ngrokData.tunnels?.[0]?.public_url;
      
      if (!ngrokUrl) {
        return NextResponse.json({
          success: false,
          error: 'Ngrok no está ejecutándose'
        }, { status: 500 });
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar con ngrok'
      }, { status: 500 });
    }

    const webhookUrl = `${ngrokUrl}/api/kapso/supabase-events`;
    const kapsoConfigId = 'bae605ec-7674-40da-8787-1990cc42cbb3';
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    const kapsoBaseUrl = process.env.KAPSO_API_URL || 'https://app.kapso.ai/api/v1';

    if (!kapsoApiKey) {
      return NextResponse.json({
        success: false,
        error: 'KAPSO_API_KEY no está configurada'
      }, { status: 500 });
    }

    console.log('🔧 [WebhookConfigTest] Configurando webhook:', {
      kapsoConfigId,
      webhookUrl,
      kapsoBaseUrl
    });

    // Probar diferentes métodos y endpoints
    const testCases = [
      // Método PUT
      { method: 'PUT', endpoint: `/whatsapp_configs/${kapsoConfigId}/webhook` },
      { method: 'PUT', endpoint: `/whatsapp_configs/${kapsoConfigId}/webhooks` },
      { method: 'PUT', endpoint: `/whatsapp_configs/${kapsoConfigId}/settings` },
      { method: 'PUT', endpoint: `/whatsapp_configs/${kapsoConfigId}/configuration` },
      
      // Método POST
      { method: 'POST', endpoint: `/whatsapp_configs/${kapsoConfigId}/webhook` },
      { method: 'POST', endpoint: `/whatsapp_configs/${kapsoConfigId}/webhooks` },
      { method: 'POST', endpoint: `/whatsapp_configs/${kapsoConfigId}/settings` },
      { method: 'POST', endpoint: `/whatsapp_configs/${kapsoConfigId}/configuration` },
      
      // Método PATCH
      { method: 'PATCH', endpoint: `/whatsapp_configs/${kapsoConfigId}/webhook` },
      { method: 'PATCH', endpoint: `/whatsapp_configs/${kapsoConfigId}/webhooks` },
      { method: 'PATCH', endpoint: `/whatsapp_configs/${kapsoConfigId}/settings` },
      { method: 'PATCH', endpoint: `/whatsapp_configs/${kapsoConfigId}/configuration` },
      
      // Endpoints globales
      { method: 'POST', endpoint: `/webhooks` },
      { method: 'POST', endpoint: `/webhook` },
      { method: 'PUT', endpoint: `/webhooks` },
      { method: 'PUT', endpoint: `/webhook` }
    ];

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

    const results = [];

    for (const testCase of testCases) {
      try {
        console.log(`🔍 [WebhookConfigTest] Probando ${testCase.method} ${testCase.endpoint}`);
        
        const response = await fetch(`${kapsoBaseUrl}${testCase.endpoint}`, {
          method: testCase.method,
          headers: {
            'Authorization': `Bearer ${kapsoApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(webhookConfig)
        });

        const responseText = await response.text();
        
        results.push({
          method: testCase.method,
          endpoint: testCase.endpoint,
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          response: responseText.substring(0, 200) // Solo primeros 200 caracteres
        });

        console.log(`📊 [WebhookConfigTest] ${testCase.method} ${testCase.endpoint}: ${response.status} ${response.statusText}`);

        if (response.ok) {
          console.log(`✅ [WebhookConfigTest] ¡Webhook configurado exitosamente!`);
          return NextResponse.json({
            success: true,
            message: `Webhook configurado exitosamente con ${testCase.method} ${testCase.endpoint}`,
            data: {
              method: testCase.method,
              endpoint: testCase.endpoint,
              webhookUrl,
              kapsoConfigId,
              response: responseText
            }
          });
        }
      } catch (error: any) {
        results.push({
          method: testCase.method,
          endpoint: testCase.endpoint,
          error: error.message,
          success: false
        });
        console.log(`❌ [WebhookConfigTest] Error en ${testCase.method} ${testCase.endpoint}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: false,
      error: 'No se pudo configurar el webhook en ningún endpoint',
      results: results,
      webhookUrl,
      kapsoConfigId,
      message: 'Todos los endpoints probados devolvieron error. Es posible que la API de Kapso no soporte configuración de webhooks o que requiera un endpoint diferente.'
    });

  } catch (error: any) {
    console.error('❌ [WebhookConfigTest] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
