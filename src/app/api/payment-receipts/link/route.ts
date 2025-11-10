import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';

/**
 * 🔗 API ENDPOINT: Linkear Comprobantes de Pago a Órdenes
 * 
 * Permite linkear manualmente comprobantes de pago a una o más órdenes
 */
export async function POST(request: NextRequest) {
  try {
    const { receiptId, orderIds, userId } = await request.json();

    if (!receiptId || !orderIds || !Array.isArray(orderIds) || orderIds.length === 0 || !userId) {
      return NextResponse.json({
        success: false,
        error: 'receiptId, orderIds (array) y userId son requeridos'
      }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    // Verificar que el comprobante existe y pertenece al usuario
    const { data: receipt, error: receiptError } = await supabase
      .from('payment_receipts')
      .select('id, file_url, payment_amount, user_id')
      .eq('id', receiptId)
      .eq('user_id', userId)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json({
        success: false,
        error: 'Comprobante no encontrado o no autorizado'
      }, { status: 404 });
    }

    // Verificar que las órdenes existen y pertenecen al usuario
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, status, provider_id, user_id')
      .in('id', orderIds)
      .eq('user_id', userId);

    if (ordersError || !orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Órdenes no encontradas o no autorizadas'
      }, { status: 404 });
    }

    // Actualizar comprobante con las órdenes linkeadas
    // Nota: payment_receipts tiene order_id (singular), pero podemos usar auto_assigned_order_id
    // o crear una relación many-to-many. Por ahora, linkeamos a la primera orden y guardamos todas en metadata
    const primaryOrderId = orderIds[0];
    const primaryOrder = orders.find(o => o.id === primaryOrderId);
    
    // 🔧 CORRECCIÓN: Asignar también el provider_id de la primera orden
    const { error: updateError } = await supabase
      .from('payment_receipts')
      .update({
        order_id: primaryOrderId,
        auto_assigned_order_id: primaryOrderId,
        provider_id: primaryOrder?.provider_id || null, // Asignar provider_id de la orden
        auto_assigned_provider_id: primaryOrder?.provider_id || null, // También en auto_assigned
        status: 'assigned',
        assignment_method: 'manual',
        assignment_confidence: 1.0, // Confianza alta para asignación manual
        updated_at: new Date().toISOString()
      })
      .eq('id', receiptId);

    if (updateError) {
      console.error('Error actualizando comprobante:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Error actualizando comprobante',
        details: updateError.message
      }, { status: 500 });
    }

    // Actualizar cada orden con el comprobante de pago
    const updatePromises = orders.map(order => 
      supabase
        .from('orders')
        .update({
          status: 'pagado',
          payment_receipt_url: receipt.file_url,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
    );

    const updateResults = await Promise.all(updatePromises);
    const updateErrors = updateResults.filter(r => r.error);

    if (updateErrors.length > 0) {
      console.error('Error actualizando algunas órdenes:', updateErrors);
      // No fallar completamente, solo advertir
    }

    console.log(`✅ Comprobante ${receiptId} linkeado exitosamente a ${orderIds.length} orden(es)`);
    
    // Emitir broadcasts para cada orden actualizada
    for (const order of orders) {
      try {
        await supabase
          .channel('orders-updates')
          .send({
            type: 'broadcast' as const,
            event: 'order_updated',
            payload: {
              orderId: order.id,
              status: 'pagado',
              paymentReceiptUrl: receipt.file_url,
              timestamp: new Date().toISOString(),
              source: 'payment_receipt_link'
            }
          });
      } catch (broadcastErr) {
        console.error('Error en broadcast:', broadcastErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Comprobante linkeado a ${orderIds.length} orden(es)`,
      linkedOrders: orders.map(o => o.order_number)
    });

  } catch (error) {
    console.error('Error linkeando comprobante:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

