import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener todos los pedidos pendientes
    const { data: pendingOrders, error } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('status', 'pending_confirmation')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error obteniendo pedidos pendientes:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo datos' },
        { status: 500 }
      );
    }

    // Verificar específicamente el número +5491135562673
    const { data: specificOrder, error: specificError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('provider_phone', '+5491135562673')
      .eq('status', 'pending_confirmation')
      .single();

    return NextResponse.json({
      success: true,
      allPendingOrders: pendingOrders || [],
      specificOrder: specificOrder || null,
      specificError: specificError,
      totalCount: pendingOrders?.length || 0
    });

  } catch (error) {
    console.error('❌ Error en debug endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
