import { NextRequest, NextResponse } from 'next/server';

const KAPSO_BASE_URL = process.env.KAPSO_API_URL || 'https://app.kapso.ai/api/v1';
const KAPSO_API_KEY = process.env.KAPSO_API_KEY || '';

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 [TestWebhookSetup] Probando configuración de webhook...');

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

    console.log('🔧 [TestWebhookSetup] Configurando webhook:', {
      kapsoConfigId,
      webhookUrl,
      kapsoBaseUrl: KAPSO_BASE_URL
    });

    // Configurar webhook usando la misma estructura que setup-number
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

    const response = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${kapsoConfigId}/webhook`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${KAPSO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookConfig)
    });

    const responseText = await response.text();
    
    console.log('📊 [TestWebhookSetup] Respuesta de Kapso:', {
      status: response.status,
      statusText: response.statusText,
      response: responseText
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Error configurando webhook en Kapso',
        details: {
          status: response.status,
          statusText: response.statusText,
          response: responseText,
          webhookUrl,
          kapsoConfigId,
          kapsoBaseUrl: KAPSO_BASE_URL
        }
      }, { status: response.status });
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    return NextResponse.json({
      success: true,
      message: '✅ Webhook configurado exitosamente',
      data: {
        kapsoConfigId,
        ngrokUrl,
        webhookUrl,
        status: response.status,
        response: responseData
      }
    });

  } catch (error: any) {
    console.error('❌ [TestWebhookSetup] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
