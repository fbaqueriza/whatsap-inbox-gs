import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orderIds = formData.get('orderIds') as string;
    const paymentAmount = formData.get('paymentAmount') as string;
    const paymentDate = formData.get('paymentDate') as string;
    const paymentMethod = formData.get('paymentMethod') as string;
    const notes = formData.get('notes') as string;

    if (!file || !orderIds || !paymentAmount) {
      return NextResponse.json({
        success: false,
        error: 'Archivo, IDs de órdenes y monto son requeridos'
      }, { status: 400 });
    }

    // Validar tipo de archivo
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'Solo se permiten archivos PDF e imágenes'
      }, { status: 400 });
    }

    // Parsear IDs de órdenes
    const orderIdArray = orderIds.split(',').map(id => id.trim());
    
    // Verificar que las órdenes existan y estén pendientes de pago
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, currency, status, provider_id')
      .in('id', orderIdArray);

    if (ordersError || !orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se pudieron verificar las órdenes'
      }, { status: 400 });
    }

    // Verificar que todas las órdenes estén pendientes de pago
    const invalidOrders = orders.filter(order => 
      order.status === 'pagado' || order.status === 'comprobante_enviado'
    );

    if (invalidOrders.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Algunas órdenes ya están pagadas o finalizadas',
        invalidOrders: invalidOrders.map(o => o.order_number)
      }, { status: 400 });
    }

    // Calcular total de las órdenes seleccionadas
    const totalOrdersAmount = orders.reduce((sum, order) => 
      sum + parseFloat(order.total_amount || '0'), 0
    );

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const fileName = `payment_receipt_${timestamp}_${file.name}`;
    const filePath = `payment_receipts/${timestamp}/${fileName}`;

    // Subir archivo a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      return NextResponse.json({
        success: false,
        error: 'Error subiendo archivo',
        details: uploadError.message
      }, { status: 500 });
    }

    // Obtener URL pública del archivo
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    console.log('📄 Comprobante de pago guardado en storage:', publicUrl);
    
    // ✅ Obtener userId del usuario autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no autenticado'
      }, { status: 401 });
    }
    
    const userId = user.id;
    
    // ✅ Crear comprobante en tabla payment_receipts para cada orden
    const receiptPromises = orderIdArray.map(orderId => {
      const order = orders.find(o => o.id === orderId);
      return supabase
        .from('payment_receipts')
        .insert({
          user_id: userId,
          provider_id: order?.provider_id || null,
          order_id: orderId,
          filename: fileName,
          file_url: publicUrl,
          file_size: file.size,
          file_type: (paymentMethod as any) || 'transferencia',
          mime_type: file.type,
          payment_amount: parseFloat(paymentAmount),
          payment_currency: 'ARS',
          payment_date: paymentDate || new Date().toISOString(),
          payment_method: paymentMethod || 'transferencia',
          status: 'assigned',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    });
    
    const receiptResults = await Promise.all(receiptPromises);
    const receiptErrors = receiptResults.filter(result => result.error);
    
    if (receiptErrors.length > 0) {
      console.error('Error creando comprobantes:', receiptErrors);
      // No fallar si hay error creando comprobantes, solo loguear
    }

    // Actualizar todas las órdenes seleccionadas
    const updatePromises = orderIdArray.map(orderId => 
      supabase
        .from('orders')
        .update({
          status: 'pagado',
          receipt_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
    );

    const updateResults = await Promise.all(updatePromises);
    const updateErrors = updateResults.filter(result => result.error);
    
    console.log('✅ [upload-payment-receipt] Resultados de actualización de órdenes:', {
      total: updateResults.length,
      errores: updateErrors.length,
      orderIds: orderIdArray,
      resultados: updateResults.map((r, i) => ({
        orderId: orderIdArray[i],
        success: !r.error,
        error: r.error?.message
      }))
    });

    if (updateErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Error actualizando algunas órdenes',
        details: updateErrors.map(e => e.error?.message)
      }, { status: 500 });
    }
    
    console.log('✅ [upload-payment-receipt] Órdenes actualizadas a "pagado" exitosamente en BD');

    // 📱 Enviar comprobante por WhatsApp a cada proveedor
    const whatsappPromises = orders.map(async order => {
      if (!order.provider_id) {
        console.log(`⚠️ Orden ${order.order_number} no tiene provider_id, saltando envío WhatsApp`);
        return { success: true, skipped: true };
      }

      try {
        // Obtener datos del proveedor
        const { data: provider, error: providerError } = await supabase
          .from('providers')
          .select('name, phone')
          .eq('id', order.provider_id)
          .single();

        if (providerError || !provider) {
          console.error(`❌ No se encontró proveedor ${order.provider_id} para orden ${order.order_number}`);
          return { success: false, error: 'Proveedor no encontrado' };
        }

        // Normalizar número de teléfono
        const { PhoneNumberService } = await import('../../../../lib/phoneNumberService');
        const normalizedPhone = PhoneNumberService.normalizePhoneNumber(provider.phone);
        
        if (!normalizedPhone) {
          console.error(`❌ Número de teléfono inválido: ${provider.phone}`);
          return { success: false, error: 'Número de teléfono inválido' };
        }

        // Preparar mensaje
        const message = `¡Hola ${provider.name}! 👋\n\n` +
          `Te confirmo que hemos realizado el pago correspondiente. ` +
          `Adjunto encontrarás el comprobante de pago.\n\n` +
          `💰 Monto: $${order.total_amount?.toLocaleString('es-AR') || 'N/A'}\n` +
          `📅 Fecha: ${paymentDate || 'N/A'}\n\n` +
          `¡Gracias por tu confianza! 🙏`;

        // Enviar documento via WhatsApp API usando Kapso
        // Obtener phone_number_id del usuario
        const { data: userConfig } = await supabase
          .from('user_whatsapp_config')
          .select('phone_number_id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .single();

        if (!userConfig?.phone_number_id) {
          console.error(`❌ No se encontró phone_number_id para usuario ${userId}`);
          return { success: false, error: 'Configuración de WhatsApp no encontrada' };
        }

        // Enviar documento usando Kapso WhatsApp Cloud API
        const { WhatsAppClient } = await import('@kapso/whatsapp-cloud-api');
        const whatsappClient = new WhatsAppClient({
          baseUrl: 'https://api.kapso.ai/meta/whatsapp',
          kapsoApiKey: process.env.KAPSO_API_KEY!,
          graphVersion: 'v24.0'
        });

        // Preparar payload para enviar documento
        const documentPayload = {
          to: normalizedPhone,
          type: 'document' as const,
          document: {
            link: publicUrl,
            filename: fileName,
            caption: message
          }
        };

        const result = await whatsappClient.messages.send({
          phoneNumberId: userConfig.phone_number_id,
          ...documentPayload
        });
        
        if (result.messages?.[0]?.id) {
          console.log(`✅ Comprobante enviado por WhatsApp a ${provider.name}`);
          const messageId = result.messages[0].id;
          
          // Actualizar último comprobante creado como enviado
          const { data: lastReceipt } = await supabase
            .from('payment_receipts')
            .select('id')
            .eq('order_id', order.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (lastReceipt) {
            await supabase
              .from('payment_receipts')
              .update({
                sent_to_provider: true,
                sent_at: new Date().toISOString(),
                whatsapp_message_id: messageId,
                status: 'sent'
              })
              .eq('id', lastReceipt.id);
          }
          
          return { success: true, messageId };
        } else {
          console.error(`❌ Error enviando comprobante por WhatsApp: sin ID de mensaje`);
          return { success: false, error: 'No se recibió ID de mensaje de WhatsApp' };
        }
      } catch (error) {
        console.error(`❌ Error enviando comprobante por WhatsApp:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
      }
    });

    const whatsappResults = await Promise.all(whatsappPromises);
    const failedWhatsapp = whatsappResults.filter(r => !r.success && !r.skipped);
    
    if (failedWhatsapp.length > 0) {
      console.warn(`⚠️ ${failedWhatsapp.length} envíos de WhatsApp fallaron, pero las órdenes fueron actualizadas`);
    }

    return NextResponse.json({
      success: true,
      message: 'Comprobante de pago subido y órdenes marcadas como pagadas',
      receiptUrl: publicUrl,
      updatedOrders: orderIdArray,
      totalAmount: totalOrdersAmount,
      paymentAmount: parseFloat(paymentAmount),
      whatsappSent: whatsappResults.filter(r => r.success && !r.skipped).length,
      whatsappFailed: failedWhatsapp.length
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
