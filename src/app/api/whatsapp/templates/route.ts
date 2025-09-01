import { NextRequest, NextResponse } from 'next/server';

// Configuración de Meta WhatsApp Business API
const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0'; // Versión más estable
const BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_API_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!BUSINESS_ACCOUNT_ID || !ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Configuración de WhatsApp incompleta' },
        { status: 500 }
      );
    }

    // 🔧 CORRECCIÓN: Usar BUSINESS_ACCOUNT_ID para obtener templates
    const url = `${WHATSAPP_API_URL}/${BUSINESS_ACCOUNT_ID}/message_templates`;
    
    console.log('🔍 Consultando templates disponibles...');
    console.log('🔗 URL:', url);

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
    console.log('📋 Templates encontrados:', result.data?.length || 0);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error consultando templates:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
