import { Order, OrderItem, Provider } from '../types';

interface OrderNotificationData {
  order: Order;
  provider: Provider;
  items: OrderItem[];
}

export class OrderNotificationService {
  /**
   * Envía notificación automática de nuevo pedido al proveedor
   * NUEVO FLUJO: Solo envía el disparador y espera confirmación
   */
  static async sendOrderNotification(data: OrderNotificationData): Promise<boolean> {
    try {
      const { order, provider, items } = data;
      
      // Normalizar el número de teléfono del proveedor - CONSISTENTE
      let normalizedPhone = provider.phone.replace(/[\s\-\(\)]/g, '');
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = `+${normalizedPhone}`;
      }

      // console.log('📦 Iniciando envío de pedido a:', provider.name);
      // console.log('📱 Número normalizado:', normalizedPhone);

      // PASO 1: Enviar mensaje personalizado de disparador
      // console.log('🔗 Enviando mensaje personalizado de disparador...');
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      const triggerResponse = await fetch(`${baseUrl}/api/whatsapp/trigger-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: normalizedPhone,
          message: 'Buenas! Espero que andes bien!\n¿Puedo hacerte un pedido?'
        }),
      });

      const triggerResult = await triggerResponse.json();
      // console.log('📋 Resultado del trigger:', triggerResult);
      
      if (!triggerResponse.ok) {
        console.error('❌ Error disparando conversación de Meta:', triggerResult);
        return false;
      }

      // console.log('✅ Conversación de Meta disparada exitosamente con template');
      // console.log('⏳ Esperando respuesta del proveedor antes de enviar detalles completos...');

      // PASO 2: Guardar el pedido en estado "pendiente de confirmación"
      console.log('💾 Guardando pedido pendiente para:', normalizedPhone);
      await this.savePendingOrder(order, provider, items);
      console.log('✅ Pedido pendiente guardado exitosamente');

      return true;

    } catch (error) {
      console.error('❌ Error en sendOrderNotification:', error);
      return false;
    }
  }

  /**
   * Guarda el pedido en estado pendiente de confirmación
   */
  private static async savePendingOrder(order: Order, provider: Provider, items: OrderItem[]): Promise<void> {
    try {
      // Guardar en Supabase en lugar de localStorage
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/whatsapp/save-pending-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.id,
          providerId: provider.id,
          providerPhone: normalizedPhone, // Usar el número normalizado
          orderData: {
            order,
            provider,
            items
          }
        }),
      });

      if (response.ok) {
        console.log('💾 Pedido guardado en estado pendiente de confirmación');
      } else {
        console.error('❌ Error guardando pedido pendiente en BD');
        const errorData = await response.json();
        console.error('❌ Detalles del error:', errorData);
      }
    } catch (error) {
      console.error('❌ Error guardando pedido pendiente:', error);
    }
  }

  /**
   * Envía los detalles completos del pedido después de recibir confirmación
   */
  static async sendOrderDetailsAfterConfirmation(providerPhone: string): Promise<boolean> {
    try {
      // Buscar el pedido pendiente para este proveedor usando la API
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/whatsapp/get-pending-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerPhone }),
      });

      if (!response.ok) {
        console.log('❌ No se encontró pedido pendiente para:', providerPhone);
        return false;
      }

      const pendingOrder = await response.json();
      const { order, provider, items } = pendingOrder.orderData;
      const orderMessage = this.createOrderMessage(order, provider, items);

      // Normalizar el número de teléfono - CONSISTENTE
      let normalizedPhone = providerPhone.replace(/[\s\-\(\)]/g, '');
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = `+${normalizedPhone}`;
      }

      console.log('📝 Enviando detalles completos del pedido después de confirmación...');
      
      const messageResponse = await fetch(`${baseUrl}/api/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: normalizedPhone,
          message: orderMessage
        }),
      });

      const messageResult = await messageResponse.json();
      
      if (messageResponse.ok) {
        console.log('✅ Detalles del pedido enviados exitosamente después de confirmación');
        
        // Remover el pedido de la lista de pendientes
        await fetch(`${baseUrl}/api/whatsapp/remove-pending-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ providerPhone }),
        });
        
        return true;
      } else {
        console.error('❌ Error enviando detalles del pedido:', messageResult);
        return false;
      }

    } catch (error) {
      console.error('❌ Error en sendOrderDetailsAfterConfirmation:', error);
      return false;
    }
  }

  /**
   * Crea el mensaje formateado del pedido
   */
  private static createOrderMessage(order: Order, provider: Provider, items: OrderItem[]): string {
    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
    const itemsList = items.map(item => 
      `• ${item.productName}: ${item.quantity} ${item.unit} - $${item.total}`
    ).join('\n');

    let message = `🛒 *NUEVO PEDIDO*\n\n`;
    message += `*Proveedor:* ${provider.name}\n`;
    message += `*Fecha:* ${new Date().toLocaleDateString('es-AR')}\n`;
    message += `*Total:* $${totalAmount.toLocaleString()}\n\n`;
    message += `*Productos:*\n${itemsList}`;

    if (order.desiredDeliveryDate) {
      message += `\n\n*Fecha de entrega deseada:* ${new Date(order.desiredDeliveryDate).toLocaleDateString('es-AR')}`;
    }

    if (order.paymentMethod) {
      message += `\n*Método de pago:* ${order.paymentMethod}`;
    }

    if (order.notes) {
      message += `\n\n*Notas:* ${order.notes}`;
    }

    message += `\n\n_Por favor confirma la recepción de este pedido._`;

    return message;
  }

  /**
   * Envía notificación de actualización de estado del pedido
   */
  static async sendOrderStatusUpdate(
    order: Order, 
    provider: Provider, 
    status: string
  ): Promise<boolean> {
    try {
      let normalizedPhone = provider.phone.replace(/[\s\-\(\)]/g, '');
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = `+${normalizedPhone}`;
      }

      const statusMessages = {
        'enviado': '📤 *PEDIDO ENVIADO*\n\nTu pedido ha sido enviado al proveedor.',
        'factura_recibida': '📄 *FACTURA RECIBIDA*\n\nEl proveedor ha enviado la factura.',
        'pagado': '💳 *PEDIDO PAGADO*\n\nEl pago ha sido confirmado.',
        'finalizado': '✅ *PEDIDO FINALIZADO*\n\nEl pedido ha sido completado exitosamente.',
        'cancelled': '❌ *PEDIDO CANCELADO*\n\nEl pedido ha sido cancelado.'
      };

      const statusMessage = statusMessages[status as keyof typeof statusMessages] || 
        `📋 *ACTUALIZACIÓN DE PEDIDO*\n\nEstado actualizado a: ${status}`;

      const message = `${statusMessage}\n\n*Pedido:* ${order.orderNumber || 'N/A'}\n*Proveedor:* ${provider.name}`;

      const response = await fetch('/api/whatsapp/trigger-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: normalizedPhone,
          message: message
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Error enviando actualización de estado:', result);
        return false;
      }

      console.log('✅ Actualización de estado enviada exitosamente');
      return true;

    } catch (error) {
      console.error('❌ Error en sendOrderStatusUpdate:', error);
      return false;
    }
  }
}
