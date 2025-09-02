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

    // Obtener facturas con información del proveedor
    const { data: invoices, error: invoicesError } = await supabase
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
        providers!inner(
          id,
          name,
          phone,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (invoicesError) {
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo facturas',
        details: invoicesError.message
      }, { status: 500 });
    }

    // Transformar datos para el frontend
    const transformedInvoices = invoices?.map(invoice => ({
      id: invoice.id,
      order_number: invoice.order_number,
      invoice_number: invoice.invoice_number || `FAC-${invoice.order_number}`,
      provider_name: invoice.providers?.name || 'Proveedor no encontrado',
      total_amount: invoice.total_amount || 0,
      currency: invoice.currency || 'ARS',
      status: invoice.status || 'pending_payment',
      due_date: invoice.due_date || invoice.created_at,
      created_at: invoice.created_at,
      payment_method: invoice.payment_method || 'efectivo'
    })) || [];

    return NextResponse.json({
      success: true,
      invoices: transformedInvoices,
      count: transformedInvoices.length
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
