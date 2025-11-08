import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';

/**
 * 🔗 API ENDPOINT: Deslinkear Comprobante de Pago de Órdenes
 * 
 * Permite deslinkear un comprobante de pago de sus órdenes asociadas
 */
export async function DELETE(request: NextRequest) {
  try {
    const { receiptId, userId } = await request.json();

    if (!receiptId || !userId) {
      return NextResponse.json({
        success: false,
        error: 'receiptId y userId son requeridos'
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
      .select('id, order_id, auto_assigned_order_id, user_id')
      .eq('id', receiptId)
      .eq('user_id', userId)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json({
        success: false,
        error: 'Comprobante no encontrado o no autorizado'
      }, { status: 404 });
    }

    // Obtener órdenes asociadas antes de deslinkear
    const orderIds = [receipt.order_id, receipt.auto_assigned_order_id].filter(Boolean);
    
    // Deslinkear comprobante
    const { error: updateError } = await supabase
      .from('payment_receipts')
      .update({
        order_id: null,
        auto_assigned_order_id: null,
        status: 'processed', // Cambiar a processed ya que no está asignado
        updated_at: new Date().toISOString()
      })
      .eq('id', receiptId);

    if (updateError) {
      console.error('Error deslinkeando comprobante:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Error deslinkeando comprobante',
        details: updateError.message
      }, { status: 500 });
    }

    // Revertir estado de las órdenes asociadas (si existen)
    if (orderIds.length > 0) {
      // Primero verificar que las órdenes pertenecen al usuario
      const { data: ordersToUpdate, error: fetchOrdersError } = await supabase
        .from('orders')
        .select('id, status')
        .in('id', orderIds)
        .eq('user_id', userId);

      if (fetchOrdersError) {
        console.error('Error obteniendo órdenes para actualizar:', fetchOrdersError);
      } else if (ordersToUpdate && ordersToUpdate.length > 0) {
        // Actualizar cada orden
        const updateOrderPromises = ordersToUpdate.map(order =>
          supabase
            .from('orders')
            .update({
              status: 'pendiente_de_pago', // Revertir a pendiente_de_pago
              payment_receipt_url: null,
              paid_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id)
            .eq('user_id', userId) // Asegurar que pertenece al usuario
        );

        const updateOrderResults = await Promise.all(updateOrderPromises);
        const errors = updateOrderResults.filter(res => res.error);

        if (errors.length > 0) {
          console.error('Errores actualizando órdenes:', errors);
          // No fallar completamente, solo advertir
        } else {
          console.log(`✅ ${ordersToUpdate.length} orden(es) revertida(s) a 'pendiente_de_pago'`);
          
          // 🔧 CORRECCIÓN: Emitir broadcasts de Realtime para cada orden actualizada
          const broadcastPromises = ordersToUpdate.map(async (order) => {
            try {
              // Obtener la versión más reciente de la orden para enviar datos completos
              const { data: freshOrder, error: fetchUpdatedOrderError } = await supabase
                .from('orders')
                .select('*')
                .eq('id', order.id)
                .single();

              if (fetchUpdatedOrderError) {
                console.error(`❌ [Unlink] Error obteniendo orden actualizada ${order.id}:`, fetchUpdatedOrderError);
              }

              const payloadOrder = freshOrder || {
                id: order.id,
                status: 'pendiente_de_pago',
                payment_receipt_url: null,
                paid_at: null
              };

              const channel = supabase.channel('orders-updates');
              await channel.send({
                type: 'broadcast' as const,
                event: 'order_updated',
                payload: {
                  orderId: order.id,
                  status: payloadOrder.status || 'pendiente_de_pago',
                  paymentReceiptUrl: payloadOrder.payment_receipt_url || null,
                  paidAt: payloadOrder.paid_at || null,
                  order: payloadOrder,
                  timestamp: new Date().toISOString(),
                  source: 'payment_receipt_unlink'
                }
              });

              await supabase.removeChannel(channel);

              console.log(`📡 [Unlink] Broadcast emitido para orden ${order.id}`);
            } catch (broadcastError) {
              console.error(`❌ [Unlink] Error emitiendo broadcast para orden ${order.id}:`, broadcastError);
            }
          });
          
          await Promise.all(broadcastPromises);
        }
      }
    }

    console.log(`✅ Comprobante ${receiptId} deslinkeado exitosamente`);

    return NextResponse.json({
      success: true,
      message: 'Comprobante deslinkeado exitosamente'
    });

  } catch (error) {
    console.error('Error deslinkeando comprobante:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

