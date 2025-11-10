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

    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    if (!providerId) {
      return NextResponse.json({
        success: false,
        error: 'ID de proveedor es requerido'
      }, { status: 400 });
    }

    // Construir query base
    let query = supabase
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
        receipt_url,
        payment_receipt_url,
        payment_date,
        payment_method,
        updated_at
      `)
      .eq('provider_id', providerId);

    // Aplicar filtros de estado si se especifican
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Obtener total de registros para paginación
    const { count, error: countError } = await query
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.warn('Error obteniendo conteo:', countError);
    }

    // Aplicar paginación y ordenamiento
    const { data: orders, error: ordersError } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (ordersError) {
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo órdenes del proveedor',
        details: ordersError.message
      }, { status: 500 });
    }

    // Obtener información del proveedor
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, name, phone, email')
      .eq('id', providerId)
      .single();

    if (providerError) {
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo información del proveedor',
        details: providerError.message
      }, { status: 500 });
    }

    // Transformar datos para el frontend
    const documents = orders?.map(order => ({
      id: order.id,
      order_number: order.order_number,
      invoice_number: order.invoice_number || `WHATSAPP_${String(order.id).slice(-8)}`,
      total_amount: order.total_amount,
      currency: order.currency,
      status: order.status,
      created_at: order.created_at,
      due_date: order.due_date,
      receipt_url: order.receipt_url,
      payment_receipt_url: order.payment_receipt_url,
      payment_date: order.payment_date,
      payment_method: order.payment_method,
      updated_at: order.updated_at,
      document_type: order.receipt_url ? 'factura' : 'orden',
      has_payment: !!order.payment_receipt_url
    })) || [];

    // Agrupar por tipo de documento
    const groupedDocuments = {
      invoices: documents.filter(doc => doc.receipt_url),
      orders: documents.filter(doc => !doc.receipt_url),
      paid: documents.filter(doc => doc.status === 'pagado' || doc.status === 'comprobante_enviado'),
      pending: documents.filter(doc => !['pagado','comprobante_enviado','finalizado'].includes(doc.status))
    };

    // Calcular totales
    const totals = {
      total_orders: documents.length,
      total_invoices: groupedDocuments.invoices.length,
      total_paid: groupedDocuments.paid.length,
      total_pending: groupedDocuments.pending.length,
      total_amount: documents.reduce((sum, doc) => sum + parseFloat(doc.total_amount || '0'), 0),
      paid_amount: groupedDocuments.paid.reduce((sum, doc) => sum + parseFloat(doc.total_amount || '0'), 0),
      pending_amount: groupedDocuments.pending.reduce((sum, doc) => sum + parseFloat(doc.total_amount || '0'), 0)
    };

    return NextResponse.json({
      success: true,
      provider: {
        id: provider.id,
        name: provider.name,
        phone: provider.phone,
        email: provider.email
      },
      documents,
      groupedDocuments,
      totals,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      message: 'Documentos del proveedor obtenidos correctamente'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
