import { NextRequest, NextResponse } from 'next/server';
import { MetaWhatsAppService } from '../../../../lib/metaWhatsAppService';
import { TemplateService } from '../../../../lib/templateService';

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
    const templateContent = await TemplateService.getTemplateContent(template_name);
    console.log(`📋 Contenido del template ${template_name}:`, templateContent);
    
    // 🔧 CORRECCIÓN: Enviar template real usando el servicio de WhatsApp
    const metaService = new MetaWhatsAppService();
    const result = await metaService.sendTemplateMessage(
      to,
      template_name,
      'es_AR'
    );

    console.log('📊 Resultado del envío de template:', result);
    
    // 🔧 FIX: Guardar mensaje del template en la BD para que aparezca en el chat
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Buscar user_id del proveedor
      const { data: provider } = await supabase
        .from('providers')
        .select('user_id')
        .eq('phone', to)
        .single();
      
      if (provider) {
        // Crear mensaje en la BD
        const messageData = {
          content: templateContent || 'Hola! Este es un mensaje para que retomemos nuestra conversacion. En cuanto me respondas podemos seguir conversando.',
          message_type: 'sent',
          status: 'sent',
          contact_id: to,
          user_id: provider.user_id,
          message_sid: result.messages?.[0]?.id || `template_${Date.now()}`,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('whatsapp_messages')
          .insert([messageData]);
        
        if (error) {
          console.error('❌ Error guardando mensaje del template:', error);
        } else {
          console.log('✅ Mensaje del template guardado en el chat');
        }
      }
    } catch (error) {
      console.error('❌ Error guardando mensaje del template:', error);
    }
    
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
