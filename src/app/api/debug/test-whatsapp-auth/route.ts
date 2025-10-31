import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [TestWhatsAppAuth] Probando autenticación con WhatsApp API...');
    
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_API_KEY;
    
    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Variables de entorno faltantes'
      }, { status: 400 });
    }
    
    // Probar la API de WhatsApp
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}`;
    console.log('🌐 [TestWhatsAppAuth] URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('📊 [TestWhatsAppAuth] Respuesta:', data);
    
    if (response.ok) {
      return NextResponse.json({
        success: true,
        data: data
      });
    } else {
      return NextResponse.json({
        success: false,
        error: data,
        status: response.status
      }, { status: response.status });
    }
    
  } catch (error: any) {
    console.error('❌ [TestWhatsAppAuth] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
