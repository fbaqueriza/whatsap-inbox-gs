import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('status', 'pending_confirmation')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error obteniendo pedidos pendientes:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo pedidos pendientes' },
        { status: 500 }
      );
    }

    console.log('✅ Pedidos pendientes obtenidos:', data?.length || 0);
    return NextResponse.json({ success: true, pendingOrders: data || [] });

  } catch (error) {
    console.error('❌ Error en get-all-pending-orders:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
