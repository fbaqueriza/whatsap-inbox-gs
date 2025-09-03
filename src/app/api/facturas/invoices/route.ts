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

    // SOLO obtener órdenes que realmente tengan facturas asociadas
    // No más datos mock o números de factura generados automáticamente
    const { data: ordersWithInvoices, error: invoicesError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        invoice_number,
        total_amount,
        currency,
        status,
        due_date,
        created_at,
        payment_method,
        provider_id,
        receipt_url,
        providers!inner(
          id,
          name,
          phone,
          email
        )
      `)
      .not('invoice_number', 'is', null)  // Solo órdenes CON número de factura
      .not('receipt_url', 'is', null)     // Solo órdenes CON comprobante
      .order('created_at', { ascending: false });

    if (invoicesError) {
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo facturas',
        details: invoicesError.message
      }, { status: 500 });
    }

    // Transformar solo datos reales, sin fallbacks mock
    const realInvoices = ordersWithInvoices?.map(order => ({
      id: order.id,
      order_number: order.order_number,
      invoice_number: order.invoice_number, // Solo si existe
      provider_name: order.providers?.name || 'Proveedor no encontrado',
      total_amount: order.total_amount,
      currency: order.currency,
      status: order.status,
      due_date: order.due_date,
      created_at: order.created_at,
      payment_method: order.payment_method,
      receipt_url: order.receipt_url
    })).filter(invoice => 
      // Filtrar solo facturas válidas
      invoice.invoice_number && 
      invoice.total_amount && 
      invoice.receipt_url
    ) || [];

    return NextResponse.json({
      success: true,
      invoices: realInvoices,
      count: realInvoices.length,
      message: 'Solo facturas reales con comprobantes'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
