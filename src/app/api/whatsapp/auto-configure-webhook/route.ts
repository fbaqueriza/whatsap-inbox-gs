import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [AutoWebhookConfig] Configurando webhook automáticamente...');

    const body = await request.json();
    const { kapsoConfigId, webhookUrl } = body;

    if (!kapsoConfigId || !webhookUrl) {
      return NextResponse.json({
        success: false,
        error: 'kapsoConfigId y webhookUrl son requeridos'
      }, { status: 400 });
    }

    // Obtener configuración de Kapso
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    const kapsoApiUrl = process.env.KAPSO_API_URL || 'https://app.kapso.ai/api/v1';

    if (!kapsoApiKey) {
      return NextResponse.json({
        success: false,
        error: 'KAPSO_API_KEY no está configurada'
      }, { status: 500 });
    }

    console.log('📊 [AutoWebhookConfig] Configurando webhook:', {
      kapsoConfigId,
      webhookUrl,
      kapsoApiUrl
    });

    // Configurar webhook en Kapso
    const webhookConfig = {
      webhook_url: webhookUrl,
      events: ['message.received', 'message.sent', 'conversation.updated']
    };

    const response = await fetch(`${kapsoApiUrl}/whatsapp_configs/${kapsoConfigId}/webhook`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${kapsoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookConfig)
    });

    const responseData = await response.text();
    
    console.log('📊 [AutoWebhookConfig] Respuesta de Kapso:', {
      status: response.status,
      statusText: response.statusText,
      response: responseData
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Error configurando webhook en Kapso',
        details: responseData
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook configurado automáticamente en Kapso',
      data: {
        kapsoConfigId,
        webhookUrl,
        status: response.status,
        response: responseData
      }
    });

  } catch (error: any) {
    console.error('❌ [AutoWebhookConfig] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
