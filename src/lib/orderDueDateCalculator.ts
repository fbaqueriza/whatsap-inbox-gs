/**
 * Calculadora de fecha de vencimiento de órdenes
 * Basada en el plazo de pago del proveedor
 */

/**
 * Calcula la fecha de vencimiento de una orden basada en el plazo de pago del proveedor
 * @param providerPaymentTermDays Plazo de pago del proveedor en días (opcional)
 * @param baseDate Fecha base para calcular (por defecto: fecha actual)
 * @param invoiceDate Fecha de la factura (opcional, si existe se usa como base)
 * @returns Fecha de vencimiento calculada
 */
export function calculateOrderDueDate(
  providerPaymentTermDays?: number | null,
  baseDate?: Date,
  invoiceDate?: Date | string | null
): Date {
  // Usar fecha de factura como base si está disponible, sino usar fecha base o fecha actual
  const referenceDate = invoiceDate 
    ? (typeof invoiceDate === 'string' ? new Date(invoiceDate) : invoiceDate)
    : (baseDate || new Date());

  // Plazo de pago por defecto: 30 días
  const paymentTermDays = providerPaymentTermDays || 30;

  // Calcular fecha de vencimiento
  const dueDate = new Date(referenceDate);
  dueDate.setDate(dueDate.getDate() + paymentTermDays);

  return dueDate;
}

/**
 * Calcula la fecha de vencimiento desde la fecha de entrega deseada
 * @param deliveryDate Fecha de entrega deseada
 * @param providerPaymentTermDays Plazo de pago del proveedor en días
 * @returns Fecha de vencimiento calculada
 */
export function calculateDueDateFromDelivery(
  deliveryDate: Date | string,
  providerPaymentTermDays?: number | null
): Date {
  const delivery = typeof deliveryDate === 'string' ? new Date(deliveryDate) : deliveryDate;
  const paymentTermDays = providerPaymentTermDays || 30;
  
  const dueDate = new Date(delivery);
  dueDate.setDate(dueDate.getDate() + paymentTermDays);
  
  return dueDate;
}

