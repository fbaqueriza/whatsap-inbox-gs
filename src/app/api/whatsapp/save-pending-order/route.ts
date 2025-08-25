import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { orderId, providerId, providerPhone, orderData } = await request.json();

    if (!orderId || !providerId || !providerPhone || !orderData) {
      return NextResponse.json(
        { success: false, error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Validar formato de teléfono - DEBE ser +54XXXXXXXXXX
    const phoneRegex = /^\+54\d{9,11}$/;
    if (!phoneRegex.test(providerPhone)) {
      console.error('❌ Formato de teléfono inválido:', providerPhone);
      console.error('❌ Debe ser: +54XXXXXXXXXX (ej: +5491135562673)');
      return NextResponse.json(
        { success: false, error: 'Formato de teléfono inválido. Debe ser: +54XXXXXXXXXX' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('pending_orders')
      .insert({
        order_id: orderId,
        provider_id: providerId,
        provider_phone: providerPhone,
        order_data: orderData,
        status: 'pending_confirmation',
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Error guardando pedido pendiente:', error);
      return NextResponse.json(
        { success: false, error: 'Error guardando en base de datos' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Pedido pendiente guardado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en save-pending-order:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
