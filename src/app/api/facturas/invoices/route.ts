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

    // 🔧 CORRECCIÓN: Obtener órdenes que tengan facturas asociadas (con comprobantes)
    // Incluir tanto facturas con número como facturas procesadas por WhatsApp
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
        receipt_url
      `)
      .not('receipt_url', 'is', null)     // 🔧 CORRECCIÓN: Solo órdenes CON comprobante
      .order('created_at', { ascending: false });

    if (invoicesError) {
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo facturas',
        details: invoicesError.message
      }, { status: 500 });
    }

    // 🔧 CORRECCIÓN: Obtener proveedores por separado para evitar problemas de relación
    const providerIds = Array.from(new Set(ordersWithInvoices?.map(order => order.provider_id) || []));
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('id, name, phone, email')
      .in('id', providerIds);

    if (providersError) {
      console.error('Error obteniendo proveedores:', providersError);
    }

    // Crear mapa de proveedores para acceso rápido
    const providersMap = new Map(providers?.map(p => [p.id, p]) || []);

    // Transformar solo datos reales, incluyendo facturas procesadas por WhatsApp
    const realInvoices = ordersWithInvoices?.map(order => ({
      id: order.id,
      order_number: order.order_number,
      invoice_number: order.invoice_number || `WHATSAPP_${String(order.id).slice(-8)}`, // 🔧 CORRECCIÓN: Generar ID para facturas de WhatsApp
      provider_name: providersMap.get(order.provider_id)?.name || 'Proveedor no encontrado',
      total_amount: order.total_amount,
      currency: order.currency,
      status: order.status,
      due_date: order.due_date,
      created_at: order.created_at,
      payment_method: order.payment_method,
      receipt_url: order.receipt_url,
      provider_id: order.provider_id // 🔧 CORRECCIÓN: Incluir provider_id
    })).filter(invoice => 
      // 🔧 CORRECCIÓN: Filtrar solo facturas con comprobante y monto
      invoice.total_amount && 
      invoice.receipt_url
    ) || [];

    return NextResponse.json({
      success: true,
      invoices: realInvoices,
      count: realInvoices.length,
      message: 'Facturas reales con comprobantes (incluyendo WhatsApp)'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
