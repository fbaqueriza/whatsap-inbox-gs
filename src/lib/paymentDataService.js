/**
 * 💳 SERVICIO DE GENERACIÓN DE DATOS DE PAGO
 * 
 * Genera datos de pago usando el monto real de la factura extraída
 * y la información bancaria del proveedor
 */

const { createClient } = require('@supabase/supabase-js');

class PaymentDataService {
  constructor() {
    if (PaymentDataService.instance) {
      return PaymentDataService.instance;
    }
    PaymentDataService.instance = this;
  }

  static getInstance() {
    if (!PaymentDataService.instance) {
      PaymentDataService.instance = new PaymentDataService();
    }
    return PaymentDataService.instance;
  }

  /**
   * 💳 GENERAR DATOS DE PAGO PARA UNA ORDEN
   * 
   * @param {string} orderId - ID de la orden
   * @param {string} userId - ID del usuario
   * @param {Object} supabaseClient - Cliente de Supabase ya configurado
   * @returns {Promise<Object>} Datos de pago generados
   */
  async generatePaymentData(orderId, userId, supabaseClient) {
    try {
      console.log('💳 [PaymentDataService] Generando datos de pago para orden:', orderId);

      // Usar cliente Supabase proporcionado
      const supabase = supabaseClient;

      // 1. Obtener la orden con datos de factura extraídos
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          currency,
          invoice_total,
          invoice_currency,
          invoice_data,
          invoice_number,
          provider_id,
          status,
          payment_method
        `)
        .eq('id', orderId)
        .eq('user_id', userId)
        .single();

      if (orderError || !order) {
        throw new Error(`Orden no encontrada: ${orderError?.message || 'No encontrada'}`);
      }

      console.log('💳 [PaymentDataService] Orden encontrada:', {
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        invoiceTotal: order.invoice_total,
        status: order.status
      });

      // 2. Obtener datos del proveedor
      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select(`
          id,
          name,
          cbu,
          alias,
          cuit_cuil,
          razon_social,
          default_payment_method
        `)
        .eq('id', order.provider_id)
        .eq('user_id', userId)
        .single();

      if (providerError || !provider) {
        throw new Error(`Proveedor no encontrado: ${providerError?.message || 'No encontrado'}`);
      }

      console.log('💳 [PaymentDataService] Proveedor encontrado:', {
        name: provider.name,
        hasCBU: !!provider.cbu,
        hasAlias: !!provider.alias,
        cuitCuil: provider.cuit_cuil
      });

      // 3. Determinar el monto a pagar (priorizar monto de factura si está disponible)
      const amountToPay = order.invoice_total || order.total_amount;
      const currency = order.invoice_currency || order.currency || 'ARS';

      // 4. Determinar método de pago
      const paymentMethod = order.payment_method || provider.default_payment_method || 'transferencia';

      // 5. Generar datos de pago
      const paymentData = {
        orderId: order.id,
        orderNumber: order.order_number,
        providerName: provider.name,
        amount: amountToPay,
        currency: currency,
        paymentMethod: paymentMethod,
        invoiceNumber: order.invoice_number,
        
        // Información bancaria del proveedor
        bankInfo: {
          cbu: provider.cbu,
          alias: provider.alias,
          cuitCuil: provider.cuit_cuil,
          razonSocial: provider.razon_social
        },

        // Datos extraídos de la factura
        invoiceData: order.invoice_data,
        
        // Información adicional
        status: order.status,
        generatedAt: new Date().toISOString(),
        
        // Mensaje de pago formateado
        paymentMessage: this.generatePaymentMessage({
          providerName: provider.name,
          amount: amountToPay,
          currency: currency,
          cbu: provider.cbu,
          alias: provider.alias,
          invoiceNumber: order.invoice_number,
          paymentMethod: paymentMethod
        })
      };

      console.log('✅ [PaymentDataService] Datos de pago generados:', {
        amount: paymentData.amount,
        currency: paymentData.currency,
        paymentMethod: paymentData.paymentMethod,
        hasBankInfo: !!(paymentData.bankInfo.cbu || paymentData.bankInfo.alias)
      });

      return {
        success: true,
        data: paymentData
      };

    } catch (error) {
      console.error('❌ [PaymentDataService] Error generando datos de pago:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 📝 GENERAR MENSAJE DE PAGO FORMATEADO
   */
  generatePaymentMessage({ providerName, amount, currency, cbu, alias, invoiceNumber, paymentMethod }) {
    const formattedAmount = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'ARS',
      minimumFractionDigits: 2
    }).format(amount);

    let message = `💳 **DATOS DE PAGO**\n\n`;
    message += `📋 **Proveedor:** ${providerName}\n`;
    message += `💰 **Monto:** ${formattedAmount}\n`;
    
    if (invoiceNumber) {
      message += `📄 **Factura:** ${invoiceNumber}\n`;
    }
    
    message += `💳 **Método:** ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}\n\n`;

    if (paymentMethod === 'transferencia') {
      if (alias) {
        message += `🏦 **Alias:** ${alias}\n`;
      }
      if (cbu) {
        message += `🏦 **CBU:** ${cbu}\n`;
      }
    }

    message += `\n✅ Una vez realizado el pago, sube el comprobante para completar la transacción.`;

    return message;
  }

  /**
   * 🔄 ACTUALIZAR ORDEN CON DATOS DE PAGO GENERADOS
   */
  async updateOrderWithPaymentData(orderId, userId, paymentData, supabaseClient) {
    try {
      const supabase = supabaseClient;

      const updateData = {
        // Actualizar monto con el monto real de la factura si es diferente
        total_amount: paymentData.amount,
        currency: paymentData.currency,
        
        // Actualizar timestamp
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Error actualizando orden: ${error.message}`);
      }

      console.log('✅ [PaymentDataService] Orden actualizada con datos de pago');
      return { success: true };

    } catch (error) {
      console.error('❌ [PaymentDataService] Error actualizando orden:', error);
      return { success: false, error: error.message };
    }
  }
}

// Exportar instancia singleton
const paymentDataService = PaymentDataService.getInstance();

module.exports = {
  paymentDataService
};
