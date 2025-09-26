import { Order, Provider } from '@/types';

/**
 * Mapea una orden desde la base de datos al formato del frontend
 */
export function mapOrderFromDb(order: any): Order {
  return {
    ...order,
    providerId: order.provider_id,
    // Preservar información del proveedor del endpoint
    provider: order.providers ? {
      id: order.providers.id,
      name: order.providers.name,
      phone: order.providers.phone,
      email: order.providers.email || '',
      contactName: order.providers.contact_name || '',
      notes: order.providers.notes || '',
      user_id: order.providers.user_id || order.user_id,
      createdAt: order.providers.created_at ? new Date(order.providers.created_at) : new Date(),
      updatedAt: order.providers.updated_at ? new Date(order.providers.updated_at) : new Date()
    } : undefined,
    orderNumber: order.order_number, // Usar el valor real de la base de datos
    totalAmount: order.total_amount || 0,
    orderDate: order.order_date ? new Date(order.order_date) : new Date(),
    dueDate: order.due_date ? new Date(order.due_date) : undefined,
    invoiceNumber: order.invoice_number,
    bankInfo: order.bank_info,
    receiptUrl: order.receipt_url,
    // Usar estado directo de la BD (ya está normalizado)
    status: order.status,
    // Nuevas columnas nativas: Mapear directamente desde la BD
    desiredDeliveryDate: order.desired_delivery_date ? new Date(order.desired_delivery_date) : undefined,
    desiredDeliveryTime: order.desired_delivery_time || undefined,
    paymentMethod: (order.payment_method as 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque') || 'efectivo',
    additionalFiles: order.additional_files || undefined,
    createdAt: order.created_at ? new Date(order.created_at) : new Date(),
    updatedAt: order.updated_at ? new Date(order.updated_at) : new Date(),
    id: order.id,
    user_id: order.user_id,
  };
}
