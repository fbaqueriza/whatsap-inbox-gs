import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, template_name, baseUrl } = body;

    if (!to || !template_name) {
      return NextResponse.json(
        { error: 'to y template_name son requeridos' },
        { status: 400 }
      );
    }

    // Simular envío de template (en producción esto conectaría con Meta API)
    console.log(`📤 Enviando template ${template_name} a ${to}`);
    
    // Simular respuesta exitosa
    const response = {
      success: true,
      message_id: `msg_${Date.now()}`,
      template_sent: template_name,
      recipient: to
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error en POST /api/whatsapp/trigger-conversation:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
