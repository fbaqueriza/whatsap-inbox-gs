/**
 * 🔧 REFACTORIZACIÓN: Servicio simplificado de notificaciones
 * Maneja envío de templates de WhatsApp de forma robusta y simple
 * 🔧 OPTIMIZADO: Usa servicios centralizados para evitar duplicaciones
 */

import { getSupabaseServerClient } from './supabase/serverClient';
import { ORDER_STATUS } from './orderConstants';
import { metaWhatsAppService } from './metaWhatsAppService';
import { PhoneNumberService } from './phoneNumberService';

export interface NotificationResult {
  success: boolean;
  templateSent: boolean;
  pendingOrderSaved: boolean;
  errors: string[];
}

export class NotificationService {
  private static instance: NotificationService;
  private supabase = getSupabaseServerClient();

  constructor() {
    console.log('🔧 NotificationService: Constructor ejecutado');
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      console.log('🔧 NotificationService: Creando nueva instancia');
      NotificationService.instance = new NotificationService();
    } else {
      console.log('🔧 NotificationService: Usando instancia existente');
    }
    return NotificationService.instance;
  }

  /**
   * 🔧 Enviar notificación de nueva orden al proveedor
   */
  async sendOrderNotification(order: any, userId: string): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: false,
      templateSent: false,
      pendingOrderSaved: false,
      errors: []
    };

    try {
      console.log('🚀 ===== INICIANDO NOTIFICACIÓN =====');
      console.log('📤 Enviando notificación de orden:', order.orderNumber);
      console.log('🔍 Order ID:', order.id);
      console.log('🔍 User ID:', userId);

      // 1. Obtener información del proveedor
      const provider = await this.getProviderInfo(order.providerId);
      if (!provider) {
        result.errors.push('Proveedor no encontrado');
        console.error('❌ Proveedor no encontrado:', order.providerId);
        return result;
      }

      // 2. Normalizar número de teléfono
      console.log('🔍 Datos del proveedor:', {
        id: provider.id,
        name: provider.name,
        phone: provider.phone,
        contact_name: provider.contact_name
      });
      
      const normalizedPhone = PhoneNumberService.normalizePhoneNumber(provider.phone);
      if (!normalizedPhone) {
        result.errors.push(`Número de teléfono inválido: ${provider.phone}`);
        console.error('❌ Número de teléfono inválido:', provider.phone);
        return result;
      }
      
      console.log('✅ Número normalizado:', normalizedPhone);

      // 3. Enviar template de WhatsApp
      const templateResult = await this.sendWhatsAppTemplate(normalizedPhone, order, provider);
      if (templateResult.success) {
        result.templateSent = true;
        console.log('✅ Template WhatsApp enviado exitosamente');
      } else {
        result.errors.push(`Error enviando template: ${templateResult.error}`);
        console.log('❌ Error enviando template WhatsApp:', templateResult.error);
      }

      // 4. Guardar orden pendiente
      const pendingResult = await this.savePendingOrder(order, provider, userId);
      if (pendingResult.success) {
        result.pendingOrderSaved = true;
        console.log('✅ Orden pendiente guardada');
      } else {
        result.errors.push(`Error guardando orden pendiente: ${pendingResult.error}`);
      }

      // 5. NO cambiar estado aquí - se mantiene en standby hasta recibir respuesta del proveedor
      // El estado solo cambia cuando el proveedor responde (confirmación o rechazo)
      if (result.templateSent && result.pendingOrderSaved) {
        result.success = true;
        console.log('✅ Notificación enviada exitosamente - Orden permanece en standby esperando respuesta del proveedor');
      } else {
        console.log('⚠️ Error en notificación - Orden permanece en standby');
        result.success = false;
      }

    } catch (error) {
      console.error('❌ Error en notificación:', error);
      result.errors.push(error instanceof Error ? error.message : 'Error desconocido');
    }

    console.log('🏁 ===== FINALIZANDO NOTIFICACIÓN =====');
    console.log('📊 Resultado final:', result);
    return result;
  }

  /**
   * 🔧 Obtener información del proveedor
   */
  private async getProviderInfo(providerId: string): Promise<any | null> {
    try {
      if (!this.supabase) return null;

      const { data: provider, error } = await this.supabase
        .from('providers')
        .select('*')
        .eq('id', providerId)
        .single();

      if (error) {
        console.error('❌ Error obteniendo proveedor:', error);
        return null;
      }

      return provider;
    } catch (error) {
      console.error('❌ Error obteniendo proveedor:', error);
      return null;
    }
  }

  // 🔧 OPTIMIZACIÓN: Función normalizePhoneNumber eliminada - usa PhoneNumberService.normalizePhoneNumber()

  /**
   * 🔧 Enviar template de WhatsApp usando el servicio original que funcionaba
   */
  private async sendWhatsAppTemplate(phone: string, order: any, provider: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📱 Enviando template WhatsApp usando metaWhatsAppService a:', phone);
      console.log('🔍 Estado del servicio:', {
        isEnabled: metaWhatsAppService.isServiceEnabled(),
        isSimulationMode: metaWhatsAppService.isSimulationModeEnabled()
      });

      // 🔧 CORRECCIÓN: Usar las variables correctas para el template evio_orden
      const templateVariables = {
        provider_name: provider.name || 'Proveedor',
        contact_name: provider.contact_name || provider.name || 'Contacto'
      };

      console.log('📋 Variables del template:', templateVariables);

      // 🔧 CORRECCIÓN: Usar el mismo método que funcionaba antes del refactor
      const result = await metaWhatsAppService.sendTemplateWithVariables(
        phone, 
        'evio_orden', 
        'es_AR', 
        templateVariables
      );

      console.log('📊 Resultado del envío:', result);

      if (!result) {
        return { 
          success: false, 
          error: 'Error enviando template - servicio no disponible' 
        };
      }

      console.log('✅ Template WhatsApp enviado exitosamente:', result);
      return { success: true };

    } catch (error) {
      console.error('❌ Error enviando template:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error enviando template' 
      };
    }
  }

  /**
   * 🔧 Guardar orden pendiente
   */
  private async savePendingOrder(order: any, provider: any, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'No se pudo conectar a Supabase' };
      }

      // 🔧 CORRECCIÓN: Incluir order_data como JSON string para evitar constraint violation
      const orderData = {
        id: order.id,
        orderNumber: order.orderNumber,
        items: order.items,
        totalAmount: order.totalAmount,
        status: order.status,
        providerId: order.providerId,
        userId: order.userId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };

      const { error } = await (this.supabase as any)
        .from('pending_orders')
        .insert({
          order_id: order.id,
          provider_id: provider.id,
          user_id: userId,
          provider_phone: provider.phone,
          order_data: JSON.stringify(orderData), // 🔧 CORRECCIÓN: Incluir order_data
          status: 'pending_confirmation',
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Error guardando orden pendiente:', error);
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      console.error('❌ Error guardando orden pendiente:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error guardando orden pendiente' 
      };
    }
  }

  /**
   * 🔧 Actualizar estado de la orden
   */
  private async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      if (!this.supabase) return;

      const { error } = await (this.supabase as any)
        .from('orders')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('❌ Error actualizando estado de orden:', error);
      } else {
        console.log('✅ Estado de orden actualizado:', status);
      }

    } catch (error) {
      console.error('❌ Error actualizando estado de orden:', error);
    }
  }

  /**
   * 🔧 Formatear items de la orden
   */
  private formatOrderItems(items: any[]): string {
    if (!items || items.length === 0) return 'Sin items especificados';
    
    return items.slice(0, 3).map(item => 
      `${item.productName} (${item.quantity} ${item.unit || 'un'})`
    ).join(', ') + (items.length > 3 ? '...' : '');
  }

  /**
   * 🔧 Formatear moneda
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  }

  /**
   * 🔧 Procesar respuesta del proveedor
   */
  async processProviderResponse(phone: string, message: string): Promise<{ success: boolean; orderId?: string }> {
    try {
      console.log('🔧 DEBUG: processProviderResponse llamado:', { phone, message: message.substring(0, 50) + '...' });

      // 🔧 CORRECCIÓN CRÍTICA: Buscar tanto órdenes pendientes como enviadas
      const pendingOrder = await this.findPendingOrderByPhone(phone);
      const sentOrder = await this.checkSentOrder(phone);
      
      if (pendingOrder) {
        console.log('🔧 DEBUG: Orden pendiente encontrada, procesando confirmación');
        // Procesar orden pendiente (lógica existente)
        return await this.processPendingOrderResponse(phone, message, pendingOrder);
      } else if (sentOrder) {
        console.log('🔧 DEBUG: Orden enviada encontrada, procesando respuesta');
        // Procesar orden enviada (nueva lógica)
        return await this.processSentOrderResponse(phone, message, sentOrder);
      } else {
        console.log('⚠️ No se encontró orden pendiente ni enviada para este proveedor');
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Error en processProviderResponse:', error);
      return { success: false };
    }
  }

  /**
   * 🔧 NUEVA FUNCIÓN: Procesar respuesta de orden pendiente
   */
  private async processPendingOrderResponse(phone: string, message: string, pendingOrder: any): Promise<{ success: boolean; orderId?: string }> {
    try {
      console.log('📱 Procesando respuesta del proveedor (cualquier mensaje confirma):', { phone, message: message.substring(0, 50) + '...' });

      // 🔧 CAMBIO: Cualquier respuesta del proveedor confirma la orden
      const isConfirmation = this.isConfirmationMessage(message);
      
      if (isConfirmation) {
        // Confirmar orden - cualquier mensaje es confirmación
        await this.confirmOrder(pendingOrder.order_id, phone);
        console.log('✅ Orden confirmada por proveedor (cualquier respuesta)');
      } else {
        // Solo rechazar si el mensaje está vacío (no debería pasar)
        await this.rejectOrder(pendingOrder.order_id);
        console.log('❌ Orden rechazada - mensaje vacío');
      }

      return { success: true, orderId: pendingOrder.order_id };

    } catch (error) {
      console.error('❌ Error procesando respuesta del proveedor:', error);
      return { success: false };
    }
  }

  /**
   * 🔧 NUEVA FUNCIÓN: Procesar respuesta de orden enviada (cambiar a PENDIENTE_DE_PAGO)
   */
  async processSentOrderResponse(phone: string, message: string, sentOrder: any): Promise<{ success: boolean; orderId?: string }> {
    try {
      console.log('🔧 DEBUG: processSentOrderResponse llamado:', {
        phone,
        orderId: sentOrder.id,
        message: message.substring(0, 50) + '...'
      });

      // 🔧 LÓGICA: Cualquier respuesta del proveedor después de recibir detalles
      // significa que está listo para enviar factura (cambiar a PENDIENTE_DE_PAGO)
      const isDetailsResponse = this.isConfirmationMessage(message);
      
      if (isDetailsResponse) {
        // Cambiar estado a PENDIENTE_DE_PAGO (Esperando factura)
        await this.updateOrderToPendingPayment(sentOrder.id, phone);
        console.log('✅ Orden cambiada a PENDIENTE_DE_PAGO (Esperando factura)');
      } else {
        console.log('⚠️ Respuesta vacía de orden enviada, no se cambia estado');
      }

      return { success: true, orderId: sentOrder.id };

    } catch (error) {
      console.error('❌ Error procesando respuesta de orden enviada:', error);
      return { success: false };
    }
  }

  /**
   * 🔧 Buscar orden pendiente por teléfono
   */
  private async findPendingOrderByPhone(phone: string): Promise<any | null> {
    try {
      if (!this.supabase) return null;

      const normalizedPhone = PhoneNumberService.normalizePhoneNumber(phone);
      if (!normalizedPhone) return null;

      const { data: pendingOrder, error } = await this.supabase
        .from('pending_orders')
        .select('*')
        .eq('provider_phone', normalizedPhone)
        .eq('status', 'pending_confirmation')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('❌ Error buscando orden pendiente:', error);
        return null;
      }

      return pendingOrder;
    } catch (error) {
      console.error('❌ Error buscando orden pendiente:', error);
      return null;
    }
  }

  /**
   * 🔧 Buscar orden pendiente por número de teléfono del proveedor
   */
  async checkPendingOrder(phoneNumber: string): Promise<any> {
    try {
      if (!this.supabase) return null;

      // 🔧 CORRECCIÓN CRÍTICA: Normalizar número para consistencia
      const normalizedPhone = PhoneNumberService.normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) return null;

      console.log('🔍 Buscando orden pendiente para teléfono:', normalizedPhone);

      const { data: pendingOrder, error } = await (this.supabase as any)
        .from('pending_orders')
        .select('*')
        .eq('provider_phone', normalizedPhone)
        .eq('status', 'pending_confirmation')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.log('ℹ️ No se encontró orden pendiente para:', normalizedPhone);
        return null;
      }

      console.log('✅ Orden pendiente encontrada:', pendingOrder);
      return pendingOrder;
    } catch (error) {
      console.error('❌ Error buscando orden pendiente por teléfono:', error);
      return null;
    }
  }

  /**
   * 🔧 NUEVA FUNCIÓN: Buscar orden enviada por número de teléfono del proveedor
   */
  async checkSentOrder(phoneNumber: string): Promise<any> {
    try {
      if (!this.supabase) return null;

      const normalizedPhone = PhoneNumberService.normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) return null;

      console.log('🔧 DEBUG: Buscando orden enviada para teléfono:', normalizedPhone);

      // Buscar orden en estado ENVIADO para este proveedor
      const { data: sentOrder, error } = await (this.supabase as any)
        .from('orders')
        .select(`
          *,
          providers!inner(
            id,
            name,
            phone
          )
        `)
        .eq('providers.phone', normalizedPhone)
        .eq('status', ORDER_STATUS.ENVIADO)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // No es un error si no se encuentra, solo log en desarrollo
        if (process.env.NODE_ENV === 'development') {
          console.log('ℹ️ No se encontró orden enviada para:', normalizedPhone);
        }
        return null;
      }

      console.log('✅ Orden enviada encontrada:', sentOrder);
      return sentOrder;
    } catch (error) {
      console.error('❌ Error buscando orden enviada:', error);
      return null;
    }
  }

  /**
   * 🔧 Determinar si el mensaje es una confirmación
   * 🔧 CAMBIO: CUALQUIER respuesta del proveedor se considera confirmación
   */
  private isConfirmationMessage(message: string): boolean {
    // 🔧 SIMPLIFICACIÓN: Cualquier mensaje no vacío es confirmación
    return message && message.trim().length > 0;
  }

  /**
   * 🔧 Confirmar orden - Cambiar estado a ENVIADO cuando el proveedor confirma
   */
  private async confirmOrder(orderId: string, providerPhone?: string): Promise<void> {
    try {
      if (!this.supabase) return;

      console.log('✅ Proveedor confirmó orden - Cambiando estado a ENVIADO:', orderId);

      // 1. Obtener información de la orden con datos del proveedor
      const { data: order, error: orderFetchError } = await (this.supabase as any)
        .from('orders')
        .select(`
          *,
          providers!inner(
            id,
            name,
            contact_name,
            phone
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderFetchError) {
        console.error('❌ Error obteniendo orden:', orderFetchError);
        return;
      }

      // 2. Actualizar orden a ENVIADO
      const { error: orderError } = await (this.supabase as any)
        .from('orders')
        .update({
          status: ORDER_STATUS.ENVIADO,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderError) {
        console.error('❌ Error actualizando orden a ENVIADO:', orderError);
        return;
      }

      // 3. Actualizar orden pendiente
      const { error: pendingError } = await (this.supabase as any)
        .from('pending_orders')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('order_id', orderId);

      if (pendingError) {
        console.error('❌ Error actualizando orden pendiente:', pendingError);
      } else {
        console.log('✅ Orden confirmada y estado actualizado a ENVIADO');
      }

      // 4. Enviar detalles del pedido al proveedor
      if (providerPhone) {
        await this.sendOrderDetails(providerPhone, order);
      }

    } catch (error) {
      console.error('❌ Error confirmando orden:', error);
    }
  }

  /**
   * 🔧 Enviar detalles del pedido al proveedor
   */
  private async sendOrderDetails(providerPhone: string, order: any): Promise<void> {
    try {
      console.log('📋 Enviando detalles del pedido a:', providerPhone);

      // Formatear detalles del pedido
      const orderDetails = this.formatOrderDetails(order);
      
      // Enviar mensaje con detalles usando metaWhatsAppService
      const result = await metaWhatsAppService.sendMessage(
        providerPhone,
        orderDetails,
        order.user_id // CORREGIDO: Pasar user_id para que aparezca en el chat
      );

      if (result) {
        console.log('✅ Detalles del pedido enviados exitosamente');
      } else {
        console.log('❌ Error enviando detalles del pedido');
      }

    } catch (error) {
      console.error('❌ Error enviando detalles del pedido:', error);
    }
  }

  /**
   * 🔧 Formatear detalles del pedido para envío - FORMATO ESPECÍFICO DEL USUARIO
   */
  private formatOrderDetails(order: any): string {
    // Obtener fecha actual
    const currentDate = new Date().toLocaleDateString('es-AR');
    
    // Obtener nombre del proveedor - CORREGIDO
    const providerName = order.providers?.name || order.provider?.name || order.provider_name || 'Proveedor';
    
    // Formatear items del pedido
    const items = order.items?.map((item: any) => {
      const productName = item.name || item.productName;
      const quantity = item.quantity;
      const unit = item.unit || 'unidades';
      
      // Si es texto libre (quantity=1 y unit='un'), mostrar solo el texto
      if (quantity === 1 && unit === 'un') {
        return `• ${productName}`;
      }
      
      // Si es formato estructurado, mostrar con cantidad y unidad
      return `• ${productName}: ${quantity} ${unit}`;
    }).join('\n') || 'No hay items especificados';

    // Fecha de entrega con horarios - CORREGIDO
    let deliveryDate = 'No especificada';
    if (order.desired_delivery_date) {
      const date = new Date(order.desired_delivery_date).toLocaleDateString('es-AR');
      const times = order.desired_delivery_time;
      if (times && Array.isArray(times) && times.length > 0) {
        deliveryDate = `${date} - ${times.join(', ')}`;
      } else {
        deliveryDate = date;
      }
    }

    // Método de pago
    const paymentMethod = order.payment_method || 'No especificado';

    // Notas (solo mostrar si existen)
    const notes = order.notes || order.special_instructions;
    const notesSection = notes && notes.trim() 
      ? `\n\nNotas: ${notes}` 
      : '';

    return `🆔 Orden: ${order.order_number || order.orderNumber || order.id}
📅 Entrega: ${deliveryDate}
💳 Pago: ${paymentMethod}

📦 Items:
${items}
${notesSection}

Gracias. Aguardamos la factura.

Saludos!`;
  }

  /**
   * 🔧 Rechazar orden
   */
  private async rejectOrder(orderId: string): Promise<void> {
    try {
      if (!this.supabase) return;

      // Actualizar orden
      await (this.supabase as any)
        .from('orders')
        .update({
          status: ORDER_STATUS.STANDBY,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      // Actualizar orden pendiente
      await (this.supabase as any)
        .from('pending_orders')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('order_id', orderId);

    } catch (error) {
      console.error('❌ Error rechazando orden:', error);
    }
  }

  /**
   * 🔧 NUEVA FUNCIÓN: Actualizar orden a PENDIENTE_DE_PAGO (Esperando factura)
   */
  private async updateOrderToPendingPayment(orderId: string, providerPhone?: string): Promise<void> {
    try {
      if (!this.supabase) return;

      console.log('🔧 DEBUG: updateOrderToPendingPayment llamado:', orderId);

      // Actualizar orden a PENDIENTE_DE_PAGO
      const { error: orderError } = await (this.supabase as any)
        .from('orders')
        .update({
          status: ORDER_STATUS.PENDIENTE_DE_PAGO,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderError) {
        console.error('❌ Error actualizando orden a PENDIENTE_DE_PAGO:', orderError);
        return;
      }

      console.log('✅ Orden actualizada a PENDIENTE_DE_PAGO (Esperando factura)');

      // Opcional: Enviar mensaje de confirmación al proveedor
      if (providerPhone) {
        await this.sendInvoiceRequestMessage(providerPhone, orderId);
      }

    } catch (error) {
      console.error('❌ Error actualizando orden a PENDIENTE_DE_PAGO:', error);
    }
  }

  /**
   * 🔧 NUEVA FUNCIÓN: Enviar mensaje solicitando factura
   */
  private async sendInvoiceRequestMessage(providerPhone: string, orderId: string): Promise<void> {
    try {
      console.log('📄 Enviando solicitud de factura a:', providerPhone);

      const message = `📄 *SOLICITUD DE FACTURA*

Gracias por confirmar los detalles del pedido. 

Por favor, envíe la factura correspondiente para proceder con el pago.

🆔 *Orden:* ${orderId}

Saludos!`;

      // Enviar mensaje usando metaWhatsAppService
      const result = await metaWhatsAppService.sendMessage(providerPhone, message);

      if (result) {
        console.log('✅ Solicitud de factura enviada exitosamente');
      } else {
        console.log('❌ Error enviando solicitud de factura');
      }

    } catch (error) {
      console.error('❌ Error enviando solicitud de factura:', error);
    }
  }
}
