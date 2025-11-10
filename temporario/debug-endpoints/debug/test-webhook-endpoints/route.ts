import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔧 [WebhookTest] Probando configuración de webhook...');

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

    console.log('🔧 [WebhookTest] Configurando webhook:', {
      kapsoConfigId,
      webhookUrl,
      kapsoBaseUrl,
      hasApiKey: !!kapsoApiKey
    });

    if (!kapsoApiKey) {
      return NextResponse.json({
        success: false,
        error: 'KAPSO_API_KEY no está configurada'
      }, { status: 500 });
    }

    // Probar diferentes endpoints de webhook
    const webhookEndpoints = [
      `/whatsapp_configs/${kapsoConfigId}/webhook`,
      `/whatsapp_configs/${kapsoConfigId}/webhooks`,
      `/webhooks`,
      `/webhook`,
      `/whatsapp_configs/${kapsoConfigId}/settings`,
      `/whatsapp_configs/${kapsoConfigId}/configuration`
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

    for (const endpoint of webhookEndpoints) {
      try {
        console.log(`🔍 [WebhookTest] Probando endpoint: ${endpoint}`);
        
        const response = await fetch(`${kapsoBaseUrl}${endpoint}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${kapsoApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(webhookConfig)
        });

        const responseText = await response.text();
        
        results.push({
          endpoint,
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          response: responseText.substring(0, 200) // Solo primeros 200 caracteres
        });

        console.log(`📊 [WebhookTest] ${endpoint}: ${response.status} ${response.statusText}`);

        if (response.ok) {
          console.log(`✅ [WebhookTest] ¡Webhook configurado exitosamente en ${endpoint}!`);
          return NextResponse.json({
            success: true,
            message: `Webhook configurado exitosamente en ${endpoint}`,
            data: {
              endpoint,
              webhookUrl,
              kapsoConfigId,
              response: responseText
            }
          });
        }
      } catch (error: any) {
        results.push({
          endpoint,
          error: error.message,
          success: false
        });
        console.log(`❌ [WebhookTest] Error en ${endpoint}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: false,
      error: 'No se pudo configurar el webhook en ningún endpoint',
      results: results,
      webhookUrl,
      kapsoConfigId
    });

  } catch (error: any) {
    console.error('❌ [WebhookTest] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
