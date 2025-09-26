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

    // Obtener facturas pendientes de pago (con factura pero sin pago)
    const { data: pendingPayments, error: paymentsError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        invoice_number,
        total_amount,
        currency,
        status,
        created_at,
        due_date,
        provider_id,
        receipt_url,
        providers!inner(
          id,
          name,
          phone,
          email
        )
      `)
      .not('receipt_url', 'is', null)  // Con factura
      .not('status', 'eq', 'pagado')   // No pagadas
      .not('status', 'eq', 'finalizado') // No finalizadas
      .order('created_at', { ascending: false });

    if (paymentsError) {
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo facturas pendientes de pago',
        details: paymentsError.message
      }, { status: 500 });
    }

    // Transformar datos para el frontend
    const formattedPayments = pendingPayments?.map(order => ({
      id: order.id,
      order_number: order.order_number,
      invoice_number: order.invoice_number || `WHATSAPP_${String(order.id).slice(-8)}`,
      provider_name: order.providers?.name || 'Proveedor no encontrado',
      provider_phone: order.providers?.phone || '',
      total_amount: order.total_amount,
      currency: order.currency,
      status: order.status,
      created_at: order.created_at,
      due_date: order.due_date,
      receipt_url: order.receipt_url,
      provider_id: order.provider_id
    })) || [];

    return NextResponse.json({
      success: true,
      pendingPayments: formattedPayments,
      count: formattedPayments.length,
      message: 'Facturas pendientes de pago obtenidas correctamente'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
