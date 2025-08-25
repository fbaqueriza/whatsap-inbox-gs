import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { providerPhone } = await request.json();

    if (!providerPhone) {
      return NextResponse.json(
        { success: false, error: 'Número de teléfono requerido' },
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
    
    // Buscar directamente con el número validado
    const { data, error } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('provider_phone', providerPhone)
      .eq('status', 'pending_confirmation')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'No se encontró pedido pendiente' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: data.order_id,
      providerId: data.provider_id,
      providerPhone: data.provider_phone,
      orderData: data.order_data,
      status: data.status,
      createdAt: data.created_at
    });

  } catch (error) {
    console.error('❌ Error en get-pending-order:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
