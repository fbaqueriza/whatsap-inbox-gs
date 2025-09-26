import { createClient } from '@supabase/supabase-js';

// Solo usar en el servidor - no importar en componentes del frontend
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PaymentReceiptData {
  id?: string;
  user_id: string;
  provider_id?: string;
  order_id?: string;
  filename: string;
  file_url: string;
  file_size?: number;
  file_type: 'transferencia' | 'cheque' | 'efectivo' | 'tarjeta' | 'other';
  mime_type?: string;
  receipt_number?: string;
  payment_amount?: number;
  payment_currency?: string;
  payment_date?: string;
  payment_method?: 'transferencia' | 'cheque' | 'efectivo' | 'tarjeta' | 'other';
  auto_assigned_provider_id?: string;
  auto_assigned_order_id?: string;
  assignment_confidence?: number;
  assignment_method?: 'cuit_match' | 'amount_match' | 'provider_match' | 'manual';
  sent_to_provider?: boolean;
  sent_at?: string;
  whatsapp_message_id?: string;
  status: 'pending' | 'processed' | 'assigned' | 'sent' | 'error';
  processing_error?: string;
  created_at?: string;
  updated_at?: string;
  processed_at?: string;
}

export interface ProviderMatchResult {
  provider_id: string;
  provider_name: string;
  confidence: number;
  match_method: 'cuit_match' | 'amount_match' | 'provider_match';
  match_details: any;
}

export interface OrderMatchResult {
  order_id: string;
  order_number: string;
  confidence: number;
  match_method: 'amount_match' | 'provider_match';
  match_details: any;
}

export class PaymentReceiptService {
  /**
   * Subir comprobante de pago y procesarlo
   */
  static async uploadPaymentReceipt(
    file: File,
    userId: string,
    metadata?: {
      payment_amount?: number;
      payment_date?: string;
      payment_method?: string;
      receipt_number?: string;
    }
  ): Promise<{ success: boolean; receipt?: PaymentReceiptData; error?: string }> {
    try {
      console.log('📄 [PaymentReceiptService] Iniciando subida de comprobante de pago');
      
      // 1. Generar nombre de archivo descriptivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileExtension = file.name.split('.').pop();
      const descriptiveFilename = `Comprobante_${timestamp}.${fileExtension}`;
      
      // 2. Subir archivo a Supabase Storage
      const filePath = `payment-receipts/${userId}/${descriptiveFilename}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
      
      if (uploadError) {
        console.error('❌ [PaymentReceiptService] Error subiendo archivo:', uploadError);
        return { success: false, error: 'Error subiendo archivo' };
      }
      
      // 3. Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);
      
      // 4. Crear registro en base de datos
      const receiptData: Partial<PaymentReceiptData> = {
        user_id: userId,
        filename: descriptiveFilename,
        file_url: urlData.publicUrl,
        file_size: file.size,
        file_type: this.inferFileType(file.name, file.type),
        mime_type: file.type,
        receipt_number: metadata?.receipt_number,
        payment_amount: metadata?.payment_amount,
        payment_currency: 'ARS',
        payment_date: metadata?.payment_date,
        payment_method: metadata?.payment_method as any,
        status: 'pending'
      };
      
      const { data: receipt, error: dbError } = await supabase
        .from('payment_receipts')
        .insert(receiptData)
        .select()
        .single();
      
      if (dbError) {
        console.error('❌ [PaymentReceiptService] Error creando registro:', dbError);
        return { success: false, error: 'Error creando registro' };
      }
      
      console.log('✅ [PaymentReceiptService] Comprobante subido exitosamente:', receipt.id);
      
      return { success: true, receipt };
      
    } catch (error) {
      console.error('❌ [PaymentReceiptService] Error general:', error);
      return { success: false, error: 'Error interno del servidor' };
    }
  }
  
  /**
   * Procesar comprobante de pago (OCR y asignación automática)
   */
  static async processPaymentReceipt(receiptId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔄 [PaymentReceiptService] Procesando comprobante:', receiptId);
      
      // 1. Obtener datos del comprobante
      const { data: receipt, error: fetchError } = await supabase
        .from('payment_receipts')
        .select('*')
        .eq('id', receiptId)
        .single();
      
      if (fetchError || !receipt) {
        console.error('❌ [PaymentReceiptService] Error obteniendo comprobante:', fetchError);
        return { success: false, error: 'Comprobante no encontrado' };
      }
      
      // 2. Actualizar estado a processing
      await supabase
        .from('payment_receipts')
        .update({ status: 'processed' })
        .eq('id', receiptId);
      
      // 3. Intentar asignación automática a proveedores
      const providerMatches = await this.findMatchingProviders(receipt);
      console.log('🔍 [PaymentReceiptService] Proveedores encontrados:', providerMatches.length);
      
      // 4. Intentar asignación automática a órdenes
      const orderMatches = await this.findMatchingOrders(receipt, providerMatches);
      console.log('🔍 [PaymentReceiptService] Órdenes encontradas:', orderMatches.length);
      
      // 5. Actualizar comprobante con asignaciones
      const bestProviderMatch = providerMatches[0];
      const bestOrderMatch = orderMatches[0];
      
      const updateData: Partial<PaymentReceiptData> = {
        processed_at: new Date().toISOString()
      };
      
      // Solo marcar como 'assigned' si realmente se encontraron coincidencias
      if (bestProviderMatch || bestOrderMatch) {
        updateData.status = 'assigned';
        
        if (bestProviderMatch) {
          updateData.auto_assigned_provider_id = bestProviderMatch.provider_id;
          updateData.assignment_confidence = bestProviderMatch.confidence;
          updateData.assignment_method = bestProviderMatch.match_method;
          console.log('✅ [PaymentReceiptService] Proveedor asignado:', bestProviderMatch.provider_name);
        }
        
        if (bestOrderMatch) {
          updateData.auto_assigned_order_id = bestOrderMatch.order_id;
          console.log('✅ [PaymentReceiptService] Orden asignada:', bestOrderMatch.order_number);
        }
      } else {
        // Si no se encontraron coincidencias, marcar como 'processed' pero no 'assigned'
        updateData.status = 'processed';
        console.log('⚠️ [PaymentReceiptService] No se encontraron coincidencias, comprobante marcado como procesado');
      }
      
      await supabase
        .from('payment_receipts')
        .update(updateData)
        .eq('id', receiptId);
      
      // 6. Registrar intentos de asignación
      await this.recordAssignmentAttempts(receiptId, providerMatches, orderMatches);
      
      // 7. Crear registro en tabla documents para que aparezca en carpeta de proveedores
      if (bestProviderMatch) {
        await this.createDocumentRecord(receipt, bestProviderMatch.provider_id, bestOrderMatch?.order_id);
      }
      
      // 8. 🔧 NUEVO: Actualizar estado de la orden a 'pagado' si se asignó exitosamente
      if (bestOrderMatch && bestOrderMatch.confidence > 0.7) {
        console.log('🔄 [PaymentReceiptService] Actualizando orden a estado "pagado":', bestOrderMatch.order_id);
        
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ 
            status: 'pagado',
            updated_at: new Date().toISOString()
          })
          .eq('id', bestOrderMatch.order_id);
        
        if (orderUpdateError) {
          console.error('❌ [PaymentReceiptService] Error actualizando orden a pagado:', orderUpdateError);
        } else {
          console.log('✅ [PaymentReceiptService] Orden actualizada a "pagado" exitosamente');
        }
      }
      
      console.log('✅ [PaymentReceiptService] Comprobante procesado exitosamente');
      return { success: true };
      
    } catch (error) {
      console.error('❌ [PaymentReceiptService] Error procesando comprobante:', error);
      
      // Actualizar estado a error
      await supabase
        .from('payment_receipts')
        .update({ 
          status: 'error',
          processing_error: error instanceof Error ? error.message : 'Error desconocido'
        })
        .eq('id', receiptId);
      
      return { success: false, error: 'Error procesando comprobante' };
    }
  }
  
  /**
   * Buscar proveedores que coincidan con el comprobante
   */
  static async findMatchingProviders(receipt: PaymentReceiptData): Promise<ProviderMatchResult[]> {
    try {
      const matches: ProviderMatchResult[] = [];
      
      // Obtener todos los proveedores del usuario
      const { data: providers, error } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', receipt.user_id);
      
      if (error || !providers) {
        console.error('❌ [PaymentReceiptService] Error obteniendo proveedores:', error);
        return matches;
      }
      
      console.log('🔍 [PaymentReceiptService] Proveedores encontrados en BD:', providers.length);
      console.log('🔍 [PaymentReceiptService] Datos del comprobante:', {
        receipt_number: receipt.receipt_number,
        payment_amount: receipt.payment_amount,
        user_id: receipt.user_id
      });
      
      // Buscar coincidencias por nombre del proveedor en el comprobante
      if (receipt.receipt_number) {
        for (const provider of providers) {
          // Buscar nombre del proveedor en el número de comprobante o en datos del proveedor
          if (provider.name && receipt.receipt_number.toLowerCase().includes(provider.name.toLowerCase())) {
            matches.push({
              provider_id: provider.id,
              provider_name: provider.name,
              confidence: 0.8,
              match_method: 'provider_match',
              match_details: { provider_name: provider.name, receipt_number: receipt.receipt_number }
            });
          }
        }
      }
      
      // Si no se encontraron coincidencias por nombre, buscar por órdenes recientes
      if (matches.length === 0) {
        console.log('🔍 [PaymentReceiptService] No se encontraron coincidencias por nombre, buscando por órdenes recientes...');
        
        // Buscar órdenes recientes del usuario (últimos 30 días)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: recentOrders, error: recentError } = await supabase
          .from('orders')
          .select('*, providers(*)')
          .eq('user_id', receipt.user_id)
          .in('status', ['pendiente_de_pago', 'enviado'])
          .gte('created_at', thirtyDaysAgo.toISOString());
        
        if (!recentError && recentOrders) {
          console.log('✅ [PaymentReceiptService] Órdenes recientes encontradas:', recentOrders.length);
          
          // Agregar proveedores de órdenes recientes como candidatos
          for (const order of recentOrders) {
            const provider = order.providers;
            if (provider && !matches.find(m => m.provider_id === provider.id)) {
              matches.push({
                provider_id: provider.id,
                provider_name: provider.name,
                confidence: 0.5, // Menor confianza para coincidencias por órdenes recientes
                match_method: 'provider_match',
                match_details: { 
                  provider_name: provider.name, 
                  order_id: order.id,
                  order_number: order.order_number,
                  match_reason: 'recent_order'
                }
              });
            }
          }
        }
      }
      
      // Buscar coincidencias por monto (si hay órdenes pendientes de pago)
      if (receipt.payment_amount) {
        console.log('🔍 [PaymentReceiptService] Buscando órdenes con monto:', receipt.payment_amount);
        
        // Buscar órdenes con monto exacto o similar (tolerancia de 1 peso)
        const { data: exactOrders, error: exactError } = await supabase
          .from('orders')
          .select('*, providers(*)')
          .eq('user_id', receipt.user_id)
          .in('status', ['pendiente_de_pago', 'enviado'])
          .gte('total_amount', receipt.payment_amount - 1)
          .lte('total_amount', receipt.payment_amount + 1);
        
        if (!exactError && exactOrders) {
          console.log('✅ [PaymentReceiptService] Órdenes con monto exacto encontradas:', exactOrders.length);
          for (const order of exactOrders) {
            const provider = order.providers;
            if (provider && !matches.find(m => m.provider_id === provider.id)) {
              matches.push({
                provider_id: provider.id,
                provider_name: provider.name,
                confidence: 0.9,
                match_method: 'amount_match',
                match_details: { 
                  amount: receipt.payment_amount, 
                  order_id: order.id,
                  order_number: order.order_number
                }
              });
            }
          }
        }
        
        // Si no hay coincidencias exactas, buscar órdenes con montos similares (±1 peso de tolerancia)
        if (matches.length === 0) {
          const tolerance = 1; // 1 peso de tolerancia para diferencias de centavos
          const minAmount = receipt.payment_amount - tolerance;
          const maxAmount = receipt.payment_amount + tolerance;
          
          console.log('🔍 [PaymentReceiptService] Buscando órdenes con monto similar (tolerancia ±1):', minAmount, '-', maxAmount);
          
          const { data: similarOrders, error: similarError } = await supabase
            .from('orders')
            .select('*, providers(*)')
            .eq('user_id', receipt.user_id)
            .in('status', ['pendiente_de_pago', 'enviado'])
            .gte('total_amount', minAmount)
            .lte('total_amount', maxAmount);
          
          if (!similarError && similarOrders) {
            console.log('✅ [PaymentReceiptService] Órdenes con monto similar encontradas:', similarOrders.length);
            for (const order of similarOrders) {
              const provider = order.providers;
              if (provider && !matches.find(m => m.provider_id === provider.id)) {
                const difference = Math.abs(order.total_amount - receipt.payment_amount);
                const confidence = Math.max(0.8, 0.9 - (difference / receipt.payment_amount));
                
                matches.push({
                  provider_id: provider.id,
                  provider_name: provider.name,
                  confidence: confidence,
                  match_method: 'amount_match',
                  match_details: { 
                    amount: receipt.payment_amount, 
                    order_amount: order.total_amount,
                    difference: difference,
                    order_id: order.id,
                    order_number: order.order_number
                  }
                });
              }
            }
          }
        }
        
      }
      
      // Ordenar por confianza
      return matches.sort((a, b) => b.confidence - a.confidence);
      
    } catch (error) {
      console.error('❌ [PaymentReceiptService] Error buscando proveedores:', error);
      return [];
    }
  }
  
  /**
   * Buscar órdenes que coincidan con el comprobante
   */
  static async findMatchingOrders(
    receipt: PaymentReceiptData, 
    providerMatches: ProviderMatchResult[]
  ): Promise<OrderMatchResult[]> {
    try {
      const matches: OrderMatchResult[] = [];
      
      if (providerMatches.length === 0) return matches;
      
      // Buscar órdenes pendientes de pago para los proveedores encontrados
      const providerIds = providerMatches.map(m => m.provider_id);
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', receipt.user_id)
        .in('provider_id', providerIds)
        .in('status', ['pendiente_de_pago', 'enviado']);
      
      if (error || !orders) {
        console.error('❌ [PaymentReceiptService] Error obteniendo órdenes:', error);
        return matches;
      }
      
      // Buscar coincidencias por monto (con tolerancia)
      if (receipt.payment_amount) {
        for (const order of orders) {
          const orderAmount = Number(order.total_amount) || 0;
          const receiptAmount = Number(receipt.payment_amount) || 0;
          
          // Coincidencia exacta
          if (orderAmount === receiptAmount) {
            matches.push({
              order_id: order.id,
              order_number: order.order_number,
              confidence: 0.9,
              match_method: 'exact_amount_match',
              match_details: { 
                amount: receipt.payment_amount,
                provider_id: order.provider_id
              }
            });
          }
          // Coincidencia con tolerancia de ±1 (para diferencias de decimales)
          else if (Math.abs(orderAmount - receiptAmount) <= 1) {
            matches.push({
              order_id: order.id,
              order_number: order.order_number,
              confidence: 0.8,
              match_method: 'tolerance_amount_match',
              match_details: { 
                amount: receipt.payment_amount,
                provider_id: order.provider_id,
                difference: Math.abs(orderAmount - receiptAmount)
              }
            });
          }
        }
      }
      
      // Ordenar por confianza
      return matches.sort((a, b) => b.confidence - a.confidence);
      
    } catch (error) {
      console.error('❌ [PaymentReceiptService] Error buscando órdenes:', error);
      return [];
    }
  }
  
  /**
   * Registrar intentos de asignación
   */
  static async recordAssignmentAttempts(
    receiptId: string,
    providerMatches: ProviderMatchResult[],
    orderMatches: OrderMatchResult[]
  ): Promise<void> {
    try {
      const attempts = [];
      
      // Registrar intentos de proveedores
      for (const match of providerMatches) {
        attempts.push({
          receipt_id: receiptId,
          provider_id: match.provider_id,
          assignment_method: match.match_method,
          confidence_score: match.confidence,
          match_details: match.match_details,
          success: match.confidence > 0.7
        });
      }
      
      // Registrar intentos de órdenes
      for (const match of orderMatches) {
        attempts.push({
          receipt_id: receiptId,
          order_id: match.order_id,
          assignment_method: match.match_method,
          confidence_score: match.confidence,
          match_details: match.match_details,
          success: match.confidence > 0.7
        });
      }
      
      if (attempts.length > 0) {
        await supabase
          .from('payment_receipt_assignment_attempts')
          .insert(attempts);
      }
      
    } catch (error) {
      console.error('❌ [PaymentReceiptService] Error registrando intentos:', error);
    }
  }
  
  /**
   * Enviar comprobante a proveedor via WhatsApp
   */
  static async sendReceiptToProvider(
    receiptId: string,
    providerId: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log('📱 [PaymentReceiptService] Enviando comprobante a proveedor:', providerId);
      
      // 1. Obtener datos del comprobante y proveedor
      const { data: receipt, error: receiptError } = await supabase
        .from('payment_receipts')
        .select('*')
        .eq('id', receiptId)
        .single();
      
      if (receiptError || !receipt) {
        return { success: false, error: 'Comprobante no encontrado' };
      }
      
      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('*')
        .eq('id', providerId)
        .single();
      
      if (providerError || !provider) {
        return { success: false, error: 'Proveedor no encontrado' };
      }
      
      // 2. Enviar mensaje via WhatsApp
      const message = `¡Hola ${provider.name}! 👋\n\n` +
        `Te confirmo que hemos realizado el pago correspondiente. ` +
        `Adjunto encontrarás el comprobante de pago.\n\n` +
        `📄 Comprobante: ${receipt.receipt_number || 'N/A'}\n` +
        `💰 Monto: $${receipt.payment_amount?.toLocaleString('es-AR') || 'N/A'}\n` +
        `📅 Fecha: ${receipt.payment_date || 'N/A'}\n\n` +
        `¡Gracias por tu confianza! 🙏`;
      
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: provider.phone,
          message: message,
          mediaUrl: receipt.file_url,
          mediaType: 'document'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 3. Actualizar comprobante como enviado
        await supabase
          .from('payment_receipts')
          .update({
            sent_to_provider: true,
            sent_at: new Date().toISOString(),
            whatsapp_message_id: result.messageId,
            status: 'sent'
          })
          .eq('id', receiptId);
        
        console.log('✅ [PaymentReceiptService] Comprobante enviado exitosamente');
        return { success: true, messageId: result.messageId };
      } else {
        return { success: false, error: result.error || 'Error enviando mensaje' };
      }
      
    } catch (error) {
      console.error('❌ [PaymentReceiptService] Error enviando comprobante:', error);
      return { success: false, error: 'Error interno del servidor' };
    }
  }
  
  /**
   * Obtener comprobantes de pago del usuario
   */
  static async getUserPaymentReceipts(userId: string): Promise<PaymentReceiptData[]> {
    try {
      const { data, error } = await supabase
        .from('payment_receipts')
        .select(`
          *,
          providers(name, phone),
          orders(order_number, total_amount)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ [PaymentReceiptService] Error obteniendo comprobantes:', error);
        return [];
      }
      
      return data || [];
      
    } catch (error) {
      console.error('❌ [PaymentReceiptService] Error obteniendo comprobantes:', error);
      return [];
    }
  }
  
  /**
   * Actualizar comprobante con datos extraídos por OCR
   */
  static async updatePaymentReceiptData(receiptId: string, extractedData: any): Promise<{ success: boolean; receipt?: PaymentReceiptData; error?: string }> {
    try {
      console.log('🔄 [PaymentReceiptService] Actualizando comprobante con datos extraídos:', receiptId);
      
      const { data, error } = await supabase
        .from('payment_receipts')
        .update({
          ocr_data: extractedData,
          extracted_text: JSON.stringify(extractedData),
          payment_amount: extractedData.paymentAmount || extractedData.payment_amount,
          payment_date: extractedData.paymentDate || extractedData.payment_date,
          payment_method: extractedData.paymentMethod || extractedData.payment_method,
          receipt_number: extractedData.receiptNumber || extractedData.receipt_number,
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', receiptId)
        .select()
        .single();

      if (error) {
        console.error('❌ [PaymentReceiptService] Error actualizando comprobante con datos OCR:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [PaymentReceiptService] Comprobante actualizado con datos OCR exitosamente');
      return { success: true, receipt: data };
    } catch (error) {
      console.error('❌ [PaymentReceiptService] Error actualizando comprobante:', error);
      return { success: false, error: 'Error interno del servidor' };
    }
  }

  /**
   * Crear registro en tabla documents para que aparezca en carpeta de proveedores
   */
  private static async createDocumentRecord(
    receipt: PaymentReceiptData, 
    providerId: string, 
    orderId?: string
  ): Promise<void> {
    try {
      console.log('📁 [PaymentReceiptService] Creando registro en tabla documents para proveedor:', providerId);
      
      const documentData = {
        user_id: receipt.user_id,
        provider_id: providerId,
        order_id: orderId || null,
        filename: receipt.filename,
        file_url: receipt.file_url,
        file_size: receipt.file_size,
        file_type: 'factura',
        mime_type: receipt.mime_type,
        sender_type: 'user', // Campo obligatorio
        status: 'assigned',
        ocr_data: {
          paymentAmount: receipt.payment_amount,
          paymentDate: receipt.payment_date,
          paymentMethod: receipt.payment_method,
          receiptNumber: receipt.receipt_number,
          extractedFrom: 'payment_receipt'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('documents')
        .insert(documentData);
      
      if (error) {
        console.error('❌ [PaymentReceiptService] Error creando registro en documents:', error);
      } else {
        console.log('✅ [PaymentReceiptService] Registro creado en tabla documents exitosamente');
      }
      
    } catch (error) {
      console.error('❌ [PaymentReceiptService] Error creando registro en documents:', error);
    }
  }

  /**
   * Inferir tipo de archivo basado en nombre y MIME type
   */
  private static inferFileType(filename: string, mimeType: string): 'transferencia' | 'cheque' | 'efectivo' | 'tarjeta' | 'other' {
    const lowerFilename = filename.toLowerCase();
    
    if (lowerFilename.includes('transferencia') || lowerFilename.includes('transfer')) {
      return 'transferencia';
    }
    if (lowerFilename.includes('cheque')) {
      return 'cheque';
    }
    if (lowerFilename.includes('efectivo') || lowerFilename.includes('cash')) {
      return 'efectivo';
    }
    if (lowerFilename.includes('tarjeta') || lowerFilename.includes('card')) {
      return 'tarjeta';
    }
    
    return 'other';
  }
}
