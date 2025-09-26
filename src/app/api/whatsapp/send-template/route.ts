import { NextRequest, NextResponse } from 'next/server';
import { metaWhatsAppService } from '../../../../lib/metaWhatsAppService';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 ===== API SEND-TEMPLATE INICIADO =====');
    
    const body = await request.json();
    const { phone, templateName, language, variables } = body;

    if (!phone || !templateName) {
      return NextResponse.json(
        { error: 'phone y templateName son requeridos' },
        { status: 400 }
      );
    }

    console.log('📤 Enviando template:', { phone, templateName, language, variables });

    // Enviar template usando el servicio (que se ejecuta en el servidor)
    const result = await metaWhatsAppService.sendTemplateWithVariables(
      phone,
      templateName,
      language || 'es_AR',
      variables || {}
    );

    console.log('📊 Resultado del envío:', result);
    console.log('🏁 ===== API SEND-TEMPLATE FINALIZADO =====');

    return NextResponse.json({
      success: !!result,
      result: result
    });

  } catch (error) {
    console.error('❌ Error en API send-template:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}
