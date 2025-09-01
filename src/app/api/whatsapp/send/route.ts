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
    const { to, message, templateVariables, userId } = body;

    console.log('📥 Recibiendo solicitud de envío:', {
      to,
      message,
      templateVariables,
      userId
    });

    if (!to || !message) {
      return NextResponse.json(
        { error: 'to y message son requeridos' },
        { status: 400 }
      );
    }

    // Determinar si es un template o mensaje de texto
    const isTemplate = ['envio_de_orden', 'hello_world', 'inicializador_de_conv', 'evio_orden'].includes(message);
    
    let result;
    let messageContent = message; // Contenido que se guardará en la base de datos
    
    if (isTemplate) {
      // 🔧 MEJORA: Función helper para generar contenido de templates
      const generateTemplateContent = (templateName: string, variables?: Record<string, string>) => {
        switch (templateName) {
          case 'evio_orden':
            const nombreProveedor = variables?.['Nombre Proveedor'] || 'Proveedor';
            const proveedor = variables?.['Proveedor'] || 'Proveedor';
            return `🛒 *NUEVA ORDEN*

Buen día ${nombreProveedor}! Espero que andes bien! En cuanto me confirmes, paso el pedido de esta semana`;
          
          case 'envio_de_orden':
            return `🛒 *NUEVA ORDEN*

Buenas! Espero que andes bien!
¿Puedo hacerte un pedido?`;
          
          default:
            return `📋 Template: ${templateName}`;
        }
      };

      // Generar contenido para guardar en BD
      messageContent = generateTemplateContent(message, templateVariables);
      
      console.log('📋 Generando contenido para template:', {
        templateName: message,
        templateVariables,
        messageContent
      });
      
      // 🔧 MEJORA: Función helper para generar componentes de templates
      // Manejo inteligente de templates con y sin variables dinámicas
      const generateTemplateComponents = (templateName: string, variables?: Record<string, string>) => {
        if (!variables) return undefined;

        switch (templateName) {
          case 'evio_orden':
            // 🔧 CORRECCIÓN: El template evio_orden aprobado no tiene variables dinámicas configuradas
            // Según el error, el template espera 0 parámetros en body
            // Por ahora, enviar sin componentes dinámicos hasta que se configure correctamente
            console.log('📋 Template evio_orden: Enviando sin componentes dinámicos (no configurados en Meta)');
            console.log('📋 Variables disponibles (no aplicadas):', variables);
            return undefined;
          
          default:
            return undefined;
        }
      };

      // Generar componentes para templates con variables dinámicas
      const components = generateTemplateComponents(message, templateVariables);
      
      if (components) {
        console.log('📋 Componentes para template:', {
          templateName: message,
          templateVariables,
          components
        });
      }
      
      // 🔧 CORRECCIÓN: Usar el método con componentes para templates con variables
      result = await metaWhatsAppService.sendTemplateWithVariables(to, message, 'es_AR', templateVariables, components);
    } else {
      // 🔧 CORRECCIÓN: Para mensajes de texto, procesar variables si existen
      let processedMessage = message;
      
      if (templateVariables && typeof templateVariables === 'object') {
        // Reemplazar variables en el mensaje de texto
        Object.keys(templateVariables).forEach(key => {
          const placeholder = `{{${key}}}`;
          const value = templateVariables[key];
          processedMessage = processedMessage.replace(new RegExp(placeholder, 'g'), value);
        });
        
        messageContent = processedMessage;
        console.log('📋 Procesando variables en mensaje de texto:', {
          originalMessage: message,
          templateVariables,
          processedMessage
        });
      }
      
      // Enviar como mensaje de texto normal
      result = await metaWhatsAppService.sendMessage(to, processedMessage);
    }
    
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Error enviando mensaje' },
        { status: 500 }
      );
    }

    // 🔧 MEJORA: Detectar errores de engagement específicos
    if (result.error && typeof result.error === 'string') {
      const isEngagementError = result.error.includes('engagement') || 
                               result.error.includes('131049') ||
                               result.error.includes('131047');
      
      if (isEngagementError) {
        console.log('⚠️ Error de engagement detectado en endpoint:', result.error);
      }
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
          
          console.log('💾 Guardando mensaje en BD:', {
            content: messageContent,
            message_type: 'sent',
            contact_id: to,
            user_id: providerUserId,
            message_sid: messageSid
          });

          const { error: saveError } = await supabase
            .from('whatsapp_messages')
            .insert([{
              content: messageContent, // 🔧 CORRECCIÓN: Usar contenido real del template
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
              content: messageContent, // 🔧 CORRECCIÓN: Mostrar contenido real
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
      content: messageContent, // 🔧 CORRECCIÓN: Retornar contenido real
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
