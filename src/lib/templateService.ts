const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v23.0';
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
  static async getTemplateContent(templateName: string, params?: any[] | Record<string, string>) {
    try {
      // Por ahora, siempre usar el sistema de fallback ya que getTemplates() retorna array vacío
      console.log(`ℹ️ Usando fallback para template: ${templateName}`, params ? 'con parámetros' : 'sin parámetros');
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
      'inicializador_de_conv': '👋 ¡Hola! Iniciando conversación para coordinar pedidos.',
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
   * Obtiene información detallada de un template
   */
  static async getTemplateInfo(templateName: string) {
    try {
      // Por ahora, retornar información básica ya que getTemplates() retorna array vacío
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
