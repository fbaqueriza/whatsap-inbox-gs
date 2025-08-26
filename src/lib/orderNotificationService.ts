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
  static async sendOrderNotification(data: { order: Order; provider: Provider; items: OrderItem[] }): Promise<boolean> {
    try {
      const { order, provider, items } = data;
      
      // Validar formato de teléfono - DEBE ser +54XXXXXXXXXX
      const phoneRegex = /^\+54\d{9,11}$/;
      if (!phoneRegex.test(provider.phone)) {
        console.error('❌ Formato de teléfono inválido:', provider.phone);
        console.error('❌ Debe ser: +54XXXXXXXXXX (ej: +5491135562673)');
        return false;
      }
      const normalizedPhone = provider.phone; // Ya está en formato correcto

      // PASO 1: Enviar template real de Meta
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : (process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001');
      const triggerResponse = await fetch(`${baseUrl}/api/whatsapp/trigger-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: normalizedPhone,
          template_name: 'envio_de_orden'
        }),
      });

      const triggerResult = await triggerResponse.json();
      
      if (!triggerResponse.ok) {
        console.error('❌ Error disparando conversación de Meta:', triggerResult);
        return false;
      }

      // PASO 2: Guardar el pedido en estado "pendiente de confirmación"
      await this.savePendingOrder(order, provider, items);

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
      // Validar formato de teléfono - DEBE ser +54XXXXXXXXXX
      const phoneRegex = /^\+54\d{9,11}$/;
      if (!phoneRegex.test(provider.phone)) {
        console.error('❌ Formato de teléfono inválido en savePendingOrder:', provider.phone);
        console.error('❌ Debe ser: +54XXXXXXXXXX (ej: +5491135562673)');
        return;
      }
      
      // Guardar en Supabase en lugar de localStorage
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : (process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001');
      
      const response = await fetch(`${baseUrl}/api/whatsapp/save-pending-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.id,
          providerId: provider.id,
          providerPhone: provider.phone, // Usar el número del proveedor
          orderData: {
            order,
            provider,
            items
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Pedido guardado en estado pendiente de confirmación:', result);
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
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : (process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001');
      
      const response = await fetch(`${baseUrl}/api/whatsapp/get-pending-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerPhone }),
      });

      if (!response.ok) {
        console.log('❌ No se encontró pedido pendiente para:', providerPhone);
        const errorData = await response.json();
        console.log('❌ Detalles del error:', errorData);
        return false;
      }

      const pendingOrder = await response.json();
      const { order, provider, items } = pendingOrder.orderData;
      const orderMessage = this.createOrderMessage(order, provider, items);

      // Validar formato de teléfono - DEBE ser +54XXXXXXXXXX
      const phoneRegex = /^\+54\d{9,11}$/;
      if (!phoneRegex.test(providerPhone)) {
        console.error('❌ Formato de teléfono inválido:', providerPhone);
        console.error('❌ Debe ser: +54XXXXXXXXXX (ej: +5491135562673)');
        return false;
      }
      const normalizedPhone = providerPhone; // Ya está en formato correcto

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
        const removeResponse = await fetch(`${baseUrl}/api/whatsapp/remove-pending-order`, {
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
      // Validar formato de teléfono - DEBE ser +54XXXXXXXXXX
      const phoneRegex = /^\+54\d{9,11}$/;
      if (!phoneRegex.test(provider.phone)) {
        console.error('❌ Formato de teléfono inválido:', provider.phone);
        console.error('❌ Debe ser: +54XXXXXXXXXX (ej: +5491135562673)');
        return false;
      }
      const normalizedPhone = provider.phone; // Ya está en formato correcto

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
