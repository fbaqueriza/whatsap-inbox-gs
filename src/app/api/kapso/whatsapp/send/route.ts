import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { KapsoWhatsAppProxyService } from '@/lib/kapsoWhatsAppProxyService';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { 
      phoneNumberId, 
      to, 
      messageType = 'text',
      content,
      template,
      interactive,
      document
    } = await request.json();

    if (!phoneNumberId || !to) {
      return NextResponse.json({ 
        error: 'phoneNumberId y to son requeridos' 
      }, { status: 400 });
    }

    // Verificar que el usuario tiene acceso al phoneNumberId
    const { data: config, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('phone_number_id', phoneNumberId)
      .single();

    if (configError || !config) {
      return NextResponse.json({ 
        error: 'Número de teléfono no autorizado' 
      }, { status: 403 });
    }

    const whatsappService = new KapsoWhatsAppProxyService();
    let result;

    switch (messageType) {
      case 'text':
        if (!content) {
          return NextResponse.json({ 
            error: 'content es requerido para mensajes de texto' 
          }, { status: 400 });
        }
        result = await whatsappService.sendTextMessage({
          phoneNumberId,
          to,
          body: content
        });
        break;

      case 'template':
        if (!template?.name || !template?.language) {
          return NextResponse.json({ 
            error: 'template.name y template.language son requeridos' 
          }, { status: 400 });
        }
        result = await whatsappService.sendTemplateMessage({
          phoneNumberId,
          to,
          templateName: template.name,
          language: template.language,
          parameters: template.parameters
        });
        break;

      case 'interactive':
        if (!interactive?.body || !interactive?.buttons) {
          return NextResponse.json({ 
            error: 'interactive.body y interactive.buttons son requeridos' 
          }, { status: 400 });
        }
        result = await whatsappService.sendInteractiveMessage({
          phoneNumberId,
          to,
          header: interactive.header,
          body: interactive.body,
          buttons: interactive.buttons
        });
        break;

      case 'document':
        if (!document?.link || !document?.filename) {
          return NextResponse.json({ 
            error: 'document.link y document.filename son requeridos' 
          }, { status: 400 });
        }
        result = await whatsappService.sendDocument({
          phoneNumberId,
          to,
          document: {
            link: document.link,
            filename: document.filename
          },
          caption: document.caption
        });
        break;

      default:
        return NextResponse.json({ 
          error: 'Tipo de mensaje no soportado' 
        }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Mensaje enviado exitosamente',
      data: result.data
    });

  } catch (error) {
    console.error('❌ [WhatsAppSend] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
