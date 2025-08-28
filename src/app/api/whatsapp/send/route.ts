import { NextRequest, NextResponse } from 'next/server';
import { metaWhatsAppService } from '../../../../lib/metaWhatsAppService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, message } = body;

    if (!to || !message) {
      return NextResponse.json(
        { error: 'to y message son requeridos' },
        { status: 400 }
      );
    }

         // Determinar si es un template o mensaje de texto
     const isTemplate = ['envio_de_orden', 'hello_world', 'inicializador_de_conv'].includes(message);
     
     let result;
     if (isTemplate) {
       // Usar el servicio existente que ya funciona para templates
       result = await metaWhatsAppService.sendTemplateMessage(to, message, 'es_AR');
     } else {
       // Enviar como mensaje de texto normal
       result = await metaWhatsAppService.sendMessage(to, message);
     }
     
     if (!result) {
       return NextResponse.json(
         { success: false, error: 'Error enviando mensaje' },
         { status: 500 }
       );
     }

     return NextResponse.json({
       success: true,
       message_id: result.id || `msg_${Date.now()}`,
       recipient: to,
       content: message,
       simulated: false // Siempre false porque no usamos fallback
     });

  } catch (error) {
    console.error('Error en POST /api/whatsapp/send:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
