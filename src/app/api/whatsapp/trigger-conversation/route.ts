import { NextRequest, NextResponse } from 'next/server';
import { metaWhatsAppService } from '../../../../lib/metaWhatsAppService';
import { templateService } from '../../../../lib/templateService';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 ===== API TRIGGER-CONVERSATION INICIADO =====');
    
    const body = await request.json();
    const { to, template_name = 'inicializador_de_conv' } = body;

    if (!to) {
      return NextResponse.json(
        { error: 'to es requerido' },
        { status: 400 }
      );
    }

    console.log(`📤 Enviando template ${template_name} a ${to} para reiniciar conversación`);
    
    // 🔧 OBTENER CONTENIDO DEL TEMPLATE: Para mostrar en el chat
    const templateContent = await templateService.getTemplateContent(template_name);
    console.log(`📋 Contenido del template ${template_name}:`, templateContent);
    
    // 🔧 CORRECCIÓN: Enviar template real usando el servicio de WhatsApp
    const result = await metaWhatsAppService.sendTemplateMessage(
      to,
      template_name,
      'es_AR'
    );

    console.log('📊 Resultado del envío de template:', result);
    console.log('🏁 ===== API TRIGGER-CONVERSATION FINALIZADO =====');

    return NextResponse.json({
      success: true,
      result: result,
      template_sent: template_name,
      template_content: templateContent,
      recipient: to
    });

  } catch (error) {
    console.error('❌ Error en POST /api/whatsapp/trigger-conversation:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}
