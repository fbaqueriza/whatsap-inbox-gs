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

    // 🔧 MEJORA: Usar template que SÍ existe en WhatsApp Business Manager
    const isTemplate = ['hello_world', 'inicializador_de_conv', 'evio_orden'].includes(message);
    
    let result;
    let messageContent = message;
    
    if (isTemplate) {
      // 🔧 CORRECCIÓN: Generar contenido para guardar en BD
      messageContent = generateTemplateContent(message, templateVariables);
      
      console.log('📋 Enviando template:', {
        templateName: message,
        templateVariables,
        messageContent
      });
      
      // 🔧 CORRECCIÓN: Enviar template con variables dinámicas cuando sea necesario
      if (message === 'evio_orden' && templateVariables && Object.keys(templateVariables).length > 0) {
        // Enviar template con variables para evio_orden
        console.log('🔧 Usando sendTemplateWithVariables para evio_orden con variables:', templateVariables);
        result = await metaWhatsAppService.sendTemplateWithVariables(
          to, 
          message, 
          'es_AR', 
          templateVariables
        );
      } else {
        // Enviar template sin componentes dinámicos por defecto
        console.log('🔧 Usando sendTemplateMessage para template sin variables');
        result = await metaWhatsAppService.sendTemplateMessage(to, message, 'es_AR', 0, templateVariables);
      }
    } else {
      // 🔧 MEJORA: Procesar variables en mensajes de texto
      messageContent = processTextMessage(message, templateVariables);
      
      console.log('📋 Enviando mensaje de texto:', {
        originalMessage: message,
        templateVariables,
        processedMessage: messageContent
      });
      
      result = await metaWhatsAppService.sendMessage(to, messageContent);
    }
    
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Error enviando mensaje' },
        { status: 500 }
      );
    }

    // 🔧 MEJORA: Guardar mensaje en la base de datos
    if (supabase) {
      console.log('💾 [POST /api/whatsapp/send] Llamando a saveMessageToDatabase...');
      await saveMessageToDatabase(to, messageContent, result, userId);
      console.log('✅ [POST /api/whatsapp/send] saveMessageToDatabase completado');
    }

    return NextResponse.json({
      success: true,
      message_id: result.id || `msg_${Date.now()}`,
      recipient: to,
      content: messageContent,
      simulated: result.simulated || false
    });

  } catch (error) {
    console.error('Error en POST /api/whatsapp/send:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// 🔧 MEJORA: Funciones helper para mejor organización
function generateTemplateContent(templateName: string, variables?: Record<string, string>): string {
  switch (templateName) {
    case 'evio_orden':
      const providerName = variables?.['provider_name'] || 'Proveedor';
      const contactName = variables?.['contact_name'] || 'Contacto';
      // 🔧 CORRECCIÓN: Generar el contenido real del template que se envía a WhatsApp
      return `🛒 *NUEVA ORDEN - ${providerName}*

Buen día ${contactName}! En cuanto me confirmes, paso el pedido de esta semana.`;
    
    case 'hello_world':
      return '👋 ¡Hola! Este es un mensaje de prueba.';
    
    case 'inicializador_de_conv':
      return '🚀 Iniciando conversación...';
    
    default:
      // 🔧 CORRECCIÓN: Para templates no definidos, mostrar información más útil
      if (variables && Object.keys(variables).length > 0) {
        const variableList = Object.entries(variables)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        return `📋 Template: ${templateName} (${variableList})`;
      }
      return `📋 Template: ${templateName}`;
  }
}

function processTextMessage(message: string, variables?: Record<string, string>): string {
  if (!variables || typeof variables !== 'object') {
    return message;
  }
  
  let processedMessage = message;
  Object.keys(variables).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = variables[key];
    processedMessage = processedMessage.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return processedMessage;
}

async function saveMessageToDatabase(to: string, content: string, result: any, userId?: string): Promise<void> {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [saveMessageToDatabase] Iniciando guardado de mensaje:', {
        to,
        content,
        providedUserId: userId,
        resultId: result?.id
      });
    }

    let targetUserId = userId;
    
    // Si no se proporciona userId, buscar el user_id del proveedor basado en el número de teléfono
    if (!targetUserId) {
      console.log('🔍 [saveMessageToDatabase] Buscando proveedor para número:', to);
      
      const { data: providers, error: providerError } = await supabase
        .from('providers')
        .select('user_id, phone')
        .or(`phone.eq.${to},phone.eq.${to.replace('+', '')}`);

      console.log('🔍 [saveMessageToDatabase] Resultado de búsqueda:', {
        providers,
        error: providerError,
        count: providers?.length || 0
      });

      if (providerError || !providers || providers.length === 0) {
        console.log('⚠️ [saveMessageToDatabase] No se encontró proveedor para el número:', to);
        return;
      }
      
      targetUserId = providers[0].user_id;
      console.log('✅ [saveMessageToDatabase] Proveedor encontrado, user_id:', targetUserId);
    } else {
      console.log('✅ [saveMessageToDatabase] Usando user_id proporcionado:', targetUserId);
    }

    const messageSid = result.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 🔧 SOLUCIÓN: Verificar si el mensaje ya existe antes de insertar
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [saveMessageToDatabase] Verificando duplicados...');
    }
    
    const { data: existingMessages, error: checkError } = await supabase
      .from('whatsapp_messages')
      .select('id, message_sid, content, contact_id, user_id')
      .eq('content', content)
      .eq('contact_id', to)
      .eq('message_type', 'sent')
      .gte('created_at', new Date(Date.now() - 30000).toISOString()); // Últimos 30 segundos
    
    if (checkError) {
      console.error('❌ [saveMessageToDatabase] Error verificando duplicados:', checkError);
    } else if (existingMessages && existingMessages.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ [saveMessageToDatabase] Mensaje duplicado detectado, ignorando inserción:', {
          existingCount: existingMessages.length,
          existingIds: existingMessages.map(m => m.message_sid),
          content,
          contact_id: to
        });
      }
      return; // No insertar si ya existe
    }
    
    console.log('💾 Guardando mensaje en BD:', {
      content,
      message_type: 'sent',
      contact_id: to,
      user_id: targetUserId,
      message_sid: messageSid
    });

    const { error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert([{
        content,
        message_type: 'sent',
        status: 'sent',
        contact_id: to,
        user_id: targetUserId,
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
        content,
        userId: targetUserId
      });
    }
  } catch (dbError) {
    console.error('❌ Error en operación de base de datos:', dbError);
  }
}
