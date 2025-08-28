import { NextRequest, NextResponse } from 'next/server';
import { metaWhatsAppService } from '../../../../lib/metaWhatsAppService';

export async function GET(request: NextRequest) {
  try {
    // Log solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Iniciando diagnóstico completo de WhatsApp...');
    }

    // 1. Verificar variables de entorno
    const envCheck = {
      WHATSAPP_API_KEY: !!process.env.WHATSAPP_API_KEY,
      WHATSAPP_PHONE_NUMBER_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      WHATSAPP_BUSINESS_ACCOUNT_ID: !!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
      WHATSAPP_VERIFY_TOKEN: !!process.env.WHATSAPP_VERIFY_TOKEN
    };

    // 2. Verificar estado del servicio
    const serviceStatus = await metaWhatsAppService.getServiceStatus();

    // 3. Verificar templates disponibles
    const templates = await metaWhatsAppService.getTemplates();

         // 4. Verificar conectividad con Meta API
     let apiConnectivity = { success: false, error: null };
     try {
       const response = await fetch(`https://graph.facebook.com/v18.0/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      apiConnectivity = { 
        success: response.ok, 
        error: response.ok ? null : `${response.status}: ${response.statusText}` 
      };
    } catch (error) {
      apiConnectivity = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }

    const diagnostic = {
      timestamp: new Date().toISOString(),
      environment: envCheck,
      serviceStatus,
      templates: {
        count: templates.length,
        names: templates.map(t => t.name),
        details: templates
      },
      apiConnectivity,
      recommendations: []
    };

    // Generar recomendaciones
    if (!envCheck.WHATSAPP_API_KEY) {
      diagnostic.recommendations.push('Configurar WHATSAPP_API_KEY en variables de entorno');
    }
    if (!envCheck.WHATSAPP_PHONE_NUMBER_ID) {
      diagnostic.recommendations.push('Configurar WHATSAPP_PHONE_NUMBER_ID en variables de entorno');
    }
    if (!apiConnectivity.success) {
      diagnostic.recommendations.push('Verificar conectividad con Meta API y credenciales');
    }
    if (templates.length === 0) {
      diagnostic.recommendations.push('Crear templates en WhatsApp Business Manager');
    }
    if (!templates.some(t => t.name === 'envio_de_orden')) {
      diagnostic.recommendations.push('Crear template "envio_de_orden" en WhatsApp Business Manager');
    }

    // Log solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Diagnóstico completado');
    }
    return NextResponse.json(diagnostic);

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
