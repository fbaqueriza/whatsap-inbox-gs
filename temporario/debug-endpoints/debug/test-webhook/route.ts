import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 [TestWebhook] Probando webhook de ngrok...');

    const body = await request.json();
    const { webhookUrl } = body;

    if (!webhookUrl) {
      return NextResponse.json({
        success: false,
        error: 'webhookUrl es requerido'
      }, { status: 400 });
    }

    // Simular un mensaje de prueba
    const testMessage = {
      id: `test-${Date.now()}`,
      content: 'Mensaje de prueba desde ngrok',
      contact_id: '+541135562673',
      contact_name: '+541135562673',
      timestamp: new Date().toISOString(),
      type: 'received',
      direction: 'inbound',
      status: 'delivered'
    };

    // Enviar mensaje de prueba al webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage)
    });

    const responseText = await response.text();
    
    console.log('📊 [TestWebhook] Respuesta del webhook:', {
      status: response.status,
      statusText: response.statusText,
      response: responseText
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook probado correctamente',
      data: {
        webhookUrl,
        testMessage,
        response: {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [TestWebhook] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
