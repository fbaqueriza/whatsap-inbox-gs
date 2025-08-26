const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v19.0';
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export class TemplateService {
  /**
   * Obtiene la lista de templates disponibles desde Meta API
   * NOTA: El endpoint /message_templates no existe en WhatsApp Business API
   * Por ahora, retornamos un array vacío y usamos fallback
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

      // NOTA: El endpoint /message_templates no existe en WhatsApp Business API
      // Los templates se configuran en el panel de Meta Business y se usan directamente
      // Por ahora, retornamos un array vacío y usamos el sistema de fallback
      console.log('ℹ️ Endpoint /message_templates no disponible en WhatsApp Business API');
      console.log('ℹ️ Usando sistema de fallback para contenido de templates');
      
      return []; // Retornar array vacío para usar fallback
    } catch (error) {
      console.error('❌ Error obteniendo templates:', error);
      return []; // Retornar array vacío en lugar de throw error
    }
  }

  /**
   * Obtiene el contenido de un template específico
   */
  static async getTemplateContent(templateName: string, params?: any[]) {
    try {
      // Intentar obtener templates desde Meta API
      const templates = await this.getTemplates();
      const template = templates.find((t: any) => t.name === templateName);
      
      if (template) {
        // Obtener el contenido del template
        const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
        const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
        const footerComponent = template.components?.find((c: any) => c.type === 'FOOTER');

        let templateContent = bodyComponent?.text || headerComponent?.text || footerComponent?.text;

        if (templateContent) {
          // Reemplazar parámetros si existen
          if (params && params.length > 0) {
            params.forEach((param, index) => {
              const paramValue = typeof param === 'object' ? param.text : param;
              templateContent = templateContent.replace(`{{${index + 1}}}`, paramValue);
            });
          }
          return templateContent;
        }
      }
      
      // Fallback: Si no se puede obtener el contenido real, usar descripción basada en el nombre
      console.warn(`⚠️ Template no encontrado o sin contenido: ${templateName}`);
      return this.getFallbackTemplateContent(templateName);
      
    } catch (error) {
      console.error('❌ Error obteniendo contenido del template:', error);
      return this.getFallbackTemplateContent(templateName);
    }
  }

  /**
   * Obtiene contenido de fallback para templates
   */
  static getFallbackTemplateContent(templateName: string): string {
    const fallbackTemplates: { [key: string]: string } = {
      'envio_de_orden': '🛒 *NUEVO PEDIDO*\n\nSe ha recibido un nuevo pedido. Por favor revisa los detalles y confirma la recepción.',
      'inicializador_de_conv': '👋 ¡Hola! Iniciando conversación para coordinar pedidos.',
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
   * Obtiene información detallada de un template
   */
  static async getTemplateInfo(templateName: string) {
    try {
      const templates = await this.getTemplates();
      const template = templates.find((t: any) => t.name === templateName);
      
      if (!template) {
        return null;
      }

      return {
        id: template.id,
        name: template.name,
        status: template.status,
        category: template.category,
        language: template.language,
        components: template.components?.map((component: any) => ({
          type: component.type,
          text: component.text,
          format: component.format,
          example: component.example
        }))
      };
    } catch (error) {
      console.error('❌ Error obteniendo información del template:', error);
      return null;
    }
  }
}
