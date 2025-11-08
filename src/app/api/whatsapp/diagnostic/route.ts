import { NextRequest, NextResponse } from 'next/server';
import { metaWhatsAppService } from '../../../../lib/metaWhatsAppService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({
        success: false,
        error: 'Diagnóstico detallado no disponible en producción',
      }, { status: 503 });
    }

    // Log solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Iniciando diagnóstico completo de WhatsApp...');
    }

    // 1. Verificar variables de entorno
    const envCheck = {
      WHATSAPP_API_KEY: !!process.env.WHATSAPP_API_KEY,
      WHATSAPP_PHONE_NUMBER_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      WHATSAPP_BUSINESS_ACCOUNT_ID: !!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
      WHATSAPP_VERIFY_TOKEN: !!process.env.WHATSAPP_VERIFY_TOKEN,
    };

    // 2. Verificar estado del servicio
    const serviceStatus = metaWhatsAppService.getStatus();
    const serviceConfig = metaWhatsAppService.getConfig();

    // 3. Datos de templates manejados por configuración automática
    const templates = {
      managedBy: 'whatsappTemplateSetupService',
      requiredTemplates: ['inicializador_de_conv', 'evio_orden'],
    };

    // 4. Verificar conectividad con Meta API (solo si hay credenciales)
    let apiConnectivity: { success: boolean; error: string | null } = { success: false, error: null };
    if (envCheck.WHATSAPP_API_KEY && envCheck.WHATSAPP_BUSINESS_ACCOUNT_ID) {
      try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        apiConnectivity = {
          success: response.ok,
          error: response.ok ? null : `${response.status}: ${response.statusText}`,
        };
      } catch (error) {
        apiConnectivity = {
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
        };
      }
    }

    const diagnostic = {
      timestamp: new Date().toISOString(),
      environment: envCheck,
      serviceStatus,
      serviceConfig,
      templates,
      apiConnectivity,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Diagnóstico completado');
    }
    return NextResponse.json({ success: true, diagnostic });

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 },
    );
  }
}
