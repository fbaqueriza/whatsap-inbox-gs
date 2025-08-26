import { NextRequest, NextResponse } from 'next/server';
import { metaWhatsAppService } from '../../../../lib/metaWhatsAppService';
// SSE removido - usando polling en su lugar
import { OrderNotificationService } from '../../../../lib/orderNotificationService';

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
    if (!metaWhatsAppService.isServiceEnabled()) {
      return new NextResponse('Service Disabled', { status: 200 });
    }

    const body = await request.json();
    
    // Verificar que es un webhook de WhatsApp Business API
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      
      if (entry?.changes?.[0]?.value?.messages) {
        const messages = entry.changes[0].value.messages;
        
        // Procesar cada mensaje - TIEMPO REAL
        for (const message of messages) {
          // Meta envía números SIN el prefijo +, necesitamos agregarlo
          let normalizedFrom = message.from;
          if (!normalizedFrom.startsWith('+')) {
            normalizedFrom = '+' + normalizedFrom;
          }
          
          // Validar formato de teléfono - DEBE ser +54XXXXXXXXXX
          const phoneRegex = /^\+54\d{9,11}$/;
          
          if (!phoneRegex.test(normalizedFrom)) {
            console.error('❌ Formato de teléfono inválido en webhook:', normalizedFrom);
            console.error('❌ Debe ser: +54XXXXXXXXXX (ej: +5491135562673)');
            continue; // Saltar este mensaje
          }

          // Extraer el contenido del mensaje
          let messageContent = '';
          if (message.text && message.text.body) {
            messageContent = message.text.body;
          } else if (message.content) {
            messageContent = message.content;
          } else if (message.type === 'image' && message.image) {
            messageContent = '[Imagen]';
          } else if (message.type === 'document' && message.document) {
            messageContent = `[Documento: ${message.document.filename}]`;
          } else {
            messageContent = '[Mensaje no soportado]';
          }
          
          // Procesar mensaje en base de datos (incluye SSE)
          console.log('💾 Procesando mensaje en base de datos...');
          await metaWhatsAppService.processIncomingMessage({
            from: normalizedFrom,
            to: message.to || process.env.WHATSAPP_PHONE_NUMBER_ID,
            content: messageContent,
            timestamp: new Date(parseInt(message.timestamp) * 1000),
            id: message.id,
            type: message.type,
            messageType: 'received' // Los mensajes del webhook son siempre recibidos
          });
          console.log('✅ Mensaje procesado en base de datos');

          // Verificar si es respuesta de proveedor y enviar detalles del pedido
          console.log('🔍 Verificando si es respuesta de proveedor:', normalizedFrom);
          
          // En producción, usar la URL de la aplicación actual
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
          
          const checkResponse = await fetch(`${baseUrl}/api/whatsapp/get-pending-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ providerPhone: normalizedFrom }),
          });

          if (checkResponse.ok) {
            const checkResult = await checkResponse.json();
            
            // Verificar si el pedido fue creado en los últimos 2 minutos
            const orderCreatedAt = new Date(checkResult.createdAt);
            const now = new Date();
            const timeDiff = now.getTime() - orderCreatedAt.getTime();
            const twoMinutes = 2 * 60 * 1000; // 2 minutos en milisegundos
            const shouldSend = timeDiff <= twoMinutes;
            
            if (shouldSend) {
              console.log('📝 Enviando detalles completos del pedido después de confirmación...');
              await OrderNotificationService.sendOrderDetailsAfterConfirmation(normalizedFrom);
            }
          }
        }
        
        return new NextResponse('OK', { status: 200 });
      }
    } else {
      // console.log('❌ Webhook POST - No es un webhook de WhatsApp Business API');
      // console.log('📋 Webhook POST - Object recibido:', body.object);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('💥 Error processing webhook:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 