import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    // Obtener órdenes pendientes de facturación
    // Estas son las que realmente necesitamos procesar
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        currency,
        status,
        created_at,
        desired_delivery_date,
        provider_id,
        providers!inner(
          id,
          name,
          phone,
          email
        )
      `)
      .or('invoice_number.is.null,receipt_url.is.null')  // Sin factura o sin comprobante
      .order('created_at', { ascending: false });

    if (ordersError) {
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo órdenes pendientes',
        details: ordersError.message
      }, { status: 500 });
    }

    // Transformar órdenes pendientes
    const pendingInvoices = pendingOrders?.map(order => ({
      id: order.id,
      order_number: order.order_number,
      provider_name: order.providers?.name || 'Proveedor no encontrado',
      total_amount: order.total_amount,
      currency: order.currency,
      status: 'pending_invoice', // Estado real: pendiente de factura
      created_at: order.created_at,
      desired_delivery_date: order.desired_delivery_date,
      provider_id: order.provider_id
    })) || [];

    return NextResponse.json({
      success: true,
      pendingOrders: pendingInvoices,
      count: pendingInvoices.length,
      message: 'Órdenes pendientes de facturación'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
