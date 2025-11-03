/**
 * 🚀 SERVICIO UNIFICADO DE FLUJO DE ÓRDENES
 * Maneja todo el flujo de órdenes de forma simple, robusta y en tiempo real
 * 
 * Flujo simplificado:
 * 1. Crear pedido → standby (envía notificación al proveedor)
 * 2. Proveedor responde → enviado (muestra detalles en chat)
 * 3. Proveedor confirma → esperando_factura (esperando factura)
 * 4. Proveedor envía factura → pendiente_de_pago (procesa documento)
 * 5. Usuario sube comprobante → pagado (flujo finalizado)
 */

import { supabase } from './supabase/client';
import { metaWhatsAppService } from './metaWhatsAppService';
import { PhoneNumberService } from './phoneNumberService';
import { ORDER_STATUS } from './orderConstants';

export interface OrderFlowResult {
  success: boolean;
  message?: string;
  orderId?: string;
  newStatus?: string;
  errors?: string[];
}

export class OrderFlowService {
  private static instance: OrderFlowService;
  private supabase = supabase;

  static getInstance(): OrderFlowService {
    if (!OrderFlowService.instance) {
      OrderFlowService.instance = new OrderFlowService();
    }
    return OrderFlowService.instance;
  }

  /**
   * 🚀 PASO 1: Crear pedido y enviar notificación al proveedor
   */
  async createOrderAndNotify(order: any, userId: string): Promise<OrderFlowResult> {
    try {
      console.log('🚀 [OrderFlow] Creando orden y enviando notificación:', order.orderNumber);

      // 1. Crear la orden en estado standby
      const { data: createdOrder, error: createError } = await this.supabase
        .from('orders')
        .insert({
          order_number: order.orderNumber,
          provider_id: order.providerId,
          user_id: userId,
          items: order.items,
          status: ORDER_STATUS.STANDBY,
          total_amount: order.totalAmount,
          currency: order.currency || 'ARS',
          order_date: order.orderDate || new Date().toISOString(),
          due_date: order.dueDate || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          desired_delivery_date: order.desiredDeliveryDate?.toISOString(),
          desired_delivery_time: order.desiredDeliveryTime,
          payment_method: order.paymentMethod || 'efectivo',
          notes: order.notes,
          additional_files: order.additionalFiles || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ [OrderFlow] Error creando orden:', createError);
        return { success: false, errors: [createError.message] };
      }

      // 2. Obtener información del proveedor
      const provider = await this.getProviderInfo(order.providerId);
      if (!provider) {
        return { success: false, errors: ['Proveedor no encontrado'] };
      }

      // 3. Normalizar teléfono del proveedor
      const normalizedPhone = PhoneNumberService.normalizePhoneNumber(provider.phone);
      if (!normalizedPhone) {
        return { success: false, errors: [`Número de teléfono inválido: ${provider.phone}`] };
      }

      // 4. Enviar notificación al proveedor
      const notificationResult = await this.sendOrderNotification(normalizedPhone, createdOrder, provider);
      if (!notificationResult.success) {
        console.warn('⚠️ [OrderFlow] Notificación falló, pero orden creada:', notificationResult.errors);
      }

      console.log('✅ [OrderFlow] Orden creada exitosamente:', createdOrder.id);
      return {
        success: true,
        orderId: createdOrder.id,
        newStatus: ORDER_STATUS.STANDBY,
        message: 'Orden creada y notificación enviada al proveedor'
      };

    } catch (error) {
      console.error('❌ [OrderFlow] Error en createOrderAndNotify:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Error desconocido']
      };
    }
  }

  /**
   * 🚀 PASO 2: Procesar respuesta del proveedor (cualquier mensaje → enviado)
   */
  async processProviderResponse(phone: string, message: string, userId?: string): Promise<OrderFlowResult> {
    try {
      console.log('🔄 [OrderFlow] Procesando respuesta del proveedor:', phone);

      const normalizedPhone = PhoneNumberService.normalizePhoneNumber(phone);
      if (!normalizedPhone) {
        return { success: false, errors: ['Número de teléfono inválido'] };
      }

      // Buscar orden en estado standby para este proveedor
      const order = await this.findOrderByProviderPhone(normalizedPhone, ORDER_STATUS.STANDBY, userId);
      if (!order) {
        console.log('ℹ️ [OrderFlow] No se encontró orden standby para:', normalizedPhone);
        return { success: false, message: 'No hay órdenes pendientes para este proveedor' };
      }

      // Cualquier mensaje del proveedor confirma la orden
      if (message && message.trim().length > 0) {
        await this.updateOrderStatus(order.id, ORDER_STATUS.ENVIADO);
        
        // Enviar detalles del pedido al proveedor
        await this.sendOrderDetails(normalizedPhone, order);
        return {
          success: true,
          orderId: order.id,
          newStatus: ORDER_STATUS.ENVIADO,
          message: 'Orden confirmada y detalles enviados al proveedor'
        };
      }

      return { success: false, errors: ['Mensaje vacío del proveedor'] };

    } catch (error) {
      console.error('❌ [OrderFlow] Error procesando respuesta del proveedor:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Error desconocido']
      };
    }
  }

  /**
   * 🚀 PASO 3: Procesar confirmación del proveedor (cualquier mensaje → esperando_factura)
   */
  async processProviderConfirmation(phone: string, message: string, userId?: string): Promise<OrderFlowResult> {
    try {
      console.log('🔄 [OrderFlow] Procesando confirmación del proveedor:', phone);

      const normalizedPhone = PhoneNumberService.normalizePhoneNumber(phone);
      if (!normalizedPhone) {
        return { success: false, errors: ['Número de teléfono inválido'] };
      }

      // Buscar orden en estado enviado para este proveedor
      const order = await this.findOrderByProviderPhone(normalizedPhone, ORDER_STATUS.ENVIADO, userId);
      if (!order) {
        console.log('ℹ️ [OrderFlow] No se encontró orden enviada para:', normalizedPhone);
        return { success: false, message: 'No hay órdenes enviadas para este proveedor' };
      }

      // Cualquier mensaje del proveedor significa que está listo para enviar factura
      if (message && message.trim().length > 0) {
        await this.updateOrderStatus(order.id, ORDER_STATUS.ESPERANDO_FACTURA);
        
        // Enviar solicitud de factura
        await this.sendInvoiceRequest(normalizedPhone, order);
        return {
          success: true,
          orderId: order.id,
          newStatus: ORDER_STATUS.ESPERANDO_FACTURA,
          message: 'Orden lista para recibir factura'
        };
      }

      return { success: false, errors: ['Mensaje vacío del proveedor'] };

    } catch (error) {
      console.error('❌ [OrderFlow] Error procesando confirmación del proveedor:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Error desconocido']
      };
    }
  }

  /**
   * 🚀 PASO 4: Procesar factura del proveedor (documento → pendiente_de_pago)
   */
  async processInvoiceFromProvider(phone: string, mediaData: any): Promise<OrderFlowResult> {
    try {
      console.log('📄 [OrderFlow] Procesando factura del proveedor:', phone);

      const normalizedPhone = PhoneNumberService.normalizePhoneNumber(phone);
      if (!normalizedPhone) {
        return { success: false, errors: ['Número de teléfono inválido'] };
      }

      // Buscar orden en estado esperando_factura para este proveedor
      const order = await this.findOrderByProviderPhone(normalizedPhone, ORDER_STATUS.ESPERANDO_FACTURA);
      if (!order) {
        console.log('ℹ️ [OrderFlow] No se encontró orden esperando factura para:', normalizedPhone);
        return { success: false, message: 'No hay órdenes esperando factura para este proveedor' };
      }

      // Procesar el documento como factura
      const invoiceResult = await this.processInvoiceDocument(mediaData, order.id);
      if (invoiceResult.success) {
        await this.updateOrderStatus(order.id, ORDER_STATUS.PENDIENTE_DE_PAGO);
        
        console.log('✅ [OrderFlow] Factura procesada y orden lista para pago');
        return {
          success: true,
          orderId: order.id,
          newStatus: ORDER_STATUS.PENDIENTE_DE_PAGO,
          message: 'Factura recibida, esperando comprobante de pago'
        };
      }

      return { success: false, errors: invoiceResult.errors || ['Error procesando factura'] };

    } catch (error) {
      console.error('❌ [OrderFlow] Error procesando factura:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Error desconocido']
      };
    }
  }

  /**
   * 🚀 PASO 5: Procesar comprobante de pago del usuario (archivo → pagado)
   */
  async processPaymentProof(orderId: string, paymentProofFile: any, userId: string): Promise<OrderFlowResult> {
    try {
      console.log('💳 [OrderFlow] Procesando comprobante de pago:', orderId);

      // Verificar que la orden existe y está en estado pendiente_de_pago
      const { data: order, error: orderError } = await this.supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('user_id', userId)
        .eq('status', ORDER_STATUS.PENDIENTE_DE_PAGO)
        .single();

      if (orderError || !order) {
        console.log('ℹ️ [OrderFlow] No se encontró orden pendiente de pago:', orderId);
        return { success: false, message: 'No se encontró orden pendiente de pago' };
      }

      // Procesar el archivo de comprobante de pago
      const proofResult = await this.processPaymentProofDocument(paymentProofFile, orderId);
      if (proofResult.success) {
        await this.updateOrderStatus(orderId, ORDER_STATUS.PAGADO);
        
        console.log('✅ [OrderFlow] Comprobante procesado y orden completada');
        return {
          success: true,
          orderId: orderId,
          newStatus: ORDER_STATUS.PAGADO,
          message: 'Comprobante de pago recibido, orden completada'
        };
      }

      return { success: false, errors: proofResult.errors || ['Error procesando comprobante'] };

    } catch (error) {
      console.error('❌ [OrderFlow] Error procesando comprobante de pago:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Error desconocido']
      };
    }
  }

  /**
   * 🔧 Métodos auxiliares
   */
  private async getProviderInfo(providerId: string): Promise<any | null> {
    try {
      const { data: provider, error } = await this.supabase
        .from('providers')
        .select('*')
        .eq('id', providerId)
        .single();

      if (error) {
        console.error('❌ [OrderFlow] Error obteniendo proveedor:', error);
        return null;
      }

      return provider;
    } catch (error) {
      console.error('❌ [OrderFlow] Error obteniendo proveedor:', error);
      return null;
    }
  }

  private async findOrderByProviderPhone(phone: string, status: string, userId?: string): Promise<any | null> {
    try {
      // Buscar órdenes por estado y usuario primero
      let query = this.supabase
        .from('orders')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(10);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: orders, error } = await query;

      if (error) {
        return null;
      }

      // Filtrar por teléfono del proveedor
      for (const order of orders || []) {
        const { data: provider } = await this.supabase
          .from('providers')
          .select('phone')
          .eq('id', order.provider_id)
          .single();
        
        if (provider?.phone === phone) {
          return order;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('orders')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('❌ [OrderFlow] Error actualizando estado:', error);
        throw error;
      }

      console.log('✅ [OrderFlow] Estado actualizado:', status);
    } catch (error) {
      console.error('❌ [OrderFlow] Error actualizando estado:', error);
      throw error;
    }
  }

  private async sendOrderNotification(phone: string, order: any, provider: any): Promise<{ success: boolean; errors?: string[] }> {
    try {
      console.log('📤 [OrderFlow] Iniciando envío de notificación:', {
        phone,
        providerName: provider.name,
        contactName: provider.contact_name,
        orderId: order.id
      });

      const templateVariables = {
        provider_name: provider.name || 'Proveedor',
        contact_name: provider.contact_name || provider.name || 'Contacto'
      };

      console.log('📤 [OrderFlow] Variables del template:', templateVariables);

      // 🚀 NUEVO: Llamar a la API del servidor para enviar el template
      const response = await fetch('/api/whatsapp/send-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phone,
          templateName: 'evio_orden',
          language: 'es_AR',
          variables: templateVariables
        }),
      });

      const result = await response.json();
      console.log('📤 [OrderFlow] Resultado del envío:', result);
      
      return { success: result.success };
    } catch (error) {
      console.error('❌ [OrderFlow] Error enviando notificación:', error);
      return { success: false, errors: [error instanceof Error ? error.message : 'Error enviando notificación'] };
    }
  }

  private async sendOrderDetails(phone: string, order: any): Promise<void> {
    try {
      const currentDate = new Date().toLocaleDateString('es-AR');
      const providerName = order.providers?.name || 'Proveedor';
      
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

      // Mover las notas al final si existen
      const notesSection = order.notes && order.notes.trim() 
        ? `\n\nNotas: ${order.notes}` 
        : '';
      
      const message = `🆔 Orden: ${order.order_number}
📅 Entrega: ${deliveryDate}
💳 Pago: ${order.payment_method || 'No especificado'}

📦 Items:
${items}
${notesSection}

Gracias. Aguardamos la factura.

Saludos!`;

      await metaWhatsAppService.sendMessage(phone, message, order.user_id);
    } catch (error) {
      console.error('❌ [OrderFlow] Error enviando detalles:', error);
    }
  }

  private async sendInvoiceRequest(phone: string, order: any): Promise<void> {
    try {
      const message = `📄 *SOLICITUD DE FACTURA*

Gracias por confirmar los detalles del pedido.

Por favor, envíe la factura correspondiente para proceder con el pago.

🆔 *Orden:* ${order.order_number}

Saludos!`;

      await metaWhatsAppService.sendMessage(phone, message, order.user_id);
    } catch (error) {
      console.error('❌ [OrderFlow] Error enviando solicitud de factura:', error);
    }
  }

  private async processInvoiceDocument(mediaData: any, orderId: string): Promise<{ success: boolean; errors?: string[] }> {
    try {
      // Aquí iría la lógica de procesamiento de facturas (OCR, validación, etc.)
      // Por ahora, simplemente marcamos como procesado
      console.log('📄 [OrderFlow] Procesando documento de factura para orden:', orderId);
      
      // TODO: Implementar procesamiento real de facturas
      // - Extraer datos con OCR
      // - Validar formato
      // - Guardar en storage
      // - Actualizar campos de factura en la orden
      
      return { success: true };
    } catch (error) {
      console.error('❌ [OrderFlow] Error procesando factura:', error);
      return { success: false, errors: [error instanceof Error ? error.message : 'Error procesando factura'] };
    }
  }

  private async processPaymentProofDocument(paymentProofFile: any, orderId: string): Promise<{ success: boolean; errors?: string[] }> {
    try {
      console.log('💳 [OrderFlow] Procesando comprobante de pago para orden:', orderId);
      
      // TODO: Implementar procesamiento real de comprobantes de pago
      // - Validar formato del archivo
      // - Guardar en storage
      // - Actualizar campo receipt_url en la orden
      
      return { success: true };
    } catch (error) {
      console.error('❌ [OrderFlow] Error procesando comprobante de pago:', error);
      return { success: false, errors: [error instanceof Error ? error.message : 'Error procesando comprobante'] };
    }
  }
}

// Exportar instancia singleton
export const orderFlowService = OrderFlowService.getInstance();
