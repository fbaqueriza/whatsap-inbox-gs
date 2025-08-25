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

    const { error } = await supabase
      .from('pending_orders')
      .delete()
      .eq('provider_phone', providerPhone)
      .eq('status', 'pending_confirmation');

    if (error) {
      console.error('❌ Error removiendo pedido pendiente:', error);
      return NextResponse.json(
        { success: false, error: 'Error removiendo de base de datos' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Pedido pendiente removido exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en remove-pending-order:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
