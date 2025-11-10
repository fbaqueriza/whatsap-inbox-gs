import { createClient } from '@supabase/supabase-js';

// Solo usar en el servidor - no importar en componentes del frontend
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ [PaymentReceiptService] Variables de entorno faltantes:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    url: supabaseUrl ? 'configurada' : 'faltante',
    key: supabaseKey ? 'configurada' : 'faltante'
  });
}

const supabase = createClient(
  supabaseUrl!,
  supabaseKey!
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
  match_method: 'amount_match' | 'provider_match' | 'exact_amount_and_provider_match' | 'tolerance_amount_and_provider_match';
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
      console.log('🔍 [PaymentReceiptService] ===== INICIANDO PROCESAMIENTO =====');
      console.log('🔄 [PaymentReceiptService] Comprobante ID:', receiptId);
      
      // 1. Obtener datos del comprobante
      console.log('🔍 [PaymentReceiptService] Obteniendo datos del comprobante...');
      const { data: receipt, error: fetchError } = await supabase
        .from('payment_receipts')
        .select('*')
        .eq('id', receiptId)
        .single();
      
      if (fetchError || !receipt) {
        console.error('❌ [PaymentReceiptService] Error obteniendo comprobante:', fetchError);
        return { success: false, error: 'Comprobante no encontrado' };
      }
      
      console.log('✅ [PaymentReceiptService] Comprobante obtenido:', {
        id: receipt.id,
        amount: receipt.payment_amount,
        user_id: receipt.user_id,
        status: receipt.status
      });
      
      // 2. Actualizar estado a processing
      await supabase
        .from('payment_receipts')
        .update({ status: 'processed' })
        .eq('id', receiptId);
      
      // 3. Intentar asignación automática a proveedores
      console.log('🔍 [PaymentReceiptService] Buscando proveedores coincidentes...');
      const providerMatches = await this.findMatchingProviders(receipt);
      console.log('📊 [PaymentReceiptService] Proveedores encontrados:', providerMatches.length);
      console.log('📋 [PaymentReceiptService] Detalles proveedores:', providerMatches.map(p => ({
        id: p.provider_id,
        name: p.provider_name,
        confidence: p.confidence,
        method: p.match_method
      })));
      
      // 4. Intentar asignación automática a órdenes
      console.log('🔍 [PaymentReceiptService] Buscando órdenes coincidentes...');
      const orderMatches = await this.findMatchingOrders(receipt, providerMatches);
      console.log('📊 [PaymentReceiptService] Órdenes encontradas:', orderMatches.length);
      console.log('📋 [PaymentReceiptService] Detalles órdenes:', orderMatches.map(o => ({
        id: o.order_id,
        number: o.order_number,
        confidence: o.confidence,
        method: o.match_method
      })));
      
      // 5. Actualizar comprobante con asignaciones
      const orderedProviderMatches = [...providerMatches];
      const bestOrderMatch = orderMatches[0];
      const orderProviderId = bestOrderMatch?.match_details?.provider_id;
      const candidateProviderMatch = orderProviderId
        ? orderedProviderMatches.find(pm => pm.provider_id === orderProviderId)
        : orderedProviderMatches[0];
      const alternativeProviderMatch = candidateProviderMatch
        ? orderedProviderMatches.find(pm => pm.provider_id !== candidateProviderMatch.provider_id)
        : undefined;

      const providerIsReliable = Boolean(
        candidateProviderMatch &&
        (
          (candidateProviderMatch.match_method === 'cuit_match' && candidateProviderMatch.confidence >= 0.95) ||
          (
            candidateProviderMatch.confidence >= 0.92 &&
            (!alternativeProviderMatch || (candidateProviderMatch.confidence - alternativeProviderMatch.confidence) >= 0.2)
          )
        ) &&
        (!orderProviderId || candidateProviderMatch.provider_id === orderProviderId)
      );

      const canAssignOrderAndProvider = Boolean(bestOrderMatch && candidateProviderMatch && providerIsReliable);
      
      const updateData: Partial<PaymentReceiptData> = {
        processed_at: new Date().toISOString()
      };
      
      // 🔧 CORRECCIÓN: Solo marcar como 'assigned' si hay ORDEN Y PROVEEDOR asignados
      // El badge "Asignado" solo debe aparecer cuando está linkeado a una orden Y proveedor
      if (canAssignOrderAndProvider && bestOrderMatch && candidateProviderMatch) {
        // Caso ideal: hay orden Y proveedor con alta confianza
        updateData.status = 'assigned';
        updateData.auto_assigned_provider_id = candidateProviderMatch.provider_id;
        updateData.provider_id = candidateProviderMatch.provider_id;
        updateData.auto_assigned_order_id = bestOrderMatch.order_id;
        updateData.order_id = bestOrderMatch.order_id;
        updateData.assignment_confidence = Math.min(candidateProviderMatch.confidence, bestOrderMatch.confidence);
        updateData.assignment_method = candidateProviderMatch.match_method;
        console.log('✅ [PaymentReceiptService] Comprobante asignado a orden Y proveedor:', {
          order: bestOrderMatch.order_number,
          provider: candidateProviderMatch.provider_name
        });
      } else if (bestOrderMatch) {
        // Si solo hay orden, obtener el proveedor de la orden
        console.log('⚠️ [PaymentReceiptService] Solo se encontró orden, buscando proveedor de la orden...');
        const { data: orderData } = await supabase
          .from('orders')
          .select('provider_id')
          .eq('id', bestOrderMatch.order_id)
          .single();
        
        if (orderData?.provider_id) {
          // Si la orden tiene proveedor, marcar como 'assigned'
          updateData.status = 'assigned';
          updateData.auto_assigned_provider_id = orderData.provider_id;
          updateData.provider_id = orderData.provider_id;
          updateData.auto_assigned_order_id = bestOrderMatch.order_id;
          updateData.order_id = bestOrderMatch.order_id;
          updateData.assignment_confidence = bestOrderMatch.confidence;
          updateData.assignment_method = 'amount_match';
          console.log('✅ [PaymentReceiptService] Comprobante asignado a orden Y proveedor (obtenido de orden):', orderData.provider_id);
        } else {
          // Si no hay proveedor en la orden, marcar como 'processed' pero no 'assigned'
          updateData.status = 'processed';
          updateData.auto_assigned_order_id = bestOrderMatch.order_id;
          updateData.order_id = bestOrderMatch.order_id;
          console.log('⚠️ [PaymentReceiptService] Orden asignada pero sin proveedor, marcado como procesado');
        }
        if (candidateProviderMatch) {
          updateData.auto_assigned_provider_id = candidateProviderMatch.provider_id;
          updateData.assignment_confidence = Math.min(candidateProviderMatch.confidence, bestOrderMatch.confidence);
          updateData.assignment_method = candidateProviderMatch.match_method;
        } else {
          updateData.assignment_confidence = bestOrderMatch.confidence;
          updateData.assignment_method = bestOrderMatch.match_method;
        }
      } else if (candidateProviderMatch) {
        // Si solo hay proveedor
        updateData.status = 'processed';
        updateData.auto_assigned_provider_id = candidateProviderMatch.provider_id;
        updateData.assignment_confidence = candidateProviderMatch.confidence;
        updateData.assignment_method = candidateProviderMatch.match_method;
        if (providerIsReliable) {
          updateData.provider_id = candidateProviderMatch.provider_id;
        }
        console.log('⚠️ [PaymentReceiptService] Proveedor sugerido pero sin orden, marcado como procesado');
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
      if (canAssignOrderAndProvider && candidateProviderMatch && bestOrderMatch) {
        await this.createDocumentRecord(receipt, candidateProviderMatch.provider_id, bestOrderMatch.order_id);
      }
      
      console.log('✅ [PaymentReceiptService] Procesamiento completado. Logs de debugging:');
      console.log('- Mejores matches proveedores:', providerMatches.length > 0 ? providerMatches.slice(0, 3) : []);
      console.log('- Mejores matches órdenes:', orderMatches.length > 0 ? orderMatches.slice(0, 3) : []);
      console.log('- Mejor match orden:', bestOrderMatch?.order_id);
      
      // 🔧 SOLUCIÓN: Conectar correctamente el comprobante con la orden asignada
      if (canAssignOrderAndProvider && bestOrderMatch && bestOrderMatch.confidence > 0.7 && candidateProviderMatch) {
        console.log('🎯 [PaymentReceiptService] ===== ASIGNANDO A ORDEN =====');
        console.log('🔄 [PaymentReceiptService] Mejor orden match:', {
          id: bestOrderMatch.order_id,
          number: bestOrderMatch.order_number,
          confidence: bestOrderMatch.confidence,
          method: bestOrderMatch.match_method
        });
        
        // Actualizar comprobante con la orden asignada
        console.log('🔧 [PaymentReceiptService] Actualizando comprobante...');
        const { error: receiptUpdateError } = await supabase
          .from('payment_receipts')
          .update({ 
            order_id: bestOrderMatch.order_id,
            status: 'assigned',
            updated_at: new Date().toISOString()
          })
          .eq('id', receiptId);
        
        if (receiptUpdateError) {
          console.error('❌ [PaymentReceiptService] Error asignando comprobante a orden:', receiptUpdateError);
        } else {
          console.log('✅ [PaymentReceiptService] Comprobante asignado a orden exitosamente');
        }
        
        // Actualizar estado de la orden a 'comprobante_enviado'
        console.log('🎯 [PaymentReceiptService] Actualizando orden a "comprobante_enviado":', {
          orderId: bestOrderMatch.order_id,
          orderNumber: bestOrderMatch.order_number,
          newStatus: 'comprobante_enviado',
          receiptUrl: receipt.file_url
        });
        const { data: updatedOrder, error: orderUpdateError } = await supabase
          .from('orders')
          .update({ 
            status: 'comprobante_enviado',
            payment_receipt_url: receipt.file_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', bestOrderMatch.order_id)
          .select()
          .single();
        
        if (orderUpdateError) {
          console.error('❌ [PaymentReceiptService] Error actualizando orden a comprobante_enviado:', orderUpdateError);
        } else {
          console.log('✅ [PaymentReceiptService] Orden actualizada a "comprobante_enviado" exitosamente:', {
            orderId: updatedOrder?.id,
            orderNumber: updatedOrder?.order_number,
            status: updatedOrder?.status,
            receiptUrl: updatedOrder?.receipt_url,
            updatedAt: updatedOrder?.updated_at
          });
          console.log('🔔 [PaymentReceiptService] Esta actualización debería disparar un evento Realtime para los suscriptores');
          
          // 🔧 WORKAROUND: Emitir broadcast manual para notificar a los clientes Realtime
          try {
            const broadcastResult = await supabase
              .channel('orders-updates')
              .send({
                type: 'broadcast' as const,
                event: 'order_updated',
                payload: {
                  orderId: updatedOrder?.id,
                  status: updatedOrder?.status,
                  receiptUrl: updatedOrder?.receipt_url,
                  timestamp: new Date().toISOString(),
                  source: 'payment_receipt'
                }
              });
            
            if (broadcastResult === 'error') {
              console.error('⚠️ [PaymentReceiptService] Error enviando broadcast');
            } else {
              console.log('✅ [PaymentReceiptService] Broadcast de actualización enviado');
            }
          } catch (broadcastErr) {
            console.error('⚠️ [PaymentReceiptService] Error en broadcast:', broadcastErr);
          }
          
          const autoSendEnabled = process.env.AUTO_SEND_PAYMENT_RECEIPTS === 'true';
          if (autoSendEnabled) {
            console.log('📱 [PaymentReceiptService] Enviando comprobante automáticamente...');
            try {
              const sendResult = await this.sendReceiptToProvider(receiptId, candidateProviderMatch.provider_id);
              if (sendResult.success) {
                console.log('✅ [PaymentReceiptService] Comprobante enviado automáticamente con éxito');
              } else {
                console.error('❌ [PaymentReceiptService] Error enviando comprobante automáticamente:', sendResult.error);
              }
            } catch (sendError) {
              console.error('❌ [PaymentReceiptService] Error en envío automático:', sendError);
            }
          } else {
            console.log('ℹ️ [PaymentReceiptService] Envío automático de comprobantes deshabilitado. Requiere acción manual.');
          }
        }
      } else {
        console.log('⚠️ [PaymentReceiptService] No se encontró orden para asignar');
        console.log('📊 [PaymentReceiptService] Razón:', {
          hasOrderMatch: !!bestOrderMatch,
          orderConfidence: bestOrderMatch?.confidence || 0,
          requiredConfidence: 0.7,
          enoughConfidence: bestOrderMatch?.confidence ? bestOrderMatch.confidence > 0.7 : false
        });
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
        user_id: receipt.user_id,
        ocr_data: (receipt as any).ocr_data ? 'presente' : 'ausente'
      });
      console.log('🔍 [PaymentReceiptService] Primeros 3 proveedores:', providers.slice(0, 3).map(p => ({
        id: p.id,
        name: p.name,
        cuit: p.cuit_cuil
      })));
      
      // 🔧 CORRECCIÓN: Buscar coincidencias por CUIT del proveedor (coincidencia exacta)
      // Primero intentar extraer CUIT del comprobante desde receipt_number o texto extraído
      let extractedCuit: string | null = null;
      
      // Buscar CUIT en receipt_number
      if (receipt.receipt_number) {
        const cuitMatch = receipt.receipt_number.match(/([0-9]{2}[\/\-]?[0-9]{8}[\/\-]?[0-9])/);
        if (cuitMatch) {
          extractedCuit = cuitMatch[1].replace(/[\/\-]/g, ''); // Normalizar CUIT (sin guiones)
        }
      }
      
      // Si no se encontró en receipt_number, buscar en ocr_data si existe
      if (!extractedCuit && (receipt as any).ocr_data) {
        const ocrData = typeof (receipt as any).ocr_data === 'string' 
          ? JSON.parse((receipt as any).ocr_data) 
          : (receipt as any).ocr_data;
        if (ocrData.cuit || ocrData.CUIT) {
          extractedCuit = (ocrData.cuit || ocrData.CUIT).replace(/[\/\-]/g, '');
        }
      }
      
      console.log('🔍 [PaymentReceiptService] CUIT extraído del comprobante:', extractedCuit);
      
      // Buscar proveedores por CUIT (coincidencia exacta - mayor prioridad)
      if (extractedCuit) {
        for (const provider of providers) {
          if (provider.cuit_cuil) {
            const providerCuit = provider.cuit_cuil.replace(/[\/\-]/g, ''); // Normalizar CUIT del proveedor
            if (providerCuit === extractedCuit) {
              matches.push({
                provider_id: provider.id,
                provider_name: provider.name,
                confidence: 1.0, // Máxima confianza para coincidencia exacta de CUIT
                match_method: 'cuit_match',
                match_details: { 
                  provider_cuit: provider.cuit_cuil, 
                  receipt_cuit: extractedCuit,
                  receipt_number: receipt.receipt_number 
                }
              });
              console.log(`✅ [PaymentReceiptService] Coincidencia exacta de CUIT: ${provider.name} (${provider.cuit_cuil})`);
            }
          }
        }
      }
      
      // Si no se encontró por CUIT, buscar por nombre del proveedor en el comprobante (menor prioridad)
      if (matches.length === 0 && receipt.receipt_number) {
        for (const provider of providers) {
          // Buscar nombre del proveedor en el número de comprobante o en datos del proveedor
          if (provider.name && receipt.receipt_number.toLowerCase().includes(provider.name.toLowerCase())) {
            matches.push({
              provider_id: provider.id,
              provider_name: provider.name,
              confidence: 0.6, // Menor confianza para coincidencia por nombre
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
   * 🔧 SOLUCIÓN MEJORADA: Buscar órdenes que coincidan con el comprobante por proveedor Y monto
   */
  static async findMatchingOrders(
    receipt: PaymentReceiptData, 
    providerMatches: ProviderMatchResult[]
  ): Promise<OrderMatchResult[]> {
    try {
      const matches: OrderMatchResult[] = [];
      
      // 🔧 RESTRICCIÓN: No hacer match sin proveedor asignado
      if (providerMatches.length === 0) {
        console.log('⚠️ [PaymentReceiptService] No hay proveedores coincidentes, no se puede asignar el comprobante a ninguna orden');
        
        // Si no hay proveedores asignados, no es posible hacer match con órdenes
        // Esta es una restricción de seguridad para evitar asignaciones incorrectas
        return [];
      }
      
      // 🔧 OPTIMIZACIÓN: Buscar órdenes pendientes de pago para los proveedores encontrados
      const providerIds = providerMatches.map(m => m.provider_id);
      console.log('🔍 [PaymentReceiptService] Buscando órdenes para proveedores:', providerIds);
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', receipt.user_id)
        .in('provider_id', providerIds)
        .in('status', ['pendiente_de_pago', 'enviado']);
      
      if (error || !orders) {
        console.error('❌ [PaymentReceiptService] Error obteniendo órdenes:', error);
      const methodPriority: Record<ProviderMatchResult['match_method'], number> = {
        cuit_match: 3,
        amount_match: 2,
        provider_match: 1
      };

      return matches
        .sort((a, b) => {
          const methodDiff = methodPriority[b.match_method] - methodPriority[a.match_method];
          if (methodDiff !== 0) {
            return methodDiff;
          }
          return (b.confidence || 0) - (a.confidence || 0);
        });
      }
      
      console.log(`✅ [PaymentReceiptService] Órdenes encontradas para proveedores: ${orders.length}`);
      console.log('🔍 [PaymentReceiptService] Detalles de órdenes encontradas:', orders.slice(0, 5).map(o => ({
        id: o.id,
        order_number: o.order_number,
        provider_id: o.provider_id,
        total_amount: o.total_amount,
        status: o.status
      })));
      console.log('🔍 [PaymentReceiptService] Monto del comprobante:', receipt.payment_amount);
      console.log('🔍 [PaymentReceiptService] Provider matches disponibles:', providerMatches.map(pm => ({
        provider_id: pm.provider_id,
        method: pm.match_method,
        confidence: pm.confidence
      })));
      
      // 🔧 CORRECCIÓN MEJORADA: Buscar coincidencias por proveedor Y monto exacto
      // Priorizar matches con CUIT, pero también permitir matches por monto si el proveedor coincide
      if (receipt.payment_amount) {
        // Extraer CUIT del comprobante (misma lógica que en findMatchingProviders)
        let extractedCuit: string | null = null;
        if (receipt.receipt_number) {
          const cuitMatch = receipt.receipt_number.match(/([0-9]{2}[\/\-]?[0-9]{8}[\/\-]?[0-9])/);
          if (cuitMatch) {
            extractedCuit = cuitMatch[1].replace(/[\/\-]/g, '');
          }
        }
        if (!extractedCuit && (receipt as any).ocr_data) {
          const ocrData = typeof (receipt as any).ocr_data === 'string' 
            ? JSON.parse((receipt as any).ocr_data) 
            : (receipt as any).ocr_data;
          if (ocrData.cuit || ocrData.CUIT) {
            extractedCuit = (ocrData.cuit || ocrData.CUIT).replace(/[\/\-]/g, '');
          }
        }
        
        for (const order of orders) {
          const orderAmount = Number(order.total_amount) || 0;
          const receiptAmount = Number(receipt.payment_amount) || 0;
          
          // Buscar si el proveedor de la orden está en los providerMatches
          const providerMatch = providerMatches.find(pm => pm.provider_id === order.provider_id);
          
          if (!providerMatch) {
            continue; // Saltar esta orden si el proveedor no está en los matches
          }
          
          // 🔧 CORRECCIÓN: Coincidencia de monto con tolerancia de ±2 pesos
          // El matcheo del monto es el que menos preciso debe ser
          const tolerance = 2; // Tolerancia de 2 pesos
          const difference = Math.abs(orderAmount - receiptAmount);
          
          if (difference <= tolerance) {
            // Priorizar matches con CUIT (confianza 1.0), pero también aceptar otros matches
            // Reducir confianza según la diferencia de monto
            let baseConfidence = providerMatch.match_method === 'cuit_match' && providerMatch.confidence >= 1.0
              ? 1.0
              : 0.9;
            
            // Reducir confianza si hay diferencia (aunque sea dentro de la tolerancia)
            const confidence = difference === 0 
              ? baseConfidence 
              : Math.max(0.7, baseConfidence - (difference / receiptAmount) * 0.1);
            
            matches.push({
              order_id: order.id,
              order_number: order.order_number,
              confidence: confidence,
              match_method: providerMatch.match_method === 'cuit_match' && providerMatch.confidence >= 1.0 && difference === 0
                ? 'exact_amount_and_provider_match'
                : difference === 0
                ? 'exact_amount_and_provider_match'
                : 'tolerance_amount_and_provider_match',
              match_details: { 
                amount: receipt.payment_amount,
                order_amount: orderAmount,
                difference: difference,
                tolerance: tolerance,
                provider_id: order.provider_id,
                provider_cuit: extractedCuit,
                provider_match_method: providerMatch.match_method,
                provider_confidence: providerMatch.confidence,
                order_created: order.created_at,
                is_cuit_match: providerMatch.match_method === 'cuit_match'
              }
            });
            console.log(`✅ [PaymentReceiptService] Coincidencia monto (tolerancia ±${tolerance}): Orden ${order.order_number} (${orderAmount} vs ${receiptAmount}, diff: ${difference}), método: ${providerMatch.match_method}`);
          }
        }
      }
      
      
      // 🔧 OPTIMIZACIÓN: Evitar duplicados y ordenar por confianza
      const uniqueMatches = Array.from(
        new Map(matches.map(m => [m.order_id, m])).values()
      );
      
      return uniqueMatches.sort((a, b) => b.confidence - a.confidence);
      
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
      
      // Instanciar servicios necesarios
      const { KapsoService } = await import('./kapsoService');
      const kapsoService = new KapsoService();
      const { normalizePhoneNumber, comparePhoneNumbers } = await import('./phoneNormalization');
      
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
      
      const normalizedInfo = normalizePhoneNumber(provider.phone || '');
      const normalizedPhone = normalizedInfo.normalized;
      const phoneForKapso = normalizedPhone ? normalizedPhone.replace('+', '') : provider.phone;
      
      console.log('📞 [PaymentReceiptService] Datos de teléfono para envío:', {
        providerPhone: provider.phone,
        normalized: normalizedPhone,
        phoneForKapso,
        receiptOwnerId: receipt.user_id
      });
      
      // 2. 🔧 CORRECCIÓN: Verificar si hay mensajes recientes del proveedor (últimas 24 horas)
      // Si hay mensajes recientes, la conversación está activa y podemos enviar directamente
      // Si no hay mensajes recientes, primero abrir con template
      const message = `¡Hola ${provider.name}! 👋\n\n` +
        `Te confirmo que hemos realizado el pago correspondiente. ` +
        `Adjunto encontrarás el comprobante de pago.\n\n` +
        `📄 Comprobante: ${receipt.receipt_number || 'N/A'}\n` +
        `💰 Monto: $${receipt.payment_amount?.toLocaleString('es-AR') || 'N/A'}\n` +
        `📅 Fecha: ${receipt.payment_date || 'N/A'}\n\n` +
        `¡Gracias por tu confianza! 🙏`;
      
      // Verificar si hay mensajes recientes del proveedor (últimas 24 horas)
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const contactIdentifiers = [provider.id, provider.phone, provider.phone?.replace(/\D/g, '')].filter(Boolean);

      const { data: recentMessages, error: messagesError } = await supabase
        .from('whatsapp_messages')
        .select('id, timestamp, direction, contact_id')
        .in('contact_id', contactIdentifiers as string[])
        .gte('timestamp', last24Hours.toISOString())
        .order('timestamp', { ascending: false })
        .limit(1);

      if (messagesError) {
        console.warn('⚠️ [PaymentReceiptService] Error verificando mensajes recientes:', messagesError);
      }

      let hasRecentMessages = recentMessages && recentMessages.length > 0;

      console.log('🔍 [PaymentReceiptService] Verificando mensajes recientes:', {
        providerId: provider.id,
        providerPhone: provider.phone,
        identifiers: contactIdentifiers,
        hasRecentMessages,
        lastMessageTime: recentMessages?.[0]?.timestamp,
        lastMessageDirection: recentMessages?.[0]?.direction,
        lastMessageContactId: recentMessages?.[0]?.contact_id
      });

      // 2.b Verificar estado de conversación en Kapso
      let kapsoConversationActive = false;
      let kapsoConversationData: any = null;

      if (provider.phone) {
        try {
          const activeConversations = await kapsoService.getAllActiveConversations();

          kapsoConversationData = activeConversations.find(conv => comparePhoneNumbers(provider.phone, conv.phone_number) || comparePhoneNumbers(normalizedPhone, conv.phone_number));

          if (kapsoConversationData) {
            kapsoConversationActive = true;
          } else {
            // Consultar cualquier conversación (incluyendo ended) para obtener metadata de última actividad
            const allConversationsResponse = await kapsoService.getConversations({ per_page: 5, phone_number: normalizedPhone ? normalizedPhone.replace('+', '') : provider.phone });
            const matchedConversation = allConversationsResponse.data.find(conv => comparePhoneNumbers(provider.phone, conv.phone_number) || comparePhoneNumbers(normalizedPhone, conv.phone_number));
            if (matchedConversation) {
              kapsoConversationData = matchedConversation;
              const lastActiveAt = matchedConversation.last_active_at ? new Date(matchedConversation.last_active_at) : null;
              if (lastActiveAt && lastActiveAt >= last24Hours) {
                kapsoConversationActive = true;
              }
            }
          }

          console.log('📡 [PaymentReceiptService] Estado de conversación Kapso:', {
            phone: provider.phone,
            normalizedPhone,
            kapsoConversationActive,
            conversationId: kapsoConversationData?.id,
            status: kapsoConversationData?.status,
            lastActiveAt: kapsoConversationData?.last_active_at
          });
        } catch (kapsoError) {
          console.warn('⚠️ [PaymentReceiptService] No se pudo verificar conversación en Kapso:', kapsoError);
        }
      }

      const conversationActive = hasRecentMessages || kapsoConversationActive;

      // Solo abrir conversación con template si NO hay mensajes recientes ni conversación activa en Kapso
      if (!conversationActive) {
        try {
          console.log('📱 [PaymentReceiptService] Conversación inactiva, abriendo con template...');
          const triggerResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/whatsapp/trigger-conversation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: normalizedPhone || provider.phone,
              template_name: 'inicializador_de_conv'
            })
          });
          
          if (!triggerResponse.ok) {
            console.warn('⚠️ [PaymentReceiptService] No se pudo abrir conversación con template, continuando con envío directo');
          } else {
            console.log('✅ [PaymentReceiptService] Conversación abierta con template');
            // Esperar un momento para que el template se procese
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (triggerError) {
          console.warn('⚠️ [PaymentReceiptService] Error abriendo conversación, continuando con envío directo:', triggerError);
        }
      } else {
        console.log('✅ [PaymentReceiptService] Conversación activa detectada (mensajes recientes o Kapso). Enviando directamente sin template.');
      }
      
      // Paso 2: Enviar documento usando Kapso
      const filename = receipt.file_url.split('/').pop() || 'comprobante.pdf';

      const sendDocument = async () => {
        const receiptOwnerId = receipt.user_id;
        return kapsoService.sendStandaloneDocument(
          phoneForKapso,
        receipt.file_url,
        filename,
          message,
          receiptOwnerId
      );
      };

      let result;
      try {
        result = await sendDocument();
      } catch (sendError: any) {
        const errorMessage = sendError?.message || sendError?.response?.data || sendError?.toString?.() || '';
        console.error('❌ [PaymentReceiptService] Error enviando documento:', errorMessage);

        const isConversationInactive =
          typeof errorMessage === 'string' && (
            errorMessage.toLowerCase().includes('non-template') ||
            errorMessage.toLowerCase().includes('24-hour') ||
            errorMessage.toLowerCase().includes('470')
          );

        if (isConversationInactive) {
          return {
            success: false,
            error: 'WhatsApp rechazó el envío porque la conversación está fuera de la ventana de 24 horas. Envía primero el template "inicializador_de_conv" desde la sección de conversación y reintenta.'
          };
        }

        throw sendError;
      }
      
      if (!result?.data?.id) {
        return { success: false, error: 'Error enviando mensaje' };
      }
      
      // 3. Actualizar comprobante como enviado
      await supabase
        .from('payment_receipts')
        .update({
          sent_to_provider: true,
          sent_at: new Date().toISOString(),
          whatsapp_message_id: result.data.id,
          status: 'sent'
        })
        .eq('id', receiptId);
        
      const orderIdToUpdate = receipt.order_id || receipt.auto_assigned_order_id;

      if (orderIdToUpdate) {
        console.log('🎯 [PaymentReceiptService] Actualizando orden vinculada tras envío de comprobante:', {
          orderId: orderIdToUpdate,
          receiptId,
          receiptUrl: receipt.file_url
        });

        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            status: 'comprobante_enviado',
            payment_receipt_url: receipt.file_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderIdToUpdate);

        if (orderUpdateError) {
          console.error('⚠️ [PaymentReceiptService] Error actualizando orden al estado comprobante_enviado:', orderUpdateError);
        } else {
          try {
            const broadcastResult = await supabase
              .channel('orders-updates')
              .send({
                type: 'broadcast' as const,
                event: 'order_updated',
                payload: {
                  orderId: orderIdToUpdate,
                  status: 'comprobante_enviado',
                  receiptUrl: receipt.file_url,
                  timestamp: new Date().toISOString(),
                  source: 'payment_receipt_send'
                }
              });

            if (broadcastResult === 'error') {
              console.error('⚠️ [PaymentReceiptService] Error enviando broadcast tras envío de comprobante');
            }
          } catch (broadcastErr) {
            console.error('⚠️ [PaymentReceiptService] Error emitiendo broadcast tras enviar comprobante:', broadcastErr);
          }
        }
      } else {
        console.log('ℹ️ [PaymentReceiptService] Comprobante enviado sin orden asociada. No se actualiza estado de orden.');
      }

        console.log('✅ [PaymentReceiptService] Comprobante enviado exitosamente');
        return { success: true, messageId: result.data.id };
      
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
