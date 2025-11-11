const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v23.0';
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export class TemplateService {
  /**
   * Obtiene la lista de templates disponibles desde Meta API
   */
  static async getTemplates() {
    try {
      console.log('🔍 Verificando variables de entorno...');
      console.log('WHATSAPP_API_URL:', WHATSAPP_API_URL);
      console.log('WHATSAPP_API_KEY:', WHATSAPP_API_KEY ? 'Configurado' : 'No configurado');
      console.log('PHONE_NUMBER_ID:', PHONE_NUMBER_ID ? 'Configurado' : 'No configurado');

      if (!WHATSAPP_API_KEY || !PHONE_NUMBER_ID) {
        console.error('❌ Variables de entorno faltantes');
        return []; // Retornar array vacío en lugar de throw error
      }

      // 🔧 CORRECCIÓN: Usar el endpoint correcto para obtener templates
      const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
      if (!businessAccountId) {
        console.error('❌ WHATSAPP_BUSINESS_ACCOUNT_ID no configurado');
        return [];
      }

      const url = `${WHATSAPP_API_URL}/${businessAccountId}/message_templates`;
      
      console.log('🔍 Consultando templates en Meta API...');
      console.log('🔍 URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('❌ Error obteniendo templates:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      console.log('✅ Templates obtenidos exitosamente:', data.data?.length || 0, 'templates');
      console.log('📋 Templates disponibles:', data.data?.map(t => t.name) || []);
      
      return data.data || [];
    } catch (error) {
      console.error('❌ Error obteniendo templates:', error);
      return []; // Retornar array vacío en lugar de throw error
    }
  }

  /**
   * Obtiene el contenido de un template específico
   */
  static async getTemplateContent(templateName: string, params?: any[] | Record<string, string>) {
    try {
      // 🔧 CORRECCIÓN: Primero buscar en la base de datos local
      const localContent = await this.getTemplateFromDatabase(templateName);
      
      if (localContent) {
        console.log(`✅ Template encontrado en BD local: ${templateName}`);
        console.log(`📝 Contenido: ${localContent.substring(0, 100)}...`);
        return localContent;
      }
      
      // Si no se encuentra en BD local, intentar obtener desde Meta API
      console.log(`⚠️ Template no encontrado en BD local, consultando Meta API: ${templateName}`);
      const templates = await this.getTemplates();
      
      if (templates && templates.length > 0) {
        const template = templates.find(t => t.name === templateName);
        
        if (template) {
          console.log(`✅ Template encontrado en Meta API: ${templateName}`);
          
          // Extraer el contenido del template desde los componentes
          const content = this.extractTemplateContent(template);
          
          if (content) {
            console.log(`📝 Contenido extraído del template:`, content.substring(0, 100) + '...');
            // Guardar en BD local para futuras consultas
            await this.saveTemplateToDatabase(template, content);
            return content;
          }
        }
      }
      
      // Si no se encuentra el template, usar fallback
      console.log(`ℹ️ Template no encontrado, usando fallback para: ${templateName}`, params ? 'con parámetros' : 'sin parámetros');
      return this.getFallbackTemplateContent(templateName, params);
      
    } catch (error) {
      console.error('❌ Error obteniendo contenido del template:', error);
      return this.getFallbackTemplateContent(templateName, params);
    }
  }

  /**
   * Obtiene contenido de fallback para templates
   * VERSIÓN MEJORADA: Contenido más detallado y útil con variables dinámicas
   */
  static getFallbackTemplateContent(templateName: string, params?: any[] | Record<string, string>): string {
    const fallbackTemplates: { [key: string]: string } = {
      'envio_de_orden': `🛒 *NUEVO PEDIDO*

Se ha recibido un nuevo pedido para procesar. 

*Detalles del pedido:*
• Fecha: ${new Date().toLocaleDateString('es-AR')}
• Estado: Pendiente de confirmación
• Tipo: Pedido automático

*Acciones requeridas:*
1. Revisar los productos solicitados
2. Confirmar disponibilidad
3. Proporcionar precio final
4. Confirmar fecha de entrega

_Por favor confirma la recepción de este pedido y proporciona los detalles solicitados._`,
      'inicializador_de_conv': `Hola! Este es un mensaje para que retomemos nuestra conversacion. En cuanto me respondas podemos seguir conversando.`,
      'evio_orden': this.getEvioOrdenTemplate(params),
      'notificacion_pedido': '📋 Notificación de nuevo pedido recibido.',
      'confirmacion_pedido': '✅ Pedido confirmado y en proceso.',
      'recordatorio_pedido': '⏰ Recordatorio: Pedido pendiente de confirmación.',
      'pedido_enviado': '📤 Pedido enviado al proveedor.',
      'pedido_confirmado': '✅ Pedido confirmado por el proveedor.',
      'pedido_rechazado': '❌ Pedido rechazado por el proveedor.',
      'pedido_modificado': '🔄 Pedido modificado.',
      'pedido_cancelado': '🚫 Pedido cancelado.',
      'pedido_entregado': '🎉 Pedido entregado exitosamente.',
      'recordatorio_pago': '💰 Recordatorio de pago pendiente.',
      'confirmacion_pago': '💳 Pago confirmado.',
      'error_pago': '⚠️ Error en el procesamiento del pago.'
    };
    
    return fallbackTemplates[templateName] || `📋 Template: ${templateName} enviado`;
  }

  /**
   * Obtiene el contenido de un template desde la base de datos local
   */
  private static async getTemplateFromDatabase(templateName: string): Promise<string | null> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: template, error } = await supabase
        .from('whatsapp_templates')
        .select('content')
        .eq('name', templateName)
        .single();

      if (error) {
        console.log(`ℹ️ Template ${templateName} no encontrado en BD local`);
        return null;
      }

      return template?.content || null;
    } catch (error) {
      console.error('❌ Error obteniendo template de BD:', error);
      return null;
    }
  }

  /**
   * Guarda un template en la base de datos local
   */
  private static async saveTemplateToDatabase(template: any, content: string): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const templateData = {
        name: template.name,
        status: template.status,
        category: template.category,
        language: template.language,
        content: content,
        components: JSON.stringify(template.components || []),
        meta_id: template.id,
        created_at: template.created_time ? new Date(template.created_time * 1000).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Verificar si ya existe
      const { data: existingTemplate } = await supabase
        .from('whatsapp_templates')
        .select('id')
        .eq('name', template.name)
        .single();

      if (existingTemplate) {
        // Actualizar
        await supabase
          .from('whatsapp_templates')
          .update({
            status: templateData.status,
            category: templateData.category,
            language: templateData.language,
            content: templateData.content,
            components: templateData.components,
            meta_id: templateData.meta_id,
            updated_at: templateData.updated_at
          })
          .eq('name', template.name);
        
        console.log(`✅ Template actualizado en BD local: ${template.name}`);
      } else {
        // Crear
        await supabase
          .from('whatsapp_templates')
          .insert([templateData]);
        
        console.log(`✅ Template guardado en BD local: ${template.name}`);
      }
    } catch (error) {
      console.error('❌ Error guardando template en BD:', error);
    }
  }

  /**
   * Extrae el contenido de texto de un template desde sus componentes
   */
  private static extractTemplateContent(template: any): string {
    try {
      if (!template.components || !Array.isArray(template.components)) {
        return '';
      }

      // Buscar el componente BODY que contiene el texto principal
      const bodyComponent = template.components.find((comp: any) => comp.type === 'BODY');
      
      if (bodyComponent && bodyComponent.text) {
        return bodyComponent.text;
      }

      // Si no hay BODY, buscar HEADER o FOOTER
      const headerComponent = template.components.find((comp: any) => comp.type === 'HEADER');
      const footerComponent = template.components.find((comp: any) => comp.type === 'FOOTER');
      
      let content = '';
      if (headerComponent && headerComponent.text) {
        content += headerComponent.text + '\n\n';
      }
      if (footerComponent && footerComponent.text) {
        content += footerComponent.text;
      }

      return content.trim();
    } catch (error) {
      console.error('❌ Error extrayendo contenido del template:', error);
      return '';
    }
  }

  /**
   * Obtiene información detallada de un template
   */
  static async getTemplateInfo(templateName: string) {
    try {
      const templates = await this.getTemplates();
      const template = templates.find(t => t.name === templateName);
      
      if (template) {
        return {
          id: template.id,
          name: template.name,
          status: template.status,
          category: template.category,
          language: template.language,
          components: template.components || []
        };
      }
      
      // Fallback si no se encuentra
      return {
        id: `fallback_${templateName}`,
        name: templateName,
        status: 'APPROVED',
        category: 'UTILITY',
        language: 'es_AR',
        components: []
      };
    } catch (error) {
      console.error('❌ Error obteniendo información del template:', error);
      return null;
    }
  }

  /**
   * Genera el contenido del template evio_orden con variables dinámicas
   */
  private static getEvioOrdenTemplate(params?: any[] | Record<string, string>): string {
    // Extraer variables del parámetro
    let providerName = 'Proveedor';
    let orderNumber = 'N/A';
    let items = 'Productos solicitados';
    let total = 'Pendiente';

    if (params) {
      if (Array.isArray(params)) {
        // Si es un array, asumir orden: [providerName, orderNumber, items, total]
        providerName = params[0] || providerName;
        orderNumber = params[1] || orderNumber;
        items = params[2] || items;
        total = params[3] || total;
      } else if (typeof params === 'object') {
        // Si es un objeto, extraer por keys
        providerName = params.provider_name || params.providerName || providerName;
        orderNumber = params.order_number || params.orderNumber || orderNumber;
        items = params.items || items;
        total = params.total || total;
      }
    }

    return `🛒 *NUEVA ORDEN PARA ${providerName.toUpperCase()}*

Se ha recibido una nueva orden para procesar.

*Detalles de la orden:*
• 🆔 Número: ${orderNumber}
• 📅 Fecha: ${new Date().toLocaleDateString('es-AR')}
• 📦 Items: ${items}
• 💰 Total: ${total}
• ⏰ Estado: Pendiente de confirmación

*Acciones requeridas:*
1. Revisar los productos solicitados
2. Confirmar disponibilidad
3. Proporcionar precio final
4. Confirmar fecha de entrega

_Por favor confirma la recepción de esta orden y proporciona los detalles solicitados._

¡Gracias por tu colaboración!`;
  }
}
