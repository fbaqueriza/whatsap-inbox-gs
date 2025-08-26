const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v19.0';
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

      console.log('📡 Consultando Meta API...');
      // Usar el endpoint correcto para obtener templates
      const response = await fetch(`${WHATSAPP_API_URL}/message_templates`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📊 Respuesta de Meta API:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        console.error('❌ Error de Meta API:', errorData);
        return []; // Retornar array vacío en lugar de throw error
      }

      const data = await response.json();
      console.log('✅ Templates obtenidos:', data.data?.length || 0);
      return data.data || [];
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
      'recordatorio_pedido': '⏰ Recordatorio: Pedido pendiente de confirmación.'
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
