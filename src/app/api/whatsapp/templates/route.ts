import { NextRequest, NextResponse } from 'next/server';

// Configuración de Meta WhatsApp Business API
const WHATSAPP_API_URL = 'https://graph.facebook.com/v23.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_API_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Configuración de WhatsApp incompleta' },
        { status: 500 }
      );
    }

    // Obtener templates disponibles
    const url = `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/message_templates`;
    
    console.log('🔍 Consultando templates disponibles...');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error consultando templates:', result);
      return NextResponse.json(
        { error: result.error?.message || 'Error consultando templates' },
        { status: response.status }
      );
    }

    console.log('✅ Templates obtenidos exitosamente');
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error consultando templates:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
