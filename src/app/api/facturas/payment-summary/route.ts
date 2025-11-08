import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    const { orderIds } = await request.json();

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Se requieren IDs de órdenes válidos'
      }, { status: 400 });
    }

    // Obtener órdenes seleccionadas con información de proveedores (incluyendo CUIT, CBU, razón social)
    const { data: selectedOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        invoice_number,
        total_amount,
        currency,
        status,
        created_at,
        provider_id,
        providers!inner(
          id,
          name,
          phone,
          email,
          cuit_cuil,
          cbu,
          razon_social
        )
      `)
      .in('id', orderIds);

    if (ordersError) {
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo órdenes seleccionadas',
        details: ordersError.message
      }, { status: 500 });
    }

    if (!selectedOrders || selectedOrders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron órdenes con los IDs proporcionados'
      }, { status: 404 });
    }

    // Agrupar por proveedor
    const providerGroups = new Map();

    selectedOrders.forEach(order => {
      const providerId = order.provider_id;
      const provider = order.providers;

      if (!providerGroups.has(providerId)) {
        providerGroups.set(providerId, {
          provider_id: providerId,
          provider_name: provider.name,
          provider_phone: provider.phone,
          provider_email: provider.email,
          cuit: provider.cuit_cuil || '',
          cbu: provider.cbu || '',
          razon_social: provider.razon_social || provider.name,
          orders: [],
          total_amount: 0,
          currency: order.currency,
          order_count: 0
        });
      }

      const group = providerGroups.get(providerId);
      group.orders.push({
        id: order.id,
        order_number: order.order_number,
        invoice_number: order.invoice_number || `WHATSAPP_${String(order.id).slice(-8)}`,
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at
      });

      group.total_amount += parseFloat(order.total_amount || '0');
      group.order_count += 1;
    });

    // Convertir a array y ordenar por total
    const paymentSummary = Array.from(providerGroups.values())
      .sort((a, b) => b.total_amount - a.total_amount);

    // Calcular total general
    const grandTotal = paymentSummary.reduce((sum, group) => sum + group.total_amount, 0);

    return NextResponse.json({
      success: true,
      paymentSummary,
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      totalOrders: selectedOrders.length,
      message: 'Resumen de pagos generado correctamente'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
