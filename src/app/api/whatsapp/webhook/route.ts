import { NextRequest, NextResponse } from 'next/server';
import { OrderNotificationService } from '../../../../lib/orderNotificationService';

// Verificar token de webhook (configurado en Meta Developer Console)
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token_here';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Verificación del webhook
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    // Log solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Webhook verificado exitosamente');
    }
    return new NextResponse(challenge, { status: 200 });
  }

  // Log solo en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log('❌ Verificación de webhook fallida');
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Log solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('📥 Webhook recibido:', JSON.stringify(body, null, 2));
    }

    // Verificar que es un mensaje de WhatsApp
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      if (entry?.changes?.[0]?.value?.messages) {
        const messages = entry.changes[0].value.messages;
        
        for (const message of messages) {
          await processWhatsAppMessage(message);
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processWhatsAppMessage(message: any) {
  try {
    const { from, text, timestamp } = message;
    
    // Log siempre para debugging crítico
    console.log('📱 Procesando mensaje de WhatsApp:', {
      from,
      text: text?.body,
      timestamp
    });

    // Procesar respuesta del proveedor
    if (text?.body) {
      console.log('🔄 Iniciando processProviderResponse para:', from);
      const success = await OrderNotificationService.processProviderResponse(from, text.body);
      
      if (success) {
        console.log('✅ Respuesta del proveedor procesada exitosamente');
      } else {
        console.log('ℹ️ No se encontró pedido pendiente para este número:', from);
      }
    } else {
      console.log('⚠️ Mensaje sin texto recibido de:', from);
    }
  } catch (error) {
    console.error('❌ Error procesando mensaje de WhatsApp:', error);
    // Log detallado del error para debugging
    if (error instanceof Error) {
      console.error('❌ Stack trace:', error.stack);
    }
  }
}
