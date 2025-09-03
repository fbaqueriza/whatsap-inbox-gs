import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Endpoint de prueba del webhook funcionando',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown'
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('🧪 TEST WEBHOOK - Cuerpo recibido:', JSON.stringify(body, null, 2));
    
    // Verificar estructura del mensaje de WhatsApp
    if (body.object === 'whatsapp_business_account') {
      console.log('✅ TEST WEBHOOK - Es un mensaje de WhatsApp Business Account');
      
      const entry = body.entry?.[0];
      if (entry?.changes?.[0]?.value) {
        const value = entry.changes[0].value;
        
        if (value.messages && Array.isArray(value.messages)) {
          console.log(`📱 TEST WEBHOOK - ${value.messages.length} mensajes detectados`);
          
          value.messages.forEach((message: any, index: number) => {
            console.log(`📝 TEST WEBHOOK - Mensaje ${index + 1}:`, {
              from: message.from,
              hasText: !!message.text?.body,
              hasImage: !!message.image,
              hasDocument: !!message.document,
              timestamp: message.timestamp
            });
          });
        }
        
        if (value.statuses && Array.isArray(value.statuses)) {
          console.log(`📊 TEST WEBHOOK - ${value.statuses.length} statuses detectados`);
        }
      }
    } else {
      console.log('❌ TEST WEBHOOK - No es un mensaje de WhatsApp Business Account');
    }
    
    return NextResponse.json({ 
      status: 'ok', 
      received: true,
      timestamp: new Date().toISOString(),
      message: 'Webhook de prueba procesado correctamente'
    });
    
  } catch (error) {
    console.error('❌ TEST WEBHOOK - Error procesando:', error);
    
    return NextResponse.json({ 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
