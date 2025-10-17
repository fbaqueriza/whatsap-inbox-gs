import { getSupabaseServerClient } from './supabase/serverClient';
import { metaWhatsAppService } from './metaWhatsAppService';
import { ORDER_STATUS } from './orderConstants';

/**
 * Servicio de flujo de órdenes para el SERVIDOR
 * Solo se ejecuta en el servidor donde están disponibles las variables de entorno
 */
export class ServerOrderFlowService {
  private static instance: ServerOrderFlowService;
  private supabase = getSupabaseServerClient();

  private constructor() {}

  public static getInstance(): ServerOrderFlowService {
    if (!ServerOrderFlowService.instance) {
      ServerOrderFlowService.instance = new ServerOrderFlowService();
    }
    return ServerOrderFlowService.instance;
  }

  /**
   * Crear orden y enviar notificación (SOLO SERVIDOR)
   */
  async createOrderAndNotify(order: any, userId: string): Promise<{ success: boolean; orderId?: string; errors?: string[]; message?: string }> {
    try {
      console.log('🚀 [ServerOrderFlow] Creando orden y enviando notificación:', order.id);

      // 🔧 FIX: Primero verificar si la orden ya existe para evitar duplicados
      const { data: existingOrder } = await this.supabase
        .from('orders')
        .select('id')
        .eq('id', order.id)
        .single();

      let orderId: string;
      let orderData: any;

      if (existingOrder) {
        // La orden ya existe, solo enviar notificación
        console.log('⚠️ [ServerOrderFlow] Orden ya existe, saltando creación:', order.id);
        orderId = existingOrder.id;
        
        // Obtener datos completos de la orden existente
        const { data: fullOrder } = await this.supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        
        orderData = fullOrder;
      } else {
        // La orden no existe, crearla
        const orderResult = await this.createOrder(order, userId);
        if (!orderResult.success) {
          return { success: false, errors: orderResult.errors };
        }
        orderId = orderResult.orderId!;
        orderData = orderResult.order!;
        console.log('✅ [ServerOrderFlow] Orden creada:', orderId);
      }

      // 2. Obtener datos del proveedor
      const providerResult = await this.getProviderData(order.providerId);
      if (!providerResult.success) {
        console.log('⚠️ [ServerOrderFlow] No se pudo obtener datos del proveedor, pero orden creada');
        return { 
          success: true, 
          orderId, 
          message: 'Orden creada, pero no se pudo enviar notificación al proveedor' 
        };
      }

      const provider = providerResult.provider!;
      console.log('✅ [ServerOrderFlow] Datos del proveedor obtenidos:', provider.name);

      // 3. Enviar notificación por WhatsApp
      const notificationResult = await this.sendOrderNotification(
        provider.phone, 
        orderData, 
        provider
      );

      if (!notificationResult.success) {
        console.log('⚠️ [ServerOrderFlow] Notificación falló, pero orden creada:', notificationResult.errors);
        return { 
          success: true, 
          orderId, 
          message: 'Orden creada, pero no se pudo enviar notificación al proveedor' 
        };
      }

      console.log('✅ [ServerOrderFlow] Orden creada y notificación enviada exitosamente');
      return { 
        success: true, 
        orderId, 
        message: 'Orden creada y notificación enviada exitosamente' 
      };

    } catch (error) {
      console.error('❌ [ServerOrderFlow] Error en createOrderAndNotify:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Error desconocido'] 
      };
    }
  }

  /**
   * Crear orden en la base de datos
   */
  private async createOrder(order: any, userId: string): Promise<{ success: boolean; orderId?: string; order?: any; errors?: string[] }> {
    try {
      console.log('🔍 [ServerOrderFlow] Datos de orden recibidos:', {
        id: order.id,
        providerId: order.providerId,
        userId: userId,
        hasId: !!order.id
      });

      const orderData = {
        id: order.id,
        user_id: userId,
        provider_id: order.providerId,
        order_number: order.orderNumber, // Agregar order_number
        items: order.items,
        status: ORDER_STATUS.STANDBY,
        notes: order.notes || '',
        desired_delivery_date: order.desiredDeliveryDate,
        total_amount: order.totalAmount || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('📝 [ServerOrderFlow] Insertando orden:', {
        id: orderData.id,
        order_number: orderData.order_number,
        provider_id: orderData.provider_id,
        user_id: orderData.user_id
      });

      const { data, error } = await this.supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) {
        console.error('❌ [ServerOrderFlow] Error creando orden:', error);
        return { success: false, errors: [error.message] };
      }

      return { success: true, orderId: data.id, order: data };

    } catch (error) {
      console.error('❌ [ServerOrderFlow] Error en createOrder:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Error creando orden'] 
      };
    }
  }

  /**
   * Obtener datos del proveedor
   */
  private async getProviderData(providerId: string): Promise<{ success: boolean; provider?: any; errors?: string[] }> {
    try {
      console.log('🔍 [ServerOrderFlow] Obteniendo datos del proveedor:', providerId);

      const { data, error } = await this.supabase
        .from('providers')
        .select('*')
        .eq('id', providerId)
        .single();

      if (error) {
        console.error('❌ [ServerOrderFlow] Error obteniendo proveedor:', error);
        return { success: false, errors: [error.message] };
      }

      return { success: true, provider: data };

    } catch (error) {
      console.error('❌ [ServerOrderFlow] Error en getProviderData:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Error obteniendo proveedor'] 
      };
    }
  }

  /**
   * Enviar notificación de orden por WhatsApp
   */
  private async sendOrderNotification(phone: string, order: any, provider: any): Promise<{ success: boolean; errors?: string[] }> {
    try {
      console.log('📤 [ServerOrderFlow] Iniciando envío de notificación:', {
        phone,
        providerName: provider.name,
        contactName: provider.contact_name,
        orderId: order.id
      });

      const templateVariables = {
        provider_name: provider.name || 'Proveedor',
        contact_name: provider.contact_name || provider.name || 'Contacto'
      };

      console.log('📤 [ServerOrderFlow] Variables del template:', templateVariables);

      const result = await metaWhatsAppService.sendTemplateWithVariables(
        phone,
        'evio_orden',
        'es_AR',
        templateVariables
      );

      console.log('📤 [ServerOrderFlow] Resultado del envío:', result);

      // 🔧 FIX: Guardar mensaje del template en la BD para que aparezca en el chat
      if (result && result.messages && result.messages[0]) {
        try {
          const messageData = {
            content: `Buen día ${templateVariables.contact_name}! Espero que andes bien!\nEn cuanto me confirmes, paso el pedido de esta semana.`,
            message_type: 'sent',
            status: 'sent',
            contact_id: phone,
            user_id: order.user_id,
            message_sid: result.messages[0].id,
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString()
          };

          const { error: messageError } = await this.supabase
            .from('whatsapp_messages')
            .insert([messageData]);

          if (messageError) {
            console.error('❌ [ServerOrderFlow] Error guardando mensaje del template:', messageError);
          } else {
            console.log('✅ [ServerOrderFlow] Mensaje del template guardado en el chat');
          }
        } catch (error) {
          console.error('❌ [ServerOrderFlow] Error guardando mensaje del template:', error);
        }
      }

      return { success: !!result };

    } catch (error) {
      console.error('❌ [ServerOrderFlow] Error enviando notificación:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Error enviando notificación'] 
      };
    }
  }
}

export const serverOrderFlowService = ServerOrderFlowService.getInstance();
