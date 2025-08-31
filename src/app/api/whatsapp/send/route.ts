import { NextRequest, NextResponse } from 'next/server';
import { metaWhatsAppService } from '../../../../lib/metaWhatsAppService';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase singleton
let supabase: any = null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.error('❌ API send - Variables de entorno faltantes');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, message, userId } = body;

    if (!to || !message) {
      return NextResponse.json(
        { error: 'to y message son requeridos' },
        { status: 400 }
      );
    }

    // Determinar si es un template o mensaje de texto
    const isTemplate = ['envio_de_orden', 'hello_world', 'inicializador_de_conv'].includes(message);
    
    let result;
    if (isTemplate) {
      // Usar el servicio existente que ya funciona para templates
      result = await metaWhatsAppService.sendTemplateMessage(to, message, 'es_AR');
    } else {
      // Enviar como mensaje de texto normal
      result = await metaWhatsAppService.sendMessage(to, message);
    }
    
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Error enviando mensaje' },
        { status: 500 }
      );
    }

    // 🔧 MEJORA: Guardar mensaje en la base de datos para que aparezca en el chat
    if (supabase && userId) {
      try {
        // Buscar el user_id del proveedor basado en el número de teléfono
        const { data: providers, error: providerError } = await supabase
          .from('providers')
          .select('user_id, phone')
          .or(`phone.eq.${to},phone.eq.${to.replace('+', '')}`);

        if (!providerError && providers && providers.length > 0) {
          const providerUserId = providers[0].user_id;
          
          // Guardar mensaje enviado en la base de datos
          const messageSid = result.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const { error: saveError } = await supabase
            .from('whatsapp_messages')
            .insert([{
              content: message,
              message_type: 'sent',
              status: 'sent',
              contact_id: to,
              user_id: providerUserId, // user_id del proveedor
              message_sid: messageSid,
              timestamp: new Date().toISOString(),
              created_at: new Date().toISOString()
            }]);

          if (saveError) {
            console.error('❌ Error guardando mensaje enviado:', saveError);
          } else {
            console.log('✅ Mensaje enviado guardado en la base de datos:', {
              messageSid,
              to,
              content: message,
              userId: providerUserId
            });
          }
        }
      } catch (dbError) {
        console.error('❌ Error en operación de base de datos:', dbError);
        // No fallar el envío por errores de base de datos
      }
    }

    return NextResponse.json({
      success: true,
      message_id: result.id || `msg_${Date.now()}`,
      recipient: to,
      content: message,
      simulated: false
    });

  } catch (error) {
    console.error('Error en POST /api/whatsapp/send:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
