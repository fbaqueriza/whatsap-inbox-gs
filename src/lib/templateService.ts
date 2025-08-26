const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v19.0';
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export class TemplateService {
  /**
   * Obtiene la lista de templates disponibles desde Meta API
   */
  static async getTemplates() {
    try {
      if (!WHATSAPP_API_KEY || !PHONE_NUMBER_ID) {
        throw new Error('Variables de entorno de WhatsApp no configuradas');
      }

      const response = await fetch(`${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/message_templates`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error obteniendo templates: ${errorData.error?.message || 'Error desconocido'}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('❌ Error obteniendo templates:', error);
      throw error;
    }
  }

  /**
   * Obtiene el contenido de un template específico
   */
  static async getTemplateContent(templateName: string, params?: any[]) {
    try {
      const templates = await this.getTemplates();
      const template = templates.find((t: any) => t.name === templateName);
      
      if (!template) {
        console.warn(`⚠️ Template no encontrado: ${templateName}`);
        return `📋 Template: ${templateName} enviado`;
      }

      // Obtener el contenido del template
      const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
      const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
      const footerComponent = template.components?.find((c: any) => c.type === 'FOOTER');

      let templateContent = bodyComponent?.text || headerComponent?.text || footerComponent?.text;

      if (!templateContent) {
        console.warn(`⚠️ No se encontró contenido en el template: ${templateName}`);
        return `📋 Template: ${templateName} enviado`;
      }

      // Reemplazar parámetros si existen
      if (params && params.length > 0) {
        params.forEach((param, index) => {
          const paramValue = typeof param === 'object' ? param.text : param;
          templateContent = templateContent.replace(`{{${index + 1}}}`, paramValue);
        });
      }

      return templateContent;
    } catch (error) {
      console.error('❌ Error obteniendo contenido del template:', error);
      return `📋 Template: ${templateName} enviado`;
    }
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
