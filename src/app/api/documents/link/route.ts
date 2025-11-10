/**
 * 🔗 API ENDPOINT: Linkear Documentos a Órdenes
 * 
 * Permite linkear manualmente documentos (facturas/comprobantes) a órdenes
 * desde el frontend
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';

export async function POST(request: NextRequest) {
  try {
    const { documentId, orderId, linkType, userId } = await request.json();

    if (!documentId || !orderId || !linkType || !userId) {
      return NextResponse.json({
        success: false,
        error: 'documentId, orderId, linkType y userId son requeridos'
      }, { status: 400 });
    }

    if (!['factura', 'comprobante'].includes(linkType)) {
      return NextResponse.json({
        success: false,
        error: 'linkType debe ser "factura" o "comprobante"'
      }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    // Verificar que el documento existe y pertenece al usuario
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('id, file_type, file_url, extracted_data, user_id')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (documentError || !document) {
      return NextResponse.json({
        success: false,
        error: 'Documento no encontrado o no autorizado'
      }, { status: 404 });
    }

    // Verificar que la orden existe y pertenece al usuario
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status, provider_id, user_id')
      .eq('id', orderId)
      .eq('user_id', userId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada o no autorizada'
      }, { status: 404 });
    }

    // Actualizar documento con order_id
    const { error: updateDocumentError } = await supabase
      .from('documents')
      .update({
        order_id: orderId,
        status: 'assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateDocumentError) {
      console.error('Error actualizando documento:', updateDocumentError);
      return NextResponse.json({
        success: false,
        error: 'Error actualizando documento',
        details: updateDocumentError.message
      }, { status: 500 });
    }

    // Actualizar orden según el tipo de documento
    let orderUpdateData: any = {
      updated_at: new Date().toISOString()
    };

    if (linkType === 'factura') {
      orderUpdateData.receipt_url = document.file_url;
      orderUpdateData.status = 'pendiente_de_pago';
      
      // Si el documento tiene datos extraídos, usarlos
      if (document.extracted_data) {
        orderUpdateData.invoice_data = document.extracted_data;
        orderUpdateData.invoice_number = document.extracted_data.invoiceNumber;
        orderUpdateData.invoice_total = document.extracted_data.totalAmount;
        orderUpdateData.invoice_currency = document.extracted_data.currency;
        orderUpdateData.invoice_date = document.extracted_data.issueDate;
        orderUpdateData.extraction_confidence = document.extracted_data.confidence;
        
        // Actualizar monto si está disponible
        if (document.extracted_data.totalAmount && document.extracted_data.totalAmount > 0) {
          orderUpdateData.total_amount = document.extracted_data.totalAmount;
        }
      }
    } else if (linkType === 'comprobante') {
      orderUpdateData.payment_receipt_url = document.file_url;
      orderUpdateData.status = 'pagado';
      orderUpdateData.paid_at = new Date().toISOString();
    }

    const { error: updateOrderError } = await supabase
      .from('orders')
      .update(orderUpdateData)
      .eq('id', orderId);

    if (updateOrderError) {
      console.error('Error actualizando orden:', updateOrderError);
      return NextResponse.json({
        success: false,
        error: 'Error actualizando orden',
        details: updateOrderError.message
      }, { status: 500 });
    }

    console.log(`✅ Documento ${documentId} linkeado exitosamente a orden ${orderId} como ${linkType}`);
    console.log(`🔔 Esta actualización debería disparar un evento Realtime para los suscriptores`);
    
    // 🔧 WORKAROUND: Emitir broadcast manual para notificar a los clientes Realtime
    try {
      const broadcastResult = await supabase
        .channel('orders-updates')
        .send({
          type: 'broadcast' as const,
          event: 'order_updated',
          payload: {
            orderId: orderId,
            status: orderUpdateData.status,
            receiptUrl: linkType === 'comprobante' ? orderUpdateData.payment_receipt_url : orderUpdateData.receipt_url,
            timestamp: new Date().toISOString(),
            source: 'document_link'
          }
        });

      if (broadcastResult === 'error') {
        console.error(`⚠️ Error enviando broadcast`);
      } else {
        console.log(`✅ Broadcast de actualización enviado`);
      }
    } catch (broadcastErr) {
      console.error(`⚠️ Error en broadcast:`, broadcastErr);
    }

    // Registrar el linkeo en el historial
    const { error: historyError } = await supabase
      .from('document_links')
      .insert([{
        document_id: documentId,
        order_id: orderId,
        link_type: linkType,
        user_id: userId,
        created_at: new Date().toISOString()
      }]);

    if (historyError) {
      console.warn('Error registrando historial de linkeo:', historyError);
      // No fallar por esto, solo loggearlo
    }

    return NextResponse.json({
      success: true,
      data: {
        document_id: documentId,
        order_id: orderId,
        link_type: linkType,
        order_number: order.order_number,
        new_status: orderUpdateData.status
      }
    });

  } catch (error: any) {
    console.error('Error in document link API:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message || 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * 🔗 DELETE: Deslinkear documento de orden
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('document_id');
    const orderId = searchParams.get('order_id');
    const userId = searchParams.get('user_id');

    if (!documentId || !orderId || !userId) {
      return NextResponse.json({
        success: false,
        error: 'document_id, order_id y user_id son requeridos'
      }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    // Verificar que el documento existe y está linkeado a la orden
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('id, order_id, user_id')
      .eq('id', documentId)
      .eq('order_id', orderId)
      .eq('user_id', userId)
      .single();

    if (documentError || !document) {
      return NextResponse.json({
        success: false,
        error: 'Documento no encontrado o no está linkeado a esta orden'
      }, { status: 404 });
    }

    // Deslinkear documento
    const { error: updateDocumentError } = await supabase
      .from('documents')
      .update({
        order_id: null,
        status: 'processed',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateDocumentError) {
      console.error('Error deslinkeando documento:', updateDocumentError);
      return NextResponse.json({
        success: false,
        error: 'Error deslinkeando documento',
        details: updateDocumentError.message
      }, { status: 500 });
    }

    // Actualizar orden (revertir estado)
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        receipt_url: null,
        payment_receipt_url: null,
        status: 'esperando_factura',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateOrderError) {
      console.error('Error actualizando orden:', updateOrderError);
      return NextResponse.json({
        success: false,
        error: 'Error actualizando orden',
        details: updateOrderError.message
      }, { status: 500 });
    }

    console.log(`✅ Documento ${documentId} deslinkeado exitosamente de orden ${orderId}`);

    return NextResponse.json({
      success: true,
      data: {
        document_id: documentId,
        order_id: orderId,
        message: 'Documento deslinkeado exitosamente'
      }
    });

  } catch (error: any) {
    console.error('Error in document unlink API:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message || 'Error desconocido'
    }, { status: 500 });
  }
}
