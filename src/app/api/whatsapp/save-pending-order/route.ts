import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, providerId, userId, providerPhone, status = 'pending_confirmation' } = body;

    if (!orderId || !providerId || !userId) {
      return NextResponse.json(
        { error: 'orderId, providerId y userId son requeridos' },
        { status: 400 }
      );
    }

    // Obtener el teléfono del proveedor si no se proporciona
    let phone = providerPhone;
    if (!phone) {
      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('phone')
        .eq('id', providerId)
        .single();
      
      if (providerError) {
        console.error('Error obteniendo teléfono del proveedor:', providerError);
        return NextResponse.json(
          { error: 'Error obteniendo datos del proveedor' },
          { status: 500 }
        );
      }
      phone = provider.phone;
    }

    // Obtener datos completos de la orden para guardar en order_data
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error obteniendo datos de la orden:', orderError);
      return NextResponse.json(
        { error: 'Error obteniendo datos de la orden' },
        { status: 500 }
      );
    }

    // Verificar si ya existe un pedido pendiente para esta orden
    const { data: existingPending, error: checkError } = await supabase
      .from('pending_orders')
      .select('id')
      .eq('order_id', orderId)
      .single();

    if (existingPending) {
      console.log('Pedido pendiente ya existe para la orden:', orderId);
      return NextResponse.json({ 
        success: true, 
        message: 'Pedido pendiente ya existe',
        pendingOrder: existingPending 
      });
    }

    // Guardar pedido pendiente en la base de datos
    const { data, error } = await supabase
      .from('pending_orders')
      .insert({
        order_id: orderId,
        provider_id: providerId,
        user_id: userId,
        provider_phone: phone,
        order_data: orderData, // Incluir los datos completos de la orden
        status,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error guardando pedido pendiente:', error);
      return NextResponse.json(
        { error: 'Error guardando pedido pendiente' },
        { status: 500 }
      );
    }

    console.log('✅ Pedido pendiente guardado exitosamente:', {
      orderId,
      providerId,
      providerPhone: phone,
      status
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Pedido pendiente guardado exitosamente',
      pendingOrder: data 
    });
  } catch (error) {
    console.error('Error en POST /api/whatsapp/save-pending-order:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
