import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '../../../../lib/notificationService';
import { PhoneNumberService } from '../../../../lib/phoneNumberService';

// Verificar token de webhook (configurado en Meta Developer Console)
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token_here';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Verificación del webhook
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado exitosamente');
    return new NextResponse(challenge, { status: 200 });
  }

  console.log('❌ Verificación de webhook fallida');
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`📥 [${requestId}] ===== WEBHOOK RECIBIDO =====`);
    console.log(`📥 [${requestId}] Timestamp: ${new Date().toISOString()}`);
    
    const body = await request.json();
    console.log(`📥 [${requestId}] Body completo recibido:`, JSON.stringify(body, null, 2));

    // Verificar que es un mensaje de WhatsApp
    if (body.object === 'whatsapp_business_account') {
      console.log(`✅ [${requestId}] Webhook válido de WhatsApp Business Account`);
      
      const entry = body.entry?.[0];
      if (!entry?.changes?.[0]?.value) {
        return NextResponse.json({ status: 'ok', processed: false, requestId });
      }

      const value = entry.changes[0].value;
      let processedCount = 0;
      let errorCount = 0;

      // 🔧 NUEVA FUNCIONALIDAD: Procesar statuses (errores de delivery)
      if (value.statuses && Array.isArray(value.statuses)) {
        console.log(`📊 [${requestId}] Procesando ${value.statuses.length} statuses`);
        
        for (const status of value.statuses) {
          try {
            const result = await processWhatsAppStatus(status, requestId);
            if (result.success) {
              processedCount++;
            } else {
              errorCount++;
              console.error(`❌ [${requestId}] Error procesando status:`, result.error);
            }
          } catch (error) {
            errorCount++;
            console.error(`❌ [${requestId}] Error procesando status individual:`, error);
          }
        }
      }

      // 🔧 FUNCIONALIDAD EXISTENTE: Procesar mensajes
      if (value.messages && Array.isArray(value.messages)) {
        console.log(`📨 [${requestId}] Procesando ${value.messages.length} mensajes`);
        
        for (const message of value.messages) {
          try {
            console.log(`📨 [${requestId}] Procesando mensaje:`, JSON.stringify(message, null, 2));
            const result = await processWhatsAppMessage(message, requestId);
            if (result.success) {
              processedCount++;
              console.log(`✅ [${requestId}] Mensaje procesado exitosamente`);
            } else {
              errorCount++;
              console.error(`❌ [${requestId}] Error procesando mensaje:`, result.error);
            }
          } catch (error) {
            errorCount++;
            console.error(`❌ [${requestId}] Error procesando mensaje individual:`, error);
          }
        }
      } else {
        console.log(`ℹ️ [${requestId}] No hay mensajes en el webhook`);
      }

      // 🔧 NUEVA FUNCIONALIDAD: Procesar actualizaciones de template
      if (value.event === 'APPROVED' && value.message_template_name) {
        processedCount++;
      }

      if (processedCount === 0 && errorCount === 0) {
        console.log(`ℹ️ [${requestId}] No se procesó ningún contenido`);
      } else {
        console.log(`📊 [${requestId}] Procesados: ${processedCount}, Errores: ${errorCount}`);
      }
    } else {
      console.log(`❌ [${requestId}] Webhook no es de WhatsApp Business Account. Object:`, body.object);
    }

    const duration = Date.now() - startTime;
    
    return NextResponse.json({ 
      status: 'ok', 
      processed: true, 
      requestId: requestId,
      duration: duration 
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [${requestId}] Error procesando webhook:`, error);
    console.error(`💥 [${requestId}] WEBHOOK FALLÓ en ${duration}ms`);
    
    return NextResponse.json({ 
      error: 'Internal server error', 
      requestId: requestId,
      duration: duration 
    }, { status: 500 });
  }
}

// 🔧 NUEVA FUNCIÓN: Procesar statuses de WhatsApp (errores de delivery)
async function processWhatsAppStatus(status: any, requestId: string) {
  const statusStartTime = Date.now();
  
  try {
    const { id, status: statusType, timestamp, recipient_id, errors } = status;
    

    // 🔧 NUEVA FUNCIONALIDAD: Manejar errores de engagement
    if (statusType === 'failed' && errors && Array.isArray(errors)) {
      for (const error of errors) {
        if (error.code === 131047 || error.code === 131049) {

          // 🔧 ACTIVAR ESTRATEGIA DE ACTIVACIÓN MANUAL
          await handleEngagementError(recipient_id, error, requestId);
        }
      }
    }

    // 🔧 NUEVA FUNCIONALIDAD: Actualizar estado de mensaje en base de datos
    await updateMessageStatus(id, statusType, recipient_id, timestamp, errors, requestId);
    
    const duration = Date.now() - statusStartTime;
    
    return { success: true, duration: duration };
    
  } catch (error) {
    const duration = Date.now() - statusStartTime;
    
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

// 🔧 NUEVA FUNCIÓN: Manejar errores de engagement
async function handleEngagementError(recipientId: string, error: any, requestId: string) {
  try {
    console.log(`🔄 [${requestId}] Activando estrategia de activación manual para ${recipientId}`);
    
    // Buscar pedidos pendientes para este número
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar pedidos pendientes
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('provider_phone', recipientId)
      .eq('status', 'pending_confirmation')
      .order('created_at', { ascending: false })
      .limit(1);

    if (pendingError) {
      return;
    }

    if (pendingOrders && pendingOrders.length > 0) {
      const pendingOrder = pendingOrders[0];
      
      // Actualizar estado a "requiere activación manual"
      const { error: updateError } = await supabase
        .from('pending_orders')
        .update({ 
          status: 'manual_activation_required',
          notes: `Error de engagement (${error.code}): ${error.title}. El proveedor debe iniciar contacto.`
        })
        .eq('id', pendingOrder.id);

      if (updateError) {
      } else {
      }
    } else {
    }

  } catch (error) {
  }
}

// 🔧 NUEVA FUNCIÓN: Actualizar estado de mensaje en base de datos
async function updateMessageStatus(
  messageId: string, 
  status: string, 
  recipientId: string, 
  timestamp: string, 
  errors?: any[], 
  requestId?: string
) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString()
    };

    // Agregar información de errores si existen
    if (errors && errors.length > 0) {
      updateData.error_details = JSON.stringify(errors);
    }

    const { error } = await supabase
      .from('whatsapp_messages')
      .update(updateData)
      .eq('message_sid', messageId);

    if (error) {
      console.error(`❌ [${requestId}] Error actualizando estado de mensaje:`, error);
    } else {
      console.log(`✅ [${requestId}] Estado de mensaje ${messageId} actualizado a ${status}`);
    }

  } catch (error) {
    console.error(`❌ [${requestId}] Error en updateMessageStatus:`, error);
  }
}

async function processWhatsAppMessage(message: any, requestId: string) {
  const messageStartTime = Date.now();
  
  try {
    const { from, text, image, document, timestamp } = message;
    
    // Normalizar número de teléfono
    let normalizedFrom = from;
    if (from && !from.startsWith('+')) {
      normalizedFrom = `+${from}`;
    }
    
    // 🔧 DEBUG: Log completo del mensaje recibido
    console.log(`📨 [${requestId}] Mensaje completo recibido:`, JSON.stringify(message, null, 2));
    console.log(`🔍 [${requestId}] Tipos de contenido detectados:`, {
      hasText: !!text,
      hasImage: !!image,
      hasDocument: !!document,
      from: from,
      normalizedFrom: normalizedFrom
    });

    // 🔧 SISTEMA SIMPLIFICADO: Procesar archivos multimedia
    if (image || document) {
      console.log(`📎 [${requestId}] ===== PROCESANDO DOCUMENTO =====`);
      console.log(`📎 [${requestId}] Image presente:`, !!image);
      console.log(`📎 [${requestId}] Document presente:`, !!document);
      
      try {
        // Obtener userId del proveedor
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const { data: provider } = await supabase
          .from('providers')
          .select('user_id, id, name')
          .eq('phone', normalizedFrom)
          .single();
        
        if (!provider) {
          console.log(`⚠️ [${requestId}] Proveedor no encontrado para teléfono: ${normalizedFrom}`);
          const duration = Date.now() - messageStartTime;
          return { success: false, error: 'Proveedor no encontrado', duration: duration, type: 'document_error' };
        }
        
        const mediaData = image || document;
        console.log(`📎 [${requestId}] Procesando documento del proveedor: ${provider.name}`);
        
        // Procesar documento con flujo simplificado
        const result = await processWhatsAppDocument(normalizedFrom, mediaData, requestId, provider.user_id, provider.id);
        
        if (result.success) {
          console.log(`✅ [${requestId}] Documento procesado exitosamente:`, result.document_id);
          const duration = Date.now() - messageStartTime;
          return { success: true, duration: duration, type: 'document', document_id: result.document_id };
        } else {
          console.log(`❌ [${requestId}] Error procesando documento:`, result.error);
          const duration = Date.now() - messageStartTime;
          return { success: false, error: result.error, duration: duration, type: 'document_error' };
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error procesando documento:`, error);
        const duration = Date.now() - messageStartTime;
        return { success: false, error: 'Error procesando documento', duration: duration, type: 'document_error' };
      }
    } else {
      console.log(`📎 [${requestId}] No hay archivos multimedia en el mensaje`);
    }

    // 🔧 FUNCIONALIDAD EXISTENTE: Guardar mensaje con user_id asignado
    // Solo guardar mensaje si hay contenido de texto
    if (text?.body) {
      const saveResult = await saveMessageWithUserId(normalizedFrom, text.body, timestamp, requestId);
      
      if (saveResult.success) {
        console.log(`✅ [${requestId}] Mensaje guardado con user_id: ${saveResult.userId}`);
      } else {
        console.log(`❌ [${requestId}] Error guardando mensaje: ${saveResult.error}`);
        return { success: false, error: saveResult.error };
      }
    } else {
      console.log(`ℹ️ [${requestId}] No hay contenido de texto para guardar`);
    }

    // 🔧 CORRECCIÓN: Solo procesar flujo de órdenes para estados específicos
    // NO procesar para esperando_factura con mensajes de texto
    if (text?.body && !image && !document) {
      console.log(`📝 [${requestId}] Mensaje de texto recibido del proveedor:`, normalizedFrom);
      
      try {
        // Verificar si hay órdenes en estado esperando_factura para este proveedor
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const { data: provider } = await supabase
          .from('providers')
          .select('id, user_id')
          .eq('phone', normalizedFrom)
          .single();
        
        if (provider) {
          // Procesar flujo normal - permitir nuevas órdenes incluso si hay facturas pendientes
          console.log(`🔄 [${requestId}] Procesando respuesta del proveedor con OrderFlowService:`, normalizedFrom);
          console.log(`🔍 [${requestId}] Datos del proveedor:`, {
            id: provider.id,
            userId: provider.user_id
          });
          
          const userId = provider.user_id;
          const { ExtensibleOrderFlowService } = await import('../../../../lib/extensibleOrderFlowService');
          const extensibleOrderFlowService = ExtensibleOrderFlowService.getInstance();
          
          console.log(`🚀 [${requestId}] Llamando a processProviderMessage con:`, {
            phone: normalizedFrom,
            message: text.body,
            userId: userId
          });
          
          const result = await extensibleOrderFlowService.processProviderMessage(normalizedFrom, text.body, userId);
          
          console.log(`📊 [${requestId}] Resultado del ExtensibleOrderFlowService:`, result);
          
          if (result.success) {
            console.log(`✅ [${requestId}] Flujo procesado: ${result.newStatus}`);
          } else {
            console.log(`⚠️ [${requestId}] Flujo no procesado: ${result.message || result.errors?.join(', ')}`);
          }
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error procesando flujo de órdenes:`, error);
      }
    } else if (!image && !document) {
      console.log(`ℹ️ [${requestId}] Mensaje sin contenido de texto, imagen o documento`);
    }
    
    const duration = Date.now() - messageStartTime;
    
    return { success: true, duration: duration, type: 'text' };
    
  } catch (error) {
    const duration = Date.now() - messageStartTime;
    
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

// 🔧 NUEVA FUNCIÓN: Procesar archivos multimedia como facturas
// ❌ DESHABILITADA: Usar solo el nuevo sistema de documentos
async function processMediaAsInvoice(providerPhone: string, media: any, requestId: string, userId?: string) {
  // ❌ SISTEMA VIEJO DESHABILITADO - usar solo processDocumentWithNewSystem
  console.log(`❌ [${requestId}] Sistema viejo deshabilitado - usar solo nuevo sistema de documentos`);
  return { success: false, error: 'Sistema viejo deshabilitado' };
  
  /* COMENTADO - SISTEMA VIEJO
  try {
    console.log(`📎 [${requestId}] Procesando archivo multimedia como factura...`);
    console.log(`📱 [${requestId}] Número de teléfono recibido:`, providerPhone);
    
    // Obtener URL del archivo desde WhatsApp
    let mediaUrl = '';
    let mediaType = '';
    
    console.log(`🔍 [${requestId}] Estructura del mensaje multimedia:`, JSON.stringify(media, null, 2));
    
    if (media.image) {
      mediaUrl = media.image.link || media.image.url || media.image.id;
      mediaType = 'image';
      console.log(`🖼️ [${requestId}] Imagen detectada:`, { link: media.image.link, url: media.image.url, id: media.image.id });
    } else if (media.document) {
      mediaUrl = media.document.link || media.document.url || media.document.id;
      mediaType = media.document.mime_type || 'document';
      console.log(`📄 [${requestId}] Documento detectado:`, { link: media.document.link, url: media.document.url, id: media.document.id });
    }
    
    // Intentar obtener URL de diferentes ubicaciones posibles
    if (!mediaUrl) {
      // Buscar en campos alternativos
      if (media.id) {
        mediaUrl = `https://graph.facebook.com/v18.0/${media.id}`;
        console.log(`🔗 [${requestId}] Usando ID como URL alternativa:`, mediaUrl);
      } else {
        console.log(`❌ [${requestId}] No se pudo obtener URL del archivo. Estructura:`, JSON.stringify(media, null, 2));
        return { success: false, error: 'No se pudo obtener URL del archivo' };
      }
    }
    
    console.log(`📎 [${requestId}] Archivo detectado:`, { mediaUrl, mediaType, providerPhone });
    
    // Buscar proveedor por número de teléfono
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // 🔧 MEJORA: Búsqueda más robusta de proveedores con timeout
    const { PhoneNumberService } = await import('../../../../lib/phoneNumberService');
    
    // Normalizar el número recibido
    const normalizedPhone = PhoneNumberService.normalizeUnified(providerPhone);
    console.log(`🔧 [${requestId}] Número normalizado:`, normalizedPhone);
    
    // Generar variantes de búsqueda
    const searchVariants = PhoneNumberService.searchVariants(providerPhone);
    console.log(`🔍 [${requestId}] Variantes de búsqueda:`, searchVariants);
    
    // 🔧 MEJORA: Búsqueda más eficiente con timeout
    let provider = null;
    const searchStartTime = Date.now();
    const SEARCH_TIMEOUT = 8000; // 8 segundos máximo para búsqueda
    
    // Primero intentar con búsqueda exacta por cada variante
    for (const variant of searchVariants) {
      if (Date.now() - searchStartTime > SEARCH_TIMEOUT) {
        console.warn(`⚠️ [${requestId}] Timeout en búsqueda de proveedores`);
        break;
      }
      
      console.log(`🔍 [${requestId}] Buscando proveedor con variante:`, variant);
      
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('id, name, phone, cuit_cuil')
        .eq('phone', variant)
        .single();
      
      if (!providerError && providerData) {
        provider = providerData;
        console.log(`✅ [${requestId}] Proveedor encontrado con búsqueda exacta:`, provider.name, `(${provider.phone})`);
        break;
      }
    }
    
    // 🔧 MEJORA: Si no se encuentra, intentar búsqueda más flexible con timeout
    if (!provider && (Date.now() - searchStartTime < SEARCH_TIMEOUT)) {
      console.log(`⚠️ [${requestId}] No se encontró proveedor con búsqueda exacta, intentando búsqueda flexible...`);
      
      // Búsqueda por similitud de números (últimos 8-10 dígitos)
      const lastDigits = providerPhone.replace(/\D/g, '').slice(-8);
      if (lastDigits.length >= 8) {
        console.log(`🔍 [${requestId}] Buscando por últimos dígitos:`, lastDigits);
        
        const { data: providers, error: searchError } = await supabase
          .from('providers')
          .select('id, name, phone')
          .or(`phone.ilike.%${lastDigits},phone.ilike.${lastDigits}%`)
          .limit(3); // 🔧 MEJORA: Limitar resultados para evitar timeouts
        
        if (!searchError && providers && providers.length > 0) {
          // Encontrar la mejor coincidencia
          const bestMatch = providers.find(p => {
            const providerDigits = p.phone.replace(/\D/g, '').slice(-8);
            return providerDigits === lastDigits;
          });
          
          if (bestMatch) {
            provider = bestMatch;
            console.log(`✅ [${requestId}] Proveedor encontrado con búsqueda flexible:`, provider.name, `(${provider.phone})`);
          }
        }
      }
    }
    
    // 🔧 MEJORA: Si aún no se encuentra, mostrar información de debug
    if (!provider) {
      console.log(`❌ [${requestId}] No se pudo encontrar proveedor después de ${Date.now() - searchStartTime}ms. Información de debug:`);
      console.log(`📱 [${requestId}] Número recibido:`, providerPhone);
      console.log(`🔧 [${requestId}] Número normalizado:`, normalizedPhone);
      console.log(`🔍 [${requestId}] Variantes de búsqueda:`, searchVariants);
      
      // 🔧 MEJORA: Intentar obtener solo los primeros 3 proveedores para debug (más rápido)
      const { data: allProviders, error: debugError } = await supabase
        .from('providers')
        .select('id, name, phone')
        .limit(3);
      
      if (!debugError && allProviders) {
        console.log(`🔍 [${requestId}] Primeros 3 proveedores en BD:`, allProviders.map(p => ({ name: p.name, phone: p.phone })));
      }
      
      return { success: false, error: 'Proveedor no encontrado' };
    }
    
    // Buscar orden en estado esperando_factura más reciente del proveedor
    const { data: latestOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, status, user_id')
      .eq('provider_id', provider.id)
      .eq('status', 'esperando_factura')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (orderError || !latestOrder || latestOrder.length === 0) {
      console.log(`⚠️ [${requestId}] No se encontraron órdenes esperando factura para proveedor:`, provider.name);
      return { success: false, error: 'No se encontraron órdenes esperando factura para este proveedor' };
    }
    
    const orderToUpdate = latestOrder[0];
    console.log(`📋 [${requestId}] Orden pendiente encontrada:`, orderToUpdate.order_number);
    
    // Descargar archivo desde WhatsApp y subirlo a Supabase Storage
    const { data: fileBuffer, error: downloadError } = await downloadMediaFromWhatsApp(mediaUrl, requestId);
    
    if (downloadError || !fileBuffer) {
      return { success: false, error: 'Error descargando archivo desde WhatsApp' };
    }
    
    // Generar nombre único para el archivo
    const fileName = `invoice_${Date.now()}_${provider.id}_${orderToUpdate.order_number}.${mediaType === 'image' ? 'jpg' : 'pdf'}`;
    const filePath = `invoices/${provider.id}/${fileName}`;
    
    // 🔧 MEJORA: Usar servicio de storage robusto con verificación automática de bucket
    const { SupabaseStorageService } = await import('../../../../lib/supabaseStorageService');
    const storageService = new SupabaseStorageService(requestId);
    
    // Subir archivo usando el servicio robusto
    const uploadResult = await storageService.uploadFileWithBucketCheck(
      'files', // Usar bucket existente
      filePath,
      fileBuffer,
      {
        contentType: mediaType === 'image' ? 'image/jpeg' : 'application/pdf',
        cacheControl: '3600'
      }
    );
    
    if (!uploadResult.success) {
      console.error(`❌ [${requestId}] Error subiendo archivo a Supabase:`, uploadResult.error);
      return { success: false, error: `Error subiendo archivo: ${uploadResult.error}` };
    }
    
    const publicUrl = uploadResult.fileUrl;
    console.log(`✅ [${requestId}] Archivo subido exitosamente a Supabase:`, publicUrl);
    
    // 🔧 NUEVO: Extraer datos de la factura si es PDF
    let extractedData = null;
    if (mediaType === 'application/pdf' || fileName.endsWith('.pdf')) {
      try {
        console.log(`🔍 [${requestId}] Extrayendo datos del PDF...`);
        
        // Importar servicio de extracción simplificado
        const { simpleInvoiceExtraction } = require('../../../../lib/simpleInvoiceExtraction.js');
        
        // 🔧 NUEVO: Extraer texto real del PDF
        let extractedText = '';
        
        try {
          console.log(`🔍 [${requestId}] Extrayendo texto del PDF...`);
          console.log(`🔍 [${requestId}] FileBuffer size:`, fileBuffer?.length || 'undefined');
          console.log(`🔍 [${requestId}] FileName:`, fileName);
          console.log(`🔍 [${requestId}] MediaType:`, mediaType);
          
          // Verificar que el buffer no esté vacío
          if (!fileBuffer || fileBuffer.length === 0) {
            throw new Error('FileBuffer está vacío o no se descargó correctamente');
          }
          
          // 🔧 INTENTO 1: pdf-parse
          try {
            const pdfParse = require('pdf-parse');
            
            // Crear un buffer limpio para evitar problemas de referencia
            const cleanBuffer = Buffer.from(fileBuffer);
            console.log(`📄 [${requestId}] Intentando parsear PDF de ${cleanBuffer.length} bytes...`);
            
            const pdfData = await pdfParse(cleanBuffer);
            extractedText = pdfData.text;
            
            if (extractedText && extractedText.trim()) {
              console.log(`✅ [${requestId}] Texto extraído con pdf-parse (${extractedText.length} caracteres):`, extractedText.substring(0, 200) + '...');
            } else {
              throw new Error('pdf-parse no extrajo texto válido');
            }
            
          } catch (pdfParseError) {
            console.warn(`⚠️ [${requestId}] pdf-parse falló:`, pdfParseError.message);
            
            // 🔧 MEJORA: Si es un error de archivo de prueba, intentar de nuevo con configuración diferente
            if (pdfParseError.message.includes('05-versions-space.pdf') || pdfParseError.message.includes('ENOENT')) {
              console.log(`🔄 [${requestId}] Error de archivo de prueba detectado, intentando solución alternativa...`);
              
              try {
                // Intentar con una configuración diferente
                const pdfParse = require('pdf-parse');
                const pdfData = await pdfParse(Buffer.from(fileBuffer), {
                  // Configuración específica para evitar problemas de archivos de prueba
                  max: 0, // Sin límite de páginas
                  version: 'v1.10.100' // Versión específica
                });
                extractedText = pdfData.text;
                
                if (extractedText && extractedText.trim()) {
                  console.log(`✅ [${requestId}] Texto extraído con pdf-parse (segundo intento, ${extractedText.length} caracteres):`, extractedText.substring(0, 200) + '...');
                } else {
                  throw new Error('Segundo intento de pdf-parse no extrajo texto válido');
                }
                
              } catch (secondError) {
                console.warn(`⚠️ [${requestId}] Segundo intento de pdf-parse falló:`, secondError.message);
                throw new Error(`pdf-parse falló: ${pdfParseError.message}`);
              }
            } else {
              throw new Error(`pdf-parse falló: ${pdfParseError.message}`);
            }
          }
          
        } catch (extractionError) {
          console.error(`❌ [${requestId}] Error extrayendo texto del PDF (pdf-parse + OCR fallaron):`, extractionError);
          
          // Fallback: usar texto simulado si fallan ambos métodos
          const providerCuit = provider.cuit_cuil || '20143089984';
          extractedText = `
            FACTURA A
            Número: 0001-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}
            Fecha: ${new Date().toLocaleDateString('es-AR')}
            Proveedor: ${provider.name}
            CUIT: ${providerCuit}
            Total: $${orderToUpdate.total_amount || 15000}
            Moneda: ARS
          `;
          
          console.log(`⚠️ [${requestId}] ⚠️ ATENCIÓN: Usando texto simulado como fallback final`);
          console.log(`⚠️ [${requestId}] ⚠️ Esto indica que el PDF está corrupto o es inválido`);
          console.log(`⚠️ [${requestId}] ⚠️ El archivo descargado no se puede procesar correctamente`);
        }
        
        const extractionResult = await simpleInvoiceExtraction.extractFromText(extractedText, fileName);
        
        if (extractionResult && extractionResult.success && extractionResult.data) {
          extractedData = extractionResult.data;
          console.log(`✅ [${requestId}] Datos extraídos:`, {
            invoiceNumber: extractedData.invoiceNumber,
            totalAmount: extractedData.totalAmount,
            currency: extractedData.currency,
            confidence: extractionResult.confidence,
            providerTaxId: extractedData.providerTaxId
          });
          
          // 🔧 VALIDACIÓN DE CUIT: Verificar que el CUIT de la factura coincida con el proveedor
          if (extractedData.providerTaxId && provider.cuit_cuil) {
            const invoiceCuit = extractedData.providerTaxId.replace(/\D/g, ''); // Remover caracteres no numéricos
            const providerCuit = provider.cuit_cuil.replace(/\D/g, ''); // Remover caracteres no numéricos
            
            console.log(`🔍 [${requestId}] Validando CUIT:`, {
              invoiceCuit: invoiceCuit,
              providerCuit: providerCuit,
              match: invoiceCuit === providerCuit
            });
            
            // 🔧 MEJORA: Validación más flexible - verificar si el CUIT de la factura está contenido en el CUIT del proveedor
            const isCuitValid = invoiceCuit === providerCuit || 
                               providerCuit.includes(invoiceCuit) || 
                               invoiceCuit.includes(providerCuit.substring(0, 11));
            
            if (!isCuitValid) {
              console.log(`❌ [${requestId}] CUIT no coincide. Factura rechazada.`);
              return { 
                success: false, 
                error: `El CUIT de la factura (${invoiceCuit}) no coincide con el CUIT del proveedor (${providerCuit}). Por favor, envíe la factura correcta.` 
              };
            } else {
              console.log(`✅ [${requestId}] CUIT validado correctamente`);
            }
          } else {
            console.log(`⚠️ [${requestId}] No se pudo validar CUIT - datos faltantes:`, {
              hasInvoiceCuit: !!extractedData.providerTaxId,
              hasProviderCuit: !!provider.cuit_cuil
            });
            
            // En producción, rechazar facturas sin CUIT válido
            if (!extractedData.providerTaxId) {
              return { 
                success: false, 
                error: 'No se pudo extraer el CUIT de la factura. Por favor, envíe una factura con CUIT visible y legible.' 
              };
            }
          }
        } else {
          console.log(`⚠️ [${requestId}] No se pudieron extraer datos del PDF:`, extractionResult.error);
          return { 
            success: false, 
            error: 'No se pudieron extraer datos de la factura. Por favor, envíe una factura legible con datos claros.' 
          };
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error extrayendo datos del PDF:`, error);
        return { 
          success: false, 
          error: 'Error interno procesando la factura. Por favor, intente nuevamente.' 
        };
      }
    }

    // Asociar factura a la orden con datos extraídos
    const updateData: any = {
      receipt_url: publicUrl,
      status: 'pendiente_de_pago',
      updated_at: new Date().toISOString()
    };

    // Agregar datos extraídos si están disponibles
    if (extractedData) {
      updateData.invoice_data = extractedData;
      updateData.invoice_number = extractedData.invoiceNumber;
      updateData.invoice_total = extractedData.totalAmount;
      updateData.invoice_currency = extractedData.currency;
      updateData.invoice_date = extractedData.issueDate;
      updateData.invoice_due_date = extractedData.dueDate;
      updateData.extraction_confidence = extractedData.confidence;
      
      // 🔧 NUEVO: Actualizar el monto total de la orden con el monto real de la factura
      if (extractedData.totalAmount && extractedData.totalAmount > 0) {
        updateData.total_amount = extractedData.totalAmount;
        console.log(`✅ [${requestId}] Actualizando monto de orden: $${orderToUpdate.total_amount} → $${extractedData.totalAmount}`);
      }
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderToUpdate.id);
    
    if (updateError) {
      console.error(`❌ [${requestId}] Error asociando factura a orden:`, updateError);
      return { success: false, error: 'Error asociando factura a orden' };
    }
    
    console.log(`✅ [${requestId}] Factura asociada exitosamente a orden ${orderToUpdate.order_number}`);
    
    // 🔧 NUEVA FUNCIONALIDAD: Generar datos de pago automáticamente
    if (extractedData && extractedData.totalAmount) {
      try {
        console.log(`💳 [${requestId}] Generando datos de pago automáticamente...`);
        
        const { paymentDataService } = require('../../../../lib/paymentDataService.js');
        
        // Crear cliente Supabase para el servicio
        const { createClient } = require('@supabase/supabase-js');
        const serviceSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const paymentResult = await paymentDataService.generatePaymentData(orderToUpdate.id, userId, serviceSupabase);
        
        if (paymentResult.success) {
          console.log(`✅ [${requestId}] Datos de pago generados:`, {
            amount: paymentResult.data.amount,
            currency: paymentResult.data.currency,
            paymentMethod: paymentResult.data.paymentMethod
          });
          
          // Actualizar la orden con los datos de pago
          await paymentDataService.updateOrderWithPaymentData(
            orderToUpdate.id, 
            orderToUpdate.user_id, 
            paymentResult.data,
            serviceSupabase
          );
          
          console.log(`✅ [${requestId}] Orden actualizada con datos de pago generados`);
        } else {
          console.warn(`⚠️ [${requestId}] Error generando datos de pago:`, paymentResult.error);
        }
      } catch (paymentError) {
        console.error(`❌ [${requestId}] Error en generación automática de datos de pago:`, paymentError);
        // No fallar el webhook por este error, solo loggearlo
      }
    }
    
    // 🔧 NUEVA FUNCIONALIDAD: Guardar mensaje de factura en el chat
    try {
      const messageSid = `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 🔧 CORRECCIÓN: Buscar el user_id del proveedor para asociar el mensaje correctamente
      const { data: providerUser, error: userError } = await supabase
        .from('providers')
        .select('user_id')
        .eq('id', provider.id)
        .single();
      
      if (userError || !providerUser?.user_id) {
        console.error(`❌ [${requestId}] Error obteniendo user_id del proveedor:`, userError);
        return { success: false, error: 'No se pudo obtener usuario del proveedor' };
      }
      
      const { error: messageError } = await supabase
        .from('whatsapp_messages')
        .insert([{
          content: `📎 Factura recibida para orden ${orderToUpdate.order_number}`,
          message_type: 'received',
          status: 'delivered',
          contact_id: providerPhone,
          user_id: providerUser.user_id, // 🔧 CORRECCIÓN: Asociar al usuario correcto
          message_sid: messageSid,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString()
        }]);
      
      if (messageError) {
        console.error(`❌ [${requestId}] Error guardando mensaje de factura:`, messageError);
      } else {
        console.log(`✅ [${requestId}] Mensaje de factura guardado en chat:`, messageSid);
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Error guardando mensaje de factura:`, error);
    }
    
    return {
      success: true,
      orderId: orderToUpdate.id,
      orderNumber: orderToUpdate.order_number,
      fileUrl: publicUrl
    };
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error en processMediaAsInvoice:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
  */ // FIN DEL SISTEMA VIEJO COMENTADO
}

// 🔧 FUNCIÓN AUXILIAR: Descargar archivo desde WhatsApp
async function downloadMediaFromWhatsApp(mediaUrl: string, requestId: string) {
  try {
    console.log(`📥 [${requestId}] Descargando archivo desde WhatsApp:`, mediaUrl);
    
    // Obtener token de acceso de WhatsApp
    const accessToken = process.env.WHATSAPP_API_KEY;
    if (!accessToken) {
      console.error(`❌ [${requestId}] Token de WhatsApp no configurado`);
      return { data: null, error: 'Token de WhatsApp no configurado' };
    }
    
    // 🔧 MEJORA: Validar URL antes de descargar
    if (!mediaUrl || !mediaUrl.startsWith('http')) {
      console.error(`❌ [${requestId}] URL de archivo inválida:`, mediaUrl);
      return { data: null, error: 'URL de archivo inválida' };
    }
    
    console.log(`🔐 [${requestId}] Iniciando descarga con token:`, accessToken.substring(0, 10) + '...');
    
    // Descargar archivo con timeout y headers apropiados
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
    
    try {
      const response = await fetch(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'GastronomySaaS/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No se pudo leer respuesta');
        console.error(`❌ [${requestId}] Error HTTP ${response.status} descargando archivo:`, errorText);
        return { data: null, error: `Error HTTP ${response.status}: ${response.statusText}` };
      }
      
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      console.log(`📊 [${requestId}] Respuesta recibida:`, {
        status: response.status,
        contentType,
        contentLength: contentLength ? `${contentLength} bytes` : 'Desconocido'
      });
      
      // 🔧 MEJORA: Validar tipo de contenido
      if (contentType && !contentType.includes('image') && !contentType.includes('pdf') && !contentType.includes('application')) {
        console.warn(`⚠️ [${requestId}] Tipo de contenido inesperado:`, contentType);
      }
      
      // 🔧 CORREGIDO: Si es JSON, extraer URL del archivo real
      if (contentType && contentType.includes('application/json')) {
        console.log(`📋 [${requestId}] WhatsApp devolvió JSON con metadata del archivo. Extrayendo URL real...`);
        
        // Leer el contenido JSON para extraer la URL real
        try {
          const jsonContent = await response.text();
          console.log(`🔍 [${requestId}] Contenido JSON recibido:`, jsonContent);
          
          const jsonData = JSON.parse(jsonContent);
          
          // Verificar si tiene la URL del archivo real
          if (jsonData.url && jsonData.mime_type && jsonData.file_size) {
            console.log(`✅ [${requestId}] URL real del archivo encontrada:`, jsonData.url);
            console.log(`📊 [${requestId}] Metadata del archivo:`, {
              mime_type: jsonData.mime_type,
              file_size: jsonData.file_size,
              sha256: jsonData.sha256
            });
            
            // Descargar el archivo real desde la URL extraída
            console.log(`📥 [${requestId}] Descargando archivo real desde URL:`, jsonData.url);
            
            const realResponse = await fetch(jsonData.url, {
              headers: {
                'User-Agent': 'GastronomySaaS/1.0',
                'Authorization': `Bearer ${accessToken}`
              }
            });
            
            if (!realResponse.ok) {
              console.error(`❌ [${requestId}] Error descargando archivo real:`, realResponse.status, realResponse.statusText);
              return { data: null, error: `Error descargando archivo real: ${realResponse.status}` };
            }
            
            const realArrayBuffer = await realResponse.arrayBuffer();
            const realBuffer = Buffer.from(realArrayBuffer);
            
            console.log(`✅ [${requestId}] Archivo real descargado exitosamente:`, {
              bytes: realBuffer.length,
              kilobytes: (realBuffer.length / 1024).toFixed(2),
              expected_size: jsonData.file_size
            });
            
            return { data: realBuffer, error: null };
            
          } else {
            console.warn(`⚠️ [${requestId}] JSON no contiene URL de archivo válida`);
            return { 
              data: null, 
              error: `JSON no contiene URL de archivo válida: ${jsonContent.substring(0, 200)}` 
            };
          }
          
        } catch (jsonError) {
          console.error(`❌ [${requestId}] Error procesando JSON:`, jsonError);
          return { 
            data: null, 
            error: 'Error procesando JSON de WhatsApp' 
          };
        }
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log(`✅ [${requestId}] Archivo descargado exitosamente:`, {
        bytes: buffer.length,
        kilobytes: (buffer.length / 1024).toFixed(2),
        contentType
      });
      
      return { data: buffer, error: null };
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error(`⏰ [${requestId}] Timeout descargando archivo (30s)`);
        return { data: null, error: 'Timeout descargando archivo' };
      }
      
      throw fetchError;
    }
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error descargando archivo:`, error);
    
    // 🔧 MEJORA: Clasificar tipos de error
    let errorMessage = 'Error desconocido descargando archivo';
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = 'Error de red al descargar archivo';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Timeout al descargar archivo';
      } else if (error.message.includes('unauthorized')) {
        errorMessage = 'No autorizado para descargar archivo';
      } else {
        errorMessage = error.message;
      }
    }
    
    return { data: null, error: errorMessage };
  }
}

// 🔧 FUNCIÓN ELIMINADA: sendInvoiceConfirmation ya no se usa
// Se eliminó para simplificar el flujo y evitar confirmaciones innecesarias

// 🔧 FUNCIÓN MEJORADA: Guardar mensaje con user_id asignado automáticamente
async function saveMessageWithUserId(contactId: string, content: string, timestamp: string, requestId: string) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error(`❌ [${requestId}] Variables de entorno faltantes para guardar mensaje`);
      return { success: false, error: 'Variables de entorno faltantes' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 🔧 MEJORA: Usar normalización unificada para búsquedas
    const { PhoneNumberService } = await import('../../../../lib/phoneNumberService');
    const searchVariants = PhoneNumberService.searchVariants(contactId);
    
    // 🔧 MEJORA: Log del número normalizado esperado para debugging
    const expectedNormalized = PhoneNumberService.normalizeUnified(contactId);
    console.log(`🔍 [${requestId}] Número normalizado esperado para búsqueda:`, expectedNormalized);
    console.log(`🔍 [${requestId}] Variantes de búsqueda:`, searchVariants);
    
    let userId = null;
    
    // 🔧 MEJORA: Búsqueda más robusta de proveedores
    if (searchVariants.length > 0) {
      // Buscar por cada variante hasta encontrar un proveedor
      for (const variant of searchVariants) {
        console.log(`🔍 [${requestId}] Buscando proveedor con variante:`, variant);
        
        const { data: provider, error: providerError } = await supabase
          .from('providers')
          .select('user_id, phone, name')
          .eq('phone', variant)
          .single();
        
        if (!providerError && provider) {
          userId = provider.user_id;
          console.log(`✅ [${requestId}] Proveedor encontrado:`, provider.name, `(${provider.phone}) - User ID:`, userId);
          break;
        }
      }
    }
    
    // 🔧 MEJORA: Si no se encuentra, intentar búsqueda más flexible
    if (!userId) {
      console.log(`⚠️ [${requestId}] No se encontró proveedor con búsqueda exacta, intentando búsqueda flexible...`);
      
      // Búsqueda por similitud de números (últimos 8-10 dígitos)
      const lastDigits = contactId.replace(/\D/g, '').slice(-8);
      if (lastDigits.length >= 8) {
        console.log(`🔍 [${requestId}] Buscando por últimos dígitos:`, lastDigits);
        
        const { data: providers, error: searchError } = await supabase
          .from('providers')
          .select('user_id, phone, name')
          .or(`phone.ilike.%${lastDigits},phone.ilike.${lastDigits}%`);
        
        if (!searchError && providers && providers.length > 0) {
          // Encontrar la mejor coincidencia
          const bestMatch = providers.find(p => {
            const providerDigits = p.phone.replace(/\D/g, '').slice(-8);
            return providerDigits === lastDigits;
          });
          
          if (bestMatch) {
            userId = bestMatch.user_id;
            console.log(`✅ [${requestId}] Proveedor encontrado con búsqueda flexible:`, bestMatch.name, `(${bestMatch.phone}) - User ID:`, userId);
          }
        }
      }
    }

    if (!userId) {
      console.log(`⚠️ [${requestId}] No se encontró usuario de la app para proveedor ${contactId}`);
      // 🔧 NUEVA FUNCIONALIDAD: Si no se encuentra usuario, guardar con user_id null para que aparezca en el filtro
      console.log(`📝 [${requestId}] Guardando mensaje con user_id=null para que aparezca en el filtro de realtime`);
    } else {
      console.log(`✅ [${requestId}] Encontrado usuario de la app ${userId} para proveedor ${contactId}`);
    }

    // 🔧 CORRECCIÓN: Guardar mensaje con el user_id correcto del proveedor
    const messageSid = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Si encontramos el userId del proveedor, usarlo; si no, usar null para que aparezca en el filtro
    const finalUserId = userId || null;
    
    const { error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert([{
        content: content,
        message_type: 'received',
        status: 'delivered',
        contact_id: contactId, // Número del proveedor
        user_id: finalUserId, // Usar el userId del proveedor si se encuentra
        message_sid: messageSid,
        timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
        created_at: new Date().toISOString()
      }]);

    if (saveError) {
      console.error(`❌ [${requestId}] Error guardando mensaje:`, saveError);
      return { success: false, error: saveError.message };
    } else {
      console.log(`✅ [${requestId}] Mensaje guardado con user_id: ${finalUserId}`);
      console.log(`📝 [${requestId}] Message SID: ${messageSid}`);
      return { success: true, userId: finalUserId, messageSid: messageSid };
    }
  } catch (error) {
    console.error(`❌ [${requestId}] Error en saveMessageWithUserId:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

// 🔧 FUNCIÓN SIMPLIFICADA: Procesar documento de WhatsApp
async function processWhatsAppDocument(
  senderPhone: string, 
  mediaData: any, 
  requestId: string, 
  userId: string,
  providerId: string
): Promise<{ success: boolean; document_id?: string; error?: string }> {
  try {
    console.log(`📄 [${requestId}] Procesando documento de WhatsApp...`);
    
    // Determinar tipo de documento
    const documentType = determineDocumentType(mediaData);
    console.log(`📄 [${requestId}] Tipo de documento: ${documentType}`);

    // Construir URL de descarga para WhatsApp
    const mediaUrl = `https://graph.facebook.com/v18.0/${mediaData.id}`;
    console.log(`📥 [${requestId}] URL construida para descarga:`, mediaUrl);

    // Descargar archivo desde WhatsApp
    const { data: fileBuffer, error: downloadError } = await downloadMediaFromWhatsApp(mediaUrl, requestId);
    if (downloadError || !fileBuffer) {
      return { success: false, error: 'Error descargando archivo desde WhatsApp' };
    }

    // Subir archivo a carpeta del proveedor
    const uploadResult = await uploadFileToProviderFolder(
      fileBuffer, 
      mediaData.filename || `document_${Date.now()}`,
      userId,
      providerId,
      requestId,
      senderPhone
    );
    
    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error };
    }

    // Crear documento en la base de datos
    const { DocumentService } = await import('../../../../lib/documentService');
    const documentService = new DocumentService();
    
    const documentResult = await documentService.createDocument({
      user_id: userId,
      filename: uploadResult.filename,
      file_url: uploadResult.url,
      file_size: fileBuffer.length,
      file_type: documentType,
      mime_type: mediaData.mime_type,
      whatsapp_message_id: mediaData.id,
      sender_phone: senderPhone,
      sender_type: 'provider',
      provider_id: providerId
    });

    if (!documentResult.success) {
      return { success: false, error: documentResult.error };
    }

    // Procesar documento con OCR en background
    processDocumentWithOCR(documentResult.document_id!, requestId, fileBuffer, uploadResult.filename);

    console.log(`✅ [${requestId}] Documento creado exitosamente: ${documentResult.document_id}`);
    return { 
      success: true, 
      document_id: documentResult.document_id 
    };

  } catch (error) {
    console.error(`❌ [${requestId}] Error procesando documento:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error inesperado' 
    };
  }
}

// 🔧 FUNCIÓN AUXILIAR: Determinar tipo de documento
function determineDocumentType(mediaData: any): 'catalogo' | 'factura' | 'comprobante' | 'foto' | 'other' {
  const filename = mediaData.filename?.toLowerCase() || '';
  const mimeType = mediaData.mime_type?.toLowerCase() || '';
  
  // Detectar por nombre de archivo
  if (filename.includes('catalogo') || filename.includes('catalog')) {
    return 'catalogo';
  }
  if (filename.includes('factura') || filename.includes('invoice')) {
    return 'factura';
  }
  if (filename.includes('comprobante') || filename.includes('receipt')) {
    return 'comprobante';
  }
  
  // Detectar por tipo MIME
  if (mimeType.startsWith('image/')) {
    return 'foto';
  }
  if (mimeType.includes('pdf')) {
    // PDFs son generalmente facturas o comprobantes
    return 'factura';
  }
  
  return 'other';
}

// 🔧 FUNCIÓN AUXILIAR: Determinar tipo de remitente
function determineSenderType(senderPhone: string, userId: string): 'provider' | 'user' {
  // Por ahora, asumimos que si viene por WhatsApp es de un proveedor
  // En el futuro se puede mejorar esta lógica
  return 'provider';
}

// 🔧 FUNCIÓN AUXILIAR: Procesar documento con OCR en background
async function processDocumentWithOCR(documentId: string, requestId: string, fileBuffer?: Buffer, filename?: string): Promise<void> {
  try {
    console.log(`🤖 [${requestId}] Iniciando procesamiento OCR en background para documento: ${documentId}`);
    
    // Usar setTimeout para no bloquear la respuesta del webhook
    setTimeout(async () => {
      try {
        const { DocumentService } = await import('../../../../lib/documentService');
        const documentService = new DocumentService();
        
        // Si tenemos el buffer del archivo, procesar directamente con OCR
        if (fileBuffer && filename) {
          console.log(`🔍 [${requestId}] Procesando archivo directamente con OCR: ${filename}`);
          
          // Procesar con nuestro servicio de OCR
          const { ocrService } = require('../../../../lib/ocrService');
          const { simpleInvoiceExtraction } = require('../../../../lib/simpleInvoiceExtraction');
          
          let ocrResult;
          if (filename.toLowerCase().endsWith('.pdf')) {
            // Crear archivo temporal para PDF
            const fs = require('fs');
            const path = require('path');
            
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const tempFilePath = path.join(tempDir, filename);
            fs.writeFileSync(tempFilePath, fileBuffer);
            
            ocrResult = await ocrService.processPDFFromPath(tempFilePath);
            
            // Limpiar archivo temporal
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          } else {
            // Para imágenes, usar extractTextFromImage
            ocrResult = await ocrService.extractTextFromImage(fileBuffer, filename);
          }
          
          if (ocrResult.success && ocrResult.text) {
            console.log(`✅ [${requestId}] OCR exitoso, extrayendo datos estructurados...`);
            
            // Extraer datos estructurados
            const extractedData = await simpleInvoiceExtraction.extractFromText(ocrResult.text, filename);
            
                   // Actualizar documento con datos extraídos
                   await documentService.updateDocumentWithOCRData(documentId, {
                     extracted_text: ocrResult.text,
                     extracted_data: extractedData.success ? extractedData.data : null,
                     confidence_score: extractedData.success ? extractedData.confidence : 0
                   });
            
            console.log(`✅ [${requestId}] Datos extraídos y guardados:`, {
              hasText: !!ocrResult.text,
              hasStructuredData: extractedData.success,
              confidence: extractedData.success ? extractedData.confidence : 0
            });
            
            // Si es una factura con datos válidos, intentar asociar a orden
            // Detectar factura por nombre del archivo O por datos extraídos (invoiceNumber, totalAmount, etc.)
            const isInvoice = filename.toLowerCase().includes('factura') || 
                             (extractedData.data && extractedData.data.invoiceNumber && extractedData.data.totalAmount);
            
            if (extractedData.success && extractedData.data && isInvoice) {
              console.log(`🔍 [${requestId}] Factura detectada, intentando asociar a orden:`, {
                filename: filename,
                hasInvoiceNumber: !!extractedData.data.invoiceNumber,
                hasTotalAmount: !!extractedData.data.totalAmount,
                isInvoice: isInvoice
              });
              await tryAssociateInvoiceToOrder(documentId, extractedData.data, requestId);
            } else {
              console.log(`⚠️ [${requestId}] No se detectó como factura:`, {
                filename: filename,
                extractedDataSuccess: extractedData.success,
                hasData: !!extractedData.data,
                hasInvoiceNumber: extractedData.data?.invoiceNumber,
                hasTotalAmount: extractedData.data?.totalAmount,
                isInvoice: isInvoice
              });
            }
          } else {
            console.log(`⚠️ [${requestId}] OCR falló o no extrajo texto:`, ocrResult.error);
          }
        } else {
          // Fallback al sistema anterior
          const result = await documentService.processDocumentWithOCR(documentId);
          
          if (result.success) {
            console.log(`✅ [${requestId}] OCR completado exitosamente para documento: ${documentId}`);
          }
        }
        
        // Enviar notificación de procesamiento completado
        const { DocumentNotificationService } = await import('../../../../lib/documentNotificationService');
        const notificationService = new DocumentNotificationService();
        
        // Obtener documento por ID directamente
        const document = await documentService.getDocumentById(documentId);
        if (document) {
          await notificationService.notifyDocumentProcessed(
            document.user_id,
            documentId,
            document.filename,
            document.file_type,
            document.confidence_score || 0
          );
          
          // Si se asignó a una orden, notificar
          if (document.order_id) {
            await notificationService.notifyDocumentAssigned(
              document.user_id,
              documentId,
              document.filename,
              document.order_id
            );
          }
        } else {
          console.error(`❌ [${requestId}] Error obteniendo documento: ${documentId}`);
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error en procesamiento background:`, error);
      }
    }, 1000); // Esperar 1 segundo antes de procesar

  } catch (error) {
    console.error(`❌ [${requestId}] Error iniciando procesamiento OCR:`, error);
  }
}

// 🔧 FUNCIÓN AUXILIAR: Subir archivo a carpeta del proveedor
async function uploadFileToProviderFolder(
  fileBuffer: Buffer, 
  filename: string, 
  userId: string,
  providerId: string,
  requestId: string,
  senderPhone?: string
): Promise<{ success: boolean; filename?: string; url?: string; error?: string }> {
  try {
    console.log(`📤 [${requestId}] Subiendo archivo a carpeta del proveedor:`, filename);
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener información del proveedor para el nombre del archivo
    let providerName = 'Proveedor';
    if (providerId) {
      const { data: provider } = await supabase
        .from('providers')
        .select('name')
        .eq('id', providerId)
        .single();
      
      if (provider?.name) {
        // Limpiar nombre del proveedor para usar en filename
        providerName = provider.name
          .replace(/[^a-zA-Z0-9\s]/g, '') // Remover caracteres especiales
          .replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
          .substring(0, 20); // Limitar longitud
      }
    }

    // Generar nombre descriptivo para el archivo
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const fileExtension = filename.split('.').pop() || 'bin';
    
    // Nombre más descriptivo: Proveedor_Fecha_Hora_Tipo.Extension
    const fileType = filename.toLowerCase().includes('factura') ? 'Factura' : 
                    filename.toLowerCase().includes('comprobante') ? 'Comprobante' :
                    filename.toLowerCase().includes('catalogo') ? 'Catalogo' : 'Documento';
    
    const descriptiveFilename = `${providerName}_${dateStr}_${timeStr}_${fileType}.${fileExtension}`;
    
    // Ruta en storage: providers/{userId}/{providerId}/{filename}
    const storagePath = `providers/${userId}/${providerId}/${descriptiveFilename}`;
    
    // Subir archivo
    const { data, error } = await supabase.storage
      .from('files')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: false
      });

    if (error) {
      console.error(`❌ [${requestId}] Error subiendo archivo:`, error);
      return { success: false, error: error.message };
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('files')
      .getPublicUrl(storagePath);

    console.log(`✅ [${requestId}] Archivo subido exitosamente a carpeta del proveedor:`, storagePath);
    
    return {
      success: true,
      filename: descriptiveFilename,
      url: urlData.publicUrl
    };

  } catch (error) {
    console.error(`❌ [${requestId}] Error inesperado subiendo archivo:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error inesperado' 
    };
  }
}

// 🔧 FUNCIÓN AUXILIAR: Intentar asociar factura a orden
async function tryAssociateInvoiceToOrder(
  documentId: string, 
  extractedData: any, 
  requestId: string
): Promise<void> {
  try {
    console.log(`🔍 [${requestId}] Intentando asociar factura a orden...`);
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Obtener documento para encontrar el proveedor
    const { DocumentService } = await import('../../../../lib/documentService');
    const documentService = new DocumentService();
    const document = await documentService.getDocumentById(documentId);
    
    if (!document) {
      console.log(`⚠️ [${requestId}] Documento no encontrado: ${documentId}`);
      return;
    }
    
    // Buscar proveedor por teléfono
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, name, cuit_cuil')
      .eq('phone', document.sender_phone)
      .single();
    
    if (providerError || !provider) {
      console.log(`⚠️ [${requestId}] Proveedor no encontrado para teléfono: ${document.sender_phone}`);
      return;
    }
    
    // Buscar orden pendiente del proveedor (standby, enviado, o esperando_factura)
    const { data: pendingOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, status')
      .eq('provider_id', provider.id)
      .in('status', ['standby', 'enviado', 'esperando_factura'])
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (orderError || !pendingOrder || pendingOrder.length === 0) {
      console.log(`⚠️ [${requestId}] No hay órdenes pendientes para el proveedor: ${provider.name}`);
      return;
    }
    
    const order = pendingOrder[0];
    console.log(`✅ [${requestId}] Orden encontrada para asociar factura:`, {
      orderId: order.id,
      orderNumber: order.order_number,
      currentStatus: order.status,
      totalAmount: order.total_amount
    });

    // 🔧 NUEVO: Si la orden está en esperando_factura, usar ExtensibleOrderFlowService
    if (order.status === 'esperando_factura') {
      console.log(`🔄 [${requestId}] Orden en esperando_factura - usando ExtensibleOrderFlowService`);
      
      try {
        const { ExtensibleOrderFlowService } = await import('../../../../lib/extensibleOrderFlowService');
        const extensibleOrderFlowService = ExtensibleOrderFlowService.getInstance();
        
        // Simular un mensaje de "documento recibido" para activar la transición
        const result = await extensibleOrderFlowService.processProviderMessage(
          document.sender_phone, 
          'documento_recibido', 
          document.user_id
        );
        
        if (result.success) {
          console.log(`✅ [${requestId}] Transición ejecutada por ExtensibleOrderFlowService: ${result.newStatus}`);
          // Continuar con la asociación de la factura
        } else {
          console.log(`⚠️ [${requestId}] ExtensibleOrderFlowService falló: ${result.message}`);
          // Continuar con el flujo normal de asociación
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error en ExtensibleOrderFlowService:`, error);
        // Continuar con el flujo normal de asociación
      }
    }

    // Validar factura con servicio de validación
    const { invoiceValidationService } = require('../../../../lib/invoiceValidationService');
    
    const validationResult = await invoiceValidationService.validateAndProcessInvoice(
      {
        id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        provider_id: provider.id,
        status: order.status
      },
      extractedData,
      provider.cuit_cuil,
      document.user_id
    );

    if (!validationResult.shouldProceed) {
      console.log(`❌ [${requestId}] Factura no válida, no se asociará a orden:`, validationResult.validationResult.discrepancies);
      return;
    }

    if (!validationResult.isValid) {
      console.log(`⚠️ [${requestId}] Factura con discrepancias menores, procediendo:`, validationResult.validationResult.discrepancies);
    }
    
    // Actualizar orden con datos de la factura
    const updateData: any = {
      receipt_url: document.file_url,
      status: 'pendiente_de_pago',
      updated_at: new Date().toISOString(),
      invoice_data: extractedData,
      invoice_number: extractedData.invoiceNumber,
      invoice_total: extractedData.totalAmount,
      invoice_currency: extractedData.currency,
      invoice_date: extractedData.issueDate,
      extraction_confidence: extractedData.confidence,
      // 🔧 CORRECCIÓN: Preservar el provider_id para evitar desconexión
      provider_id: order.provider_id
    };
    
    // Actualizar monto si es diferente
    if (extractedData.totalAmount && extractedData.totalAmount > 0) {
      updateData.total_amount = extractedData.totalAmount;
      console.log(`💰 [${requestId}] Actualizando monto de orden: $${order.total_amount} → $${extractedData.totalAmount}`);
    }
    
    console.log(`🔄 [${requestId}] Actualizando orden con datos:`, {
      orderId: order.id,
      newStatus: 'pendiente_de_pago',
      invoiceNumber: extractedData.invoiceNumber,
      invoiceTotal: extractedData.totalAmount,
      updateData: updateData
    });
    
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order.id);
    
    if (updateError) {
      console.error(`❌ [${requestId}] Error actualizando orden:`, updateError);
      return;
    }
    
    console.log(`✅ [${requestId}] Factura asociada exitosamente a orden ${order.order_number}`);
    console.log(`🔄 [${requestId}] Orden actualizada de '${order.status}' a 'pendiente_de_pago'`);
    
    // 🔧 CORRECCIÓN: Actualizar documento con order_id para que aparezca asociado en el modal
    const { error: documentUpdateError } = await supabase
      .from('documents')
      .update({ 
        order_id: order.id,
        status: 'assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);
    
    if (documentUpdateError) {
      console.error(`❌ [${requestId}] Error actualizando documento con order_id:`, documentUpdateError);
    } else {
      console.log(`✅ [${requestId}] Documento actualizado con order_id: ${order.id}`);
    }
    
    // Enviar notificación de factura asociada
    const { DocumentNotificationService } = await import('../../../../lib/documentNotificationService');
    const notificationService = new DocumentNotificationService();
    
    // Notificar factura asociada (usar método existente)
    await notificationService.notifyDocumentAssigned(
      document.user_id,
      documentId,
      document.filename,
      order.id
    );
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error asociando factura a orden:`, error);
  }
}

