/**
 * 🚀 SERVICIO OPTIMIZADO DE PROCESAMIENTO DE DOCUMENTOS KAPSO
 * 
 * Sistema unificado y optimizado para procesar documentos recibidos desde Kapso.
 * Consolida OCR, extracción de datos y creación de órdenes en un flujo eficiente.
 * 
 * Optimizaciones:
 * - Flujo directo sin pasos intermedios innecesarios
 * - Procesamiento en memoria (sin descargas/uploads redundantes)
 * - Búsqueda optimizada de proveedor
 * - Extracción consolidada de datos
 */

import { createClient } from '@supabase/supabase-js';
import { PhoneNumberService } from './phoneNumberService';
import { ocrService } from './ocrService';
import { simpleInvoiceExtraction } from './simpleInvoiceExtraction';

interface KapsoDocumentData {
  filename: string;
  mimeType: string;
  url: string;
  id?: string;
  fileSize?: number;
  providerId?: string; // Para subidas manuales
  fileBuffer?: Buffer; // Para subidas manuales (archivo ya en memoria)
}

interface ProcessResult {
  success: boolean;
  documentId?: string;
  orderId?: string;
  error?: string;
  ocrData?: any;
}

export class KapsoDocumentProcessor {
  private static instance: KapsoDocumentProcessor;
  // 🔧 CRÍTICO: NO usar cliente con service role key aquí
  // El cliente se pasa como parámetro para usar el mismo que dispara Realtime

  private constructor() {
    // No inicializar cliente aquí - se pasa como parámetro
  }

  static getInstance(): KapsoDocumentProcessor {
    if (!KapsoDocumentProcessor.instance) {
      KapsoDocumentProcessor.instance = new KapsoDocumentProcessor();
    }
    return KapsoDocumentProcessor.instance;
  }

  /**
   * 🚀 PROCESAR DOCUMENTO DE KAPSO (FLUJO OPTIMIZADO)
   * 
   * Procesa un documento recibido desde Kapso en un solo flujo optimizado:
   * 1. Busca proveedor (optimizado)
   * 2. Descarga y procesa OCR en memoria
   * 3. Extrae datos estructurados
   * 4. Crea documento en BD
   * 5. Crea orden automáticamente
   * 
   * @param supabaseClient - Cliente de Supabase que dispara Realtime (NO service role key)
   */
  async processDocument(
    fromNumber: string | null,
    documentData: KapsoDocumentData,
    userId: string,
    requestId: string,
    supabaseClient: any // 🔧 CRÍTICO: Cliente que dispara Realtime
  ): Promise<ProcessResult> {
    try {
      console.log(`🚀 [${requestId}] ===== PROCESAMIENTO OPTIMIZADO DE DOCUMENTO KAPSO =====`);
      
      // 1. Buscar proveedor (optimizado) - solo si hay fromNumber
      let provider = null;
      if (fromNumber) {
        provider = await this.findProviderOptimized(fromNumber, userId, requestId, supabaseClient);
        
        if (!provider) {
          console.log(`⚠️ [${requestId}] Proveedor no encontrado, procesando sin asociación`);
        }
      } else {
        // Si no hay fromNumber, intentar obtener providerId del documentData
        if (documentData.providerId) {
          const { data: providerData } = await supabaseClient
            .from('providers')
            .select('id, name, phone, auto_order_flow_enabled')
            .eq('id', documentData.providerId)
            .eq('user_id', userId)
            .single();
          provider = providerData || null;
        }
      }

      // 2. Verificar flujo automático
      console.log(`🔍 [${requestId}] DIAGNÓSTICO: Verificando flujo automático:`, {
        hasProvider: !!provider,
        providerName: provider?.name,
        autoOrderFlowEnabled: provider?.auto_order_flow_enabled,
        autoOrderFlowEnabledType: typeof provider?.auto_order_flow_enabled
      });
      
      if (provider && provider.auto_order_flow_enabled === false) {
        console.log(`⚠️ [${requestId}] DIAGNÓSTICO: Flujo automático DESHABILITADO para ${provider.name} - NO se creará orden`);
        return { success: true }; // Procesar pero no crear orden
      }
      
      if (provider) {
        console.log(`✅ [${requestId}] DIAGNÓSTICO: Flujo automático HABILITADO para ${provider.name} - se creará orden si hay datos`);
      } else {
        console.log(`⚠️ [${requestId}] DIAGNÓSTICO: No hay proveedor - NO se creará orden`);
      }

      // 3. Obtener archivo (descargar desde URL o usar buffer ya disponible)
      let fileBuffer: Buffer | null;
      
      if (documentData.fileBuffer) {
        // Archivo ya en memoria (subida manual)
        console.log(`📥 [${requestId}] Usando archivo en memoria (subida manual)...`);
        fileBuffer = documentData.fileBuffer;
      } else {
        // Descargar desde URL (Kapso)
        console.log(`📥 [${requestId}] Descargando archivo desde URL...`);
        fileBuffer = await this.downloadFile(documentData.url, requestId);
      }
      
      if (!fileBuffer) {
        return { success: false, error: 'Error obteniendo archivo' };
      }

      // 4. Procesar OCR y extracción en memoria (sin guardar intermedios)
      console.log(`🤖 [${requestId}] Procesando OCR y extracción...`);
      const { text, confidence } = await this.processOCR(fileBuffer, requestId);
      
      if (!text) {
        return { success: false, error: 'No se pudo extraer texto del documento' };
      }

      // 5. Extraer datos estructurados
      const extractionResult = await simpleInvoiceExtraction.extractFromText(text, documentData.filename);
      
      if (!extractionResult.success) {
        console.warn(`⚠️ [${requestId}] Error en extracción, continuando con texto crudo`);
      }

      // 6. Subir archivo a Storage y crear documento (solo una vez)
      const { fileUrl, documentId } = await this.saveDocument(
        fileBuffer,
        documentData,
        userId,
        provider?.id,
        text,
        extractionResult.data,
        confidence,
        requestId,
        supabaseClient
      );

      // 7. Crear orden automáticamente si hay proveedor y datos válidos
      console.log(`🔍 [${requestId}] DIAGNÓSTICO: Evaluando creación de orden:`, {
        hasProvider: !!provider,
        providerId: provider?.id,
        providerName: provider?.name,
        hasExtractionData: !!extractionResult.data,
        extractionSuccess: extractionResult.success,
        extractionDataKeys: extractionResult.data ? Object.keys(extractionResult.data) : [],
        extractionDataSample: extractionResult.data ? JSON.stringify(extractionResult.data).substring(0, 200) : 'null'
      });
      
      let orderId: string | undefined;
      if (provider && extractionResult.data) {
        console.log(`✅ [${requestId}] DIAGNÓSTICO: Condiciones CUMPLIDAS - Creando/actualizando orden desde factura...`);
        try {
          orderId = await this.createOrderFromInvoice(
            documentId,
            extractionResult.data,
            provider.id,
            userId,
            fileUrl,
            requestId,
            supabaseClient
          );
          console.log(`✅ [${requestId}] DIAGNÓSTICO: createOrderFromInvoice COMPLETADO - orderId:`, orderId);
        } catch (createError: any) {
          console.error(`❌ [${requestId}] DIAGNÓSTICO: ERROR en createOrderFromInvoice:`, createError);
          console.error(`❌ [${requestId}] DIAGNÓSTICO: Stack trace:`, createError?.stack);
          throw createError;
        }
      } else {
        console.log(`⚠️ [${requestId}] DIAGNÓSTICO: Condiciones NO CUMPLIDAS - NO se creará orden`);
        console.log(`⚠️ [${requestId}] DIAGNÓSTICO: Razón:`, {
          noProvider: !provider,
          noExtractionData: !extractionResult.data,
          extractionError: extractionResult.error
        });
      }

      console.log(`✅ [${requestId}] Procesamiento completado:`, {
        documentId,
        orderId: orderId || 'No creada',
        hasProvider: !!provider
      });

      return {
        success: true,
        documentId,
        orderId,
        ocrData: extractionResult.data
      };

    } catch (error) {
      console.error(`❌ [${requestId}] Error procesando documento:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * 🔍 BUSCAR PROVEEDOR (OPTIMIZADO)
   * 
   * Búsqueda eficiente con múltiples estrategias en paralelo
   */
  private async findProviderOptimized(
    fromNumber: string,
    userId: string,
    requestId: string,
    supabaseClient: any
  ): Promise<any | null> {
    const normalized = PhoneNumberService.normalizePhoneNumber(fromNumber);
    const variants = PhoneNumberService.searchVariants(fromNumber);
    const lastDigits = normalized.replace(/\D/g, '').slice(-8);

    // Búsqueda paralela: exacta + variantes + parcial
    const [exactResult, variantsResult, partialResult] = await Promise.allSettled([
      // Búsqueda exacta
      supabaseClient
        .from('providers')
        .select('id, name, phone, auto_order_flow_enabled')
        .eq('phone', normalized)
        .eq('user_id', userId)
        .single(),
      
      // Búsqueda por variantes (solo si hay variantes)
      variants.length > 0
        ? supabaseClient
            .from('providers')
            .select('id, name, phone, auto_order_flow_enabled')
            .in('phone', variants)
            .eq('user_id', userId)
            .limit(1)
        : Promise.resolve({ data: null, error: null }),
      
      // Búsqueda parcial (solo si hay suficientes dígitos)
      lastDigits.length >= 8
        ? supabaseClient
            .from('providers')
            .select('id, name, phone, auto_order_flow_enabled')
            .eq('user_id', userId)
            .or(`phone.ilike.%${lastDigits},phone.ilike.${lastDigits}%`)
            .limit(5)
        : Promise.resolve({ data: null, error: null })
    ]);

    // Priorizar: exacta > variantes > parcial
    if (exactResult.status === 'fulfilled' && exactResult.value.data) {
      console.log(`✅ [${requestId}] Proveedor encontrado (exacta): ${exactResult.value.data.name}`);
      return exactResult.value.data;
    }

    if (variantsResult.status === 'fulfilled' && variantsResult.value.data?.[0]) {
      const provider = variantsResult.value.data[0];
      console.log(`✅ [${requestId}] Proveedor encontrado (variante): ${provider.name}`);
      return provider;
    }

    if (partialResult.status === 'fulfilled' && partialResult.value.data?.length > 0) {
      const bestMatch = partialResult.value.data.find((p: any) => 
        p.phone.replace(/\D/g, '').slice(-8) === lastDigits
      );
      if (bestMatch) {
        console.log(`✅ [${requestId}] Proveedor encontrado (parcial): ${bestMatch.name}`);
        return bestMatch;
      }
    }

    return null;
  }

  /**
   * 📥 DESCARGAR ARCHIVO
   */
  private async downloadFile(url: string, requestId: string): Promise<Buffer | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error(`❌ [${requestId}] Error descargando archivo:`, error);
      return null;
    }
  }

  /**
   * 🤖 PROCESAR OCR
   */
  private async processOCR(fileBuffer: Buffer, requestId: string): Promise<{ text: string; confidence: number }> {
    try {
      const result = await ocrService.extractTextFromPDF(fileBuffer, 'documento.pdf');
      
      if (!result.success || !result.text) {
        throw new Error(result.error || 'OCR falló');
      }

      return {
        text: result.text,
        confidence: result.confidence || 0
      };
    } catch (error) {
      console.error(`❌ [${requestId}] Error en OCR:`, error);
      throw error;
    }
  }

  /**
   * 💾 GUARDAR DOCUMENTO EN BD Y STORAGE
   */
  private async saveDocument(
    fileBuffer: Buffer,
    documentData: KapsoDocumentData,
    userId: string,
    providerId: string | undefined,
    extractedText: string,
    invoiceData: any,
    confidence: number,
    requestId: string,
    supabaseClient: any
  ): Promise<{ fileUrl: string; documentId: string }> {
    // Subir a Storage (necesitamos service role para storage)
    const supabaseStorage = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fileName = providerId
      ? `${providerId}_${Date.now()}_${documentData.filename}`
      : `doc_${Date.now()}_${documentData.filename}`;
    const filePath = providerId
      ? `providers/${userId}/${providerId}/${fileName}`
      : `documents/${userId}/${fileName}`;

    const { error: uploadError } = await supabaseStorage.storage
      .from('files')
      .upload(filePath, fileBuffer, {
        contentType: documentData.mimeType,
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Error subiendo archivo: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabaseStorage.storage
      .from('files')
      .getPublicUrl(filePath);

    // Crear documento en BD con datos OCR ya procesados
    const ocrData = {
      document_type: 'factura',
      invoice_data: invoiceData || {},
      processing_time: Date.now(),
      ocr_engine: 'tesseract',
      language_detected: 'spa'
    };

    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .insert([{
        user_id: userId,
        filename: fileName,
        file_url: publicUrl,
        file_size: fileBuffer.length,
        file_type: 'factura',
        mime_type: documentData.mimeType,
        sender_type: 'provider',
        provider_id: providerId,
        ocr_data: ocrData,
        extracted_text: extractedText,
        confidence_score: Math.min(Math.max(confidence / 100, 0), 1),
        status: 'processed',
        processed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (docError || !document) {
      throw new Error(`Error creando documento: ${docError?.message || 'Unknown'}`);
    }

    return { fileUrl: publicUrl, documentId: document.id };
  }

  /**
   * 🆕 CREAR O ACTUALIZAR ORDEN DESDE FACTURA
   * 
   * Si hay una orden en estado "enviado" para el mismo proveedor, la actualiza.
   * Si no, crea una nueva orden.
   * 
   * @param supabaseClient - Cliente que dispara Realtime (NO service role key)
   */
  private async createOrderFromInvoice(
    documentId: string,
    invoiceData: any,
    providerId: string,
    userId: string,
    fileUrl: string,
    requestId: string,
    supabaseClient: any // 🔧 CRÍTICO: Cliente que dispara Realtime
  ): Promise<string | undefined> {
    try {
      // 🔧 CRÍTICO: Crear cliente service role una sola vez para toda la función
      const supabaseService = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // 🔧 CORRECCIÓN 1: Buscar orden existente en estado "enviado" para este proveedor
      console.log(`🔍 [${requestId}] Buscando orden existente en estado "enviado" para proveedor ${providerId}...`);
      console.log(`🔍 [${requestId}] DIAGNÓSTICO: Parámetros de búsqueda:`, {
        userId,
        providerId,
        status: 'enviado'
      });
      
      const { data: existingOrders, error: searchError } = await supabaseService
        .from('orders')
        .select('id, order_number, status, total_amount, created_at')
        .eq('user_id', userId)
        .eq('provider_id', providerId)
        .eq('status', 'enviado')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (searchError) {
        console.error(`❌ [${requestId}] Error buscando orden existente:`, searchError);
      }
      
      console.log(`🔍 [${requestId}] DIAGNÓSTICO: Resultado de búsqueda:`, {
        found: existingOrders?.length || 0,
        orders: existingOrders?.map(o => ({ id: o.id, order_number: o.order_number, status: o.status })) || [],
        error: searchError?.message
      });
      
      // 🔧 MEJORA: También buscar por variantes del estado "enviado" (por si acaso)
      if (!existingOrders || existingOrders.length === 0) {
        console.log(`🔍 [${requestId}] No se encontró con "enviado", buscando variantes...`);
        const { data: variantOrders } = await supabaseService
          .from('orders')
          .select('id, order_number, status, total_amount, created_at')
          .eq('user_id', userId)
          .eq('provider_id', providerId)
          .in('status', ['enviado', 'sent', 'Enviado', 'ENVIADO'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (variantOrders && variantOrders.length > 0) {
          console.log(`✅ [${requestId}] Orden encontrada con variante de estado:`, variantOrders[0]);
          const existingOrder = variantOrders[0];
          console.log(`🔄 [${requestId}] Actualizando orden existente en lugar de crear nueva...`);
          
          // Actualizar orden existente
          return await this.updateExistingOrder(
            existingOrder.id,
            documentId,
            invoiceData,
            fileUrl,
            requestId,
            supabaseClient
          );
        }
      }
      
      if (existingOrders && existingOrders.length > 0) {
        const existingOrder = existingOrders[0];
        console.log(`✅ [${requestId}] Orden existente encontrada: ${existingOrder.order_number} (${existingOrder.id})`);
        console.log(`🔄 [${requestId}] Actualizando orden existente en lugar de crear nueva...`);
        
        // Actualizar orden existente
        return await this.updateExistingOrder(
          existingOrder.id,
          documentId,
          invoiceData,
          fileUrl,
          requestId,
          supabaseClient
        );
      }
      
      console.log(`ℹ️ [${requestId}] DIAGNÓSTICO: No se encontró orden en estado "enviado", creando nueva orden...`);
      
      // Extraer monto (con fallback a 0 si no se encuentra)
      let invoiceTotal = invoiceData.totalAmount || invoiceData.total_amount || 0;
      
      console.log(`🔍 [${requestId}] DIAGNÓSTICO: Extrayendo monto de factura:`, {
        totalAmount: invoiceData.totalAmount,
        total_amount: invoiceData.total_amount,
        invoiceTotal
      });
      
      // Si no hay monto pero es factura, usar 0
      if (!invoiceTotal || invoiceTotal <= 0) {
        console.log(`⚠️ [${requestId}] DIAGNÓSTICO: No se encontró monto, creando orden con monto 0`);
        invoiceTotal = 0;
      } else {
        console.log(`✅ [${requestId}] DIAGNÓSTICO: Monto encontrado: $${invoiceTotal}`);
      }

      // Crear items (o item genérico si no hay)
      // 🔧 CRÍTICO: Asegurar que items siempre sea un array válido
      let items: any[] = [];
      
      if (invoiceData.items && Array.isArray(invoiceData.items) && invoiceData.items.length > 0) {
        items = invoiceData.items.map((item: any) => ({
          productName: item.description || item.name || 'Producto sin nombre',
          quantity: item.quantity || 1,
          unit: item.unit || 'un',
          price: item.unitPrice || item.price || 0,
          total: item.total || (item.unitPrice || item.price || 0) * (item.quantity || 1)
        }));
      } else {
        // Item genérico si no hay items específicos
        items = [{
          productName: 'Factura sin desglose de items',
          quantity: 1,
          unit: 'un',
          price: invoiceTotal || 0,
          total: invoiceTotal || 0
        }];
      }
      
      console.log(`🔍 [${requestId}] DIAGNÓSTICO: Items preparados:`, {
        itemsCount: items.length,
        items: items
      });

      // Generar número de orden
      const timestamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderNumber = `ORD-${timestamp}-${randomSuffix}`;

      // Crear orden con service role (tiene permisos)
      // Nota: supabaseService ya está definido arriba
      console.log(`🔍 [${requestId}] DIAGNÓSTICO: Preparando datos para crear orden:`, {
        orderNumber,
        providerId,
        userId,
        invoiceTotal,
        itemsCount: items.length,
        fileUrl,
        invoiceNumber: invoiceData.invoiceNumber || invoiceData.invoice_number
      });
      
      const { randomUUID } = await import('crypto');
      const orderIdToInsert = randomUUID();
      
      // 🔧 CRÍTICO: Incluir todos los campos requeridos por la BD
      const orderDate = invoiceData.issueDate || invoiceData.issue_date || new Date().toISOString();
      const dueDate = invoiceData.dueDate || invoiceData.due_date || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      
      const orderData: any = {
        id: orderIdToInsert,
        user_id: userId,
        provider_id: providerId,
        order_number: orderNumber,
        items: items,
        status: 'pendiente_de_pago',
        total_amount: invoiceTotal,
        currency: invoiceData.currency || 'ARS',
        order_date: orderDate,
        due_date: dueDate,
        // Campos de factura
        invoice_data: invoiceData,
        invoice_number: invoiceData.invoiceNumber || invoiceData.invoice_number,
        invoice_currency: invoiceData.currency || 'ARS',
        invoice_date: invoiceData.issueDate || invoiceData.issue_date,
        extraction_confidence: invoiceData.confidence || 0.8,
        receipt_url: fileUrl,
        // Campos opcionales pero recomendados
        payment_method: invoiceData.paymentMethod || 'efectivo',
        notes: invoiceData.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // 🔧 LIMPIEZA: Remover campos undefined/null para evitar errores de BD
      // PERO mantener campos que pueden ser null explícitamente (como invoice_number)
      const cleanedOrderData: any = {};
      Object.keys(orderData).forEach(key => {
        const value = orderData[key];
        // Solo remover si es undefined, pero mantener null explícito
        if (value !== undefined) {
          cleanedOrderData[key] = value;
        }
      });
      
      console.log(`🔍 [${requestId}] DIAGNÓSTICO: Insertando orden en BD con ID:`, orderIdToInsert);
      console.log(`🔍 [${requestId}] DIAGNÓSTICO: Datos finales a insertar:`, JSON.stringify(cleanedOrderData, null, 2));
      
      const { data: order, error: orderError } = await supabaseService
        .from('orders')
        .insert([cleanedOrderData])
        .select('id')
        .single();

      if (orderError) {
        console.error(`❌ [${requestId}] DIAGNÓSTICO: ERROR creando orden:`, orderError);
        console.error(`❌ [${requestId}] DIAGNÓSTICO: Detalles del error:`, JSON.stringify(orderError, null, 2));
        console.error(`❌ [${requestId}] DIAGNÓSTICO: Código de error:`, orderError.code);
        console.error(`❌ [${requestId}] DIAGNÓSTICO: Mensaje de error:`, orderError.message);
        console.error(`❌ [${requestId}] DIAGNÓSTICO: Hint:`, orderError.hint);
        console.error(`❌ [${requestId}] DIAGNÓSTICO: Details:`, orderError.details);
        console.error(`❌ [${requestId}] DIAGNÓSTICO: Datos que se intentaron insertar:`, JSON.stringify(cleanedOrderData, null, 2));
        return undefined;
      }
      
      if (!order) {
        console.error(`❌ [${requestId}] DIAGNÓSTICO: No se recibió confirmación de creación de orden`);
        return undefined;
      }
      
      console.log(`✅ [${requestId}] DIAGNÓSTICO: Orden creada exitosamente en BD:`, {
        orderId: order.id,
        orderNumber
      });

      // Actualizar documento con order_id
      await supabaseService
        .from('documents')
        .update({ order_id: order.id })
        .eq('id', documentId);

      console.log(`✅ [${requestId}] Orden creada: ${order.id}`);
      
      // 🔧 RESTAURAR FLUJO ANTERIOR: Emitir broadcast manual como funcionaba antes
      // El broadcast manual funcionaba perfectamente antes del cambio
      try {
        const broadcastResult = await supabaseService
          .channel('orders-updates')
          .send({
            type: 'broadcast' as const,
            event: 'order_created',
            payload: {
              orderId: order.id,
              orderNumber: orderNumber,
              providerId: providerId,
              status: 'pendiente_de_pago',
              items: items,
              receiptUrl: fileUrl,
              totalAmount: invoiceTotal,
              currency: invoiceData.currency || 'ARS',
              invoiceNumber: invoiceData.invoiceNumber || invoiceData.invoice_number,
              invoiceDate: invoiceData.issueDate || invoiceData.issue_date,
              orderDate: orderDate,
              timestamp: new Date().toISOString(),
              source: 'invoice_auto_create'
            }
          });

        if (broadcastResult === 'error') {
          console.error(`⚠️ [${requestId}] Error enviando broadcast`);
        } else {
          console.log(`✅ [${requestId}] Broadcast de creación enviado (flujo anterior restaurado)`);
        }
      } catch (broadcastErr) {
        console.error(`⚠️ [${requestId}] Error en broadcast:`, broadcastErr);
      }
      
      return order.id;

    } catch (error) {
      console.error(`❌ [${requestId}] Error creando orden:`, error);
      return undefined;
    }
  }

  /**
   * 🔄 ACTUALIZAR ORDEN EXISTENTE CON FACTURA
   * 
   * @param supabaseClient - Cliente que dispara Realtime (NO service role key)
   */
  private async updateExistingOrder(
    orderId: string,
    documentId: string,
    invoiceData: any,
    fileUrl: string,
    requestId: string,
    supabaseClient: any // 🔧 CRÍTICO: Cliente que dispara Realtime
  ): Promise<string> {
    try {
      // Extraer monto
      let invoiceTotal = invoiceData.totalAmount || invoiceData.total_amount || 0;
      
      // 🔧 CORRECCIÓN: Extraer items de la factura pero NO actualizar el campo items de la orden
      // Los items de la factura solo se usan en la página de stock
      // El campo items de la orden debe mantener los items originales que el usuario ingresó al crear la orden
      const invoiceItems = invoiceData.items && invoiceData.items.length > 0
        ? invoiceData.items.map((item: any) => ({
            productName: item.description || item.name || 'Producto sin nombre',
            quantity: item.quantity || 1,
            unit: item.unit || 'un',
            price: item.unitPrice || item.price || 0,
            total: item.total || (item.unitPrice || item.price || 0) * (item.quantity || 1)
          }))
        : [];

      // Guardar los items de la factura en invoice_data para uso en stock
      if (!invoiceData.invoice_items) {
        invoiceData.invoice_items = invoiceItems;
      }

      // Obtener orden actual para comparar (usar service role para tener permisos)
      const supabaseService = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data: currentOrder } = await supabaseService
        .from('orders')
        .select('status, receipt_url, total_amount, invoice_number')
        .eq('id', orderId)
        .single();
      
      console.log(`🔍 [${requestId}] Estado actual de la orden:`, {
        status: currentOrder?.status,
        hasReceipt: !!currentOrder?.receipt_url,
        totalAmount: currentOrder?.total_amount
      });

      // Actualizar orden existente
      // 🔧 CRÍTICO: Asegurar que updated_at cambie para que Supabase detecte el cambio
      // 🔧 CORRECCIÓN: NO actualizar el campo items - mantener los items originales de la orden
      const newTimestamp = new Date().toISOString();
      const updateData: any = {
        status: 'pendiente_de_pago',
        invoice_data: invoiceData, // 🔧 Los items de la factura están aquí en invoice_data.invoice_items
        invoice_number: invoiceData.invoiceNumber || invoiceData.invoice_number,
        invoice_currency: invoiceData.currency || 'ARS',
        invoice_date: invoiceData.issueDate || invoiceData.issue_date,
        extraction_confidence: invoiceData.confidence || 0.8,
        receipt_url: fileUrl,
        updated_at: newTimestamp // 🔧 CRÍTICO: Siempre cambiar updated_at para disparar postgres_changes
      };

      // Actualizar monto si se encontró
      if (invoiceTotal && invoiceTotal > 0) {
        updateData.total_amount = invoiceTotal;
        updateData.invoice_total = invoiceTotal;
      }
      
      // 🔧 FORZAR CAMBIO: Agregar un campo dummy que siempre cambie para asegurar que postgres_changes se dispare
      // Usamos un campo que no afecte la lógica pero que garantice el cambio
      updateData.receipt_url = fileUrl; // Esto debería cambiar siempre
      
      console.log(`💾 [${requestId}] Actualizando orden en BD:`, {
        orderId,
        status: updateData.status,
        totalAmount: updateData.total_amount,
        receiptUrl: updateData.receipt_url,
        updatedAt: updateData.updated_at
      });
      
      // Actualizar con service role (tiene permisos)
      // Nota: supabaseService ya está definido arriba
      console.log(`🔍 [${requestId}] DIAGNÓSTICO: Intentando actualizar orden ${orderId} con datos:`, {
        status: updateData.status,
        receiptUrl: updateData.receipt_url,
        totalAmount: updateData.total_amount,
        invoiceNumber: updateData.invoice_number
      });
      
      const { data: updatedOrder, error: updateError } = await supabaseService
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single();

      if (updateError) {
        console.error(`❌ [${requestId}] Error actualizando orden:`, updateError);
        console.error(`❌ [${requestId}] Detalles del error:`, JSON.stringify(updateError, null, 2));
        throw updateError;
      }

      if (!updatedOrder) {
        console.error(`❌ [${requestId}] No se recibió confirmación de actualización`);
        throw new Error('No se recibió confirmación de actualización');
      }

      console.log(`✅ [${requestId}] DIAGNÓSTICO: Orden actualizada en BD exitosamente:`, {
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        receiptUrl: updatedOrder.receipt_url,
        totalAmount: updatedOrder.total_amount,
        invoiceNumber: updatedOrder.invoice_number,
        updatedAt: updatedOrder.updated_at
      });
      
      // 🔧 DIAGNÓSTICO: Verificar que la orden se actualizó correctamente
      const { data: verifyOrder, error: verifyError } = await supabaseService
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (verifyError) {
        console.error(`❌ [${requestId}] Error verificando orden actualizada:`, verifyError);
      } else {
        console.log(`🔍 [${requestId}] DIAGNÓSTICO: Verificación post-actualización:`, {
          orderId: verifyOrder.id,
          status: verifyOrder.status,
          receiptUrl: verifyOrder.receipt_url,
          totalAmount: verifyOrder.total_amount,
          invoiceNumber: verifyOrder.invoice_number,
          updatedAt: verifyOrder.updated_at
        });
      }
      
      // 🔧 CRÍTICO: Actualizar documento con order_id para asociar la factura a la orden
      console.log(`🔍 [${requestId}] DIAGNÓSTICO: Asociando documento ${documentId} a orden ${orderId}...`);
      const { data: updatedDocument, error: documentUpdateError } = await supabaseService
        .from('documents')
        .update({ 
          order_id: orderId,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
        .select('id, order_id')
        .single();

      if (documentUpdateError) {
        console.error(`❌ [${requestId}] Error actualizando documento con order_id:`, documentUpdateError);
        console.error(`❌ [${requestId}] Detalles del error:`, JSON.stringify(documentUpdateError, null, 2));
      } else {
        console.log(`✅ [${requestId}] Documento asociado exitosamente a orden:`, {
          documentId: updatedDocument?.id,
          orderId: updatedDocument?.order_id
        });
      }

      console.log(`✅ [${requestId}] Orden actualizada: ${orderId}`);
      
      // 🔧 RESTAURAR FLUJO ANTERIOR: Emitir broadcast manual como funcionaba antes
      // El broadcast manual funcionaba perfectamente antes del cambio
      try {
        const broadcastResult = await supabaseService
          .channel('orders-updates')
          .send({
            type: 'broadcast' as const,
            event: 'order_updated',
            payload: {
              orderId: orderId,
              status: updateData.status || 'pendiente_de_pago',
              receiptUrl: updateData.receipt_url,
              totalAmount: invoiceTotal,
              invoiceNumber: updateData.invoice_number,
              invoiceDate: updateData.invoice_date,
              timestamp: new Date().toISOString(),
              source: 'invoice_ocr'
            }
          });

        if (broadcastResult === 'error') {
          console.error(`⚠️ [${requestId}] Error enviando broadcast`);
        } else {
          console.log(`✅ [${requestId}] Broadcast de actualización enviado (flujo anterior restaurado)`);
        }
      } catch (broadcastErr) {
        console.error(`⚠️ [${requestId}] Error en broadcast:`, broadcastErr);
      }
      
      return orderId;

    } catch (error) {
      console.error(`❌ [${requestId}] Error actualizando orden:`, error);
      throw error;
    }
  }

  // 🔧 ELIMINADO: broadcastOrderUpdate - ya no se necesita
  // El postgres_changes se dispara automáticamente cuando usamos el cliente correcto (anon key)
}

export const kapsoDocumentProcessor = KapsoDocumentProcessor.getInstance();

