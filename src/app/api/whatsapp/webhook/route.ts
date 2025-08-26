import { NextRequest, NextResponse } from 'next/server';
import { webhookService } from '../../../../lib/webhookService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Debug de variables de entorno
    console.log('🔍 ENV DEBUG:', {
      WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
      NODE_ENV: process.env.NODE_ENV,
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('WHATSAPP'))
    });

    console.log('🔍 Webhook verification debug:', {
      mode,
      token,
      expectedToken: process.env.WHATSAPP_VERIFY_TOKEN,
      challenge
    });

    // Verificación del webhook para WhatsApp
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_de_verificacion_2024_cilantro';
    if (mode === 'subscribe' && token === expectedToken) {
      console.log('✅ Webhook verified successfully');
      return new NextResponse(challenge, { status: 200 });
    }

    console.log('❌ Webhook verification failed:', { modeMatch: mode === 'subscribe', tokenMatch: token === expectedToken });
    return new NextResponse('Forbidden', { status: 403 });
  } catch (error) {
    console.error('Error in webhook verification:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar si el servicio de WhatsApp está habilitado
    if (!webhookService.isServiceEnabled()) {
      console.log('⚠️ Servicio de WhatsApp deshabilitado, ignorando webhook');
      return new NextResponse('Service Disabled', { status: 200 });
    }

    const body = await request.json();
    
    // Procesar webhook usando el servicio centralizado
    const result = await webhookService.processWebhook(body);
    
    if (result.success) {
      console.log(`✅ Webhook procesado exitosamente. Eventos procesados: ${result.processedEvents}`);
      return new NextResponse('OK', { status: 200 });
    } else {
      console.error('❌ Error procesando webhook');
      return new NextResponse('Internal Server Error', { status: 500 });
    }

  } catch (error) {
    console.error('💥 Error processing webhook:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 