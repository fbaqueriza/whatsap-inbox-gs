/**
 * 🔍 SERVICIO DE VALIDACIÓN DE FACTURAS
 * 
 * Este servicio valida facturas y detecta discrepancias
 * entre montos esperados y reales
 */

interface InvoiceValidationResult {
  isValid: boolean;
  discrepancies: string[];
  confidence: number;
  recommendations: string[];
}

interface OrderData {
  id: string;
  order_number: string;
  total_amount: number;
  provider_id: string;
  status: string;
}

interface ExtractedInvoiceData {
  totalAmount: number;
  invoiceNumber?: string;
  providerTaxId?: string;
  currency?: string;
  issueDate?: string;
  confidence: number;
}

export class InvoiceValidationService {
  private static instance: InvoiceValidationService;

  static getInstance(): InvoiceValidationService {
    if (!InvoiceValidationService.instance) {
      InvoiceValidationService.instance = new InvoiceValidationService();
    }
    return InvoiceValidationService.instance;
  }

  /**
   * 🔍 VALIDAR FACTURA CONTRA ORDEN
   */
  async validateInvoiceAgainstOrder(
    orderData: OrderData,
    extractedData: ExtractedInvoiceData,
    providerCuit?: string
  ): Promise<InvoiceValidationResult> {
    const discrepancies: string[] = [];
    const recommendations: string[] = [];
    let confidence = extractedData.confidence;

    console.log('🔍 Validando factura contra orden:', {
      orderNumber: orderData.order_number,
      orderAmount: orderData.total_amount,
      invoiceAmount: extractedData.totalAmount,
      confidence: extractedData.confidence
    });

    // 1. Validar monto
    const amountDifference = Math.abs(orderData.total_amount - extractedData.totalAmount);
    
    // 🔧 CORRECCIÓN: Si la orden tiene monto 0, aceptar cualquier monto de factura
    if (orderData.total_amount === 0) {
      console.log('✅ Orden con monto 0 - aceptando factura automáticamente');
      // No agregar discrepancias, la factura es válida
    } else if (amountDifference > 0) {
      const amountDifferencePercent = (amountDifference / orderData.total_amount) * 100;
      
      if (amountDifferencePercent > 10) {
        discrepancies.push(`Discrepancia significativa en monto: Orden $${orderData.total_amount} vs Factura $${extractedData.totalAmount} (${amountDifferencePercent.toFixed(1)}% diferencia)`);
        recommendations.push('Revisar manualmente la factura y confirmar con el proveedor');
        confidence -= 0.3;
      } else if (amountDifferencePercent > 5) {
        discrepancies.push(`Discrepancia moderada en monto: Orden $${orderData.total_amount} vs Factura $${extractedData.totalAmount} (${amountDifferencePercent.toFixed(1)}% diferencia)`);
        recommendations.push('Verificar si hay descuentos o recargos no contemplados');
        confidence -= 0.1;
      } else {
        discrepancies.push(`Diferencia menor en monto: Orden $${orderData.total_amount} vs Factura $${extractedData.totalAmount} (${amountDifferencePercent.toFixed(1)}% diferencia)`);
        recommendations.push('Diferencia aceptable, puede proceder');
      }
    }

    // 2. Validar CUIT si está disponible
    if (extractedData.providerTaxId && providerCuit) {
      const invoiceCuit = extractedData.providerTaxId.replace(/\D/g, '');
      const providerCuitClean = providerCuit.replace(/\D/g, '');
      
      if (invoiceCuit !== providerCuitClean) {
        discrepancies.push(`CUIT no coincide: Factura ${invoiceCuit} vs Proveedor ${providerCuitClean}`);
        recommendations.push('Verificar que la factura corresponda al proveedor correcto');
        confidence -= 0.5;
      }
    }

    // 3. Validar confianza de extracción
    if (extractedData.confidence < 0.7) {
      discrepancies.push(`Baja confianza en extracción de datos: ${(extractedData.confidence * 100).toFixed(1)}%`);
      recommendations.push('Revisar manualmente los datos extraídos de la factura');
      confidence -= 0.2;
    }

    // 4. Validar número de factura
    if (!extractedData.invoiceNumber) {
      discrepancies.push('No se pudo extraer el número de factura');
      recommendations.push('Verificar que la factura tenga un número visible y legible');
      confidence -= 0.1;
    }

    // 5. Validar moneda
    if (extractedData.currency && extractedData.currency !== 'ARS') {
      discrepancies.push(`Moneda inesperada: ${extractedData.currency} (esperado: ARS)`);
      recommendations.push('Verificar si la factura está en la moneda correcta');
      confidence -= 0.1;
    }

    const isValid = discrepancies.length === 0 || discrepancies.every(d => 
      d.includes('Diferencia menor') || d.includes('Diferencia aceptable')
    );

    return {
      isValid,
      discrepancies,
      confidence: Math.max(0, confidence),
      recommendations
    };
  }

  /**
   * 📧 ENVIAR NOTIFICACIÓN DE DISCREPANCIA
   */
  async notifyDiscrepancy(
    userId: string,
    orderId: string,
    orderNumber: string,
    discrepancies: string[],
    recommendations: string[]
  ): Promise<void> {
    try {
      console.log('📧 Enviando notificación de discrepancia:', {
        userId,
        orderNumber,
        discrepancyCount: discrepancies.length
      });

      // Aquí se podría integrar con un servicio de notificaciones
      // Por ejemplo, enviar email, push notification, etc.
      
      // Por ahora, solo loggeamos
      console.log('🚨 DISCREPANCIA DETECTADA:', {
        orderNumber,
        discrepancies,
        recommendations
      });

      // TODO: Implementar notificación real (email, WhatsApp, etc.)
      
    } catch (error) {
      console.error('❌ Error enviando notificación de discrepancia:', error);
    }
  }

  /**
   * 🔍 VALIDAR Y PROCESAR FACTURA COMPLETA
   */
  async validateAndProcessInvoice(
    orderData: OrderData,
    extractedData: ExtractedInvoiceData,
    providerCuit?: string,
    userId?: string
  ): Promise<{
    isValid: boolean;
    shouldProceed: boolean;
    validationResult: InvoiceValidationResult;
  }> {
    const validationResult = await this.validateInvoiceAgainstOrder(
      orderData,
      extractedData,
      providerCuit
    );

    const shouldProceed = validationResult.isValid || 
      validationResult.discrepancies.every(d => 
        d.includes('Diferencia menor') || d.includes('Diferencia aceptable')
      );

    // Si hay discrepancias significativas, enviar notificación
    if (!validationResult.isValid && userId) {
      await this.notifyDiscrepancy(
        userId,
        orderData.id,
        orderData.order_number,
        validationResult.discrepancies,
        validationResult.recommendations
      );
    }

    return {
      isValid: validationResult.isValid,
      shouldProceed,
      validationResult
    };
  }
}

export const invoiceValidationService = InvoiceValidationService.getInstance();
