import { NextRequest, NextResponse } from 'next/server';

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v19.0';
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Probando configuración de templates...');
    console.log('🔧 Variables de entorno:', {
      WHATSAPP_API_URL,
      WHATSAPP_API_KEY: WHATSAPP_API_KEY ? 'Configurado' : 'No configurado',
      PHONE_NUMBER_ID: PHONE_NUMBER_ID ? 'Configurado' : 'No configurado'
    });

    if (!WHATSAPP_API_KEY || !PHONE_NUMBER_ID) {
      return NextResponse.json({
        success: false,
        error: 'Variables de entorno no configuradas',
        config: {
          WHATSAPP_API_KEY: !!WHATSAPP_API_KEY,
          PHONE_NUMBER_ID: !!PHONE_NUMBER_ID
        }
      }, { status: 400 });
    }

    // Probar el template envio_de_orden
    const testTemplate = {
      messaging_product: 'whatsapp',
      to: '+5491135562673', // Número de prueba
      type: 'template',
      template: {
        name: 'envio_de_orden',
        language: {
          code: 'es_AR'
        }
      }
    };

    console.log('📤 Probando template envio_de_orden:', testTemplate);

    const response = await fetch(`${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testTemplate)
    });

    const result = await response.json();

    console.log('📋 Respuesta de Meta API:', {
      status: response.status,
      statusText: response.statusText,
      result
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Error probando template',
        status: response.status,
        details: result
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Template probado exitosamente',
      data: result
    });

  } catch (error) {
    console.error('❌ Error probando template:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
