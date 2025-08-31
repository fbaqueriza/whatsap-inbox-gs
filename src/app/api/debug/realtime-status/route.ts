import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Variables de entorno faltantes' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar conexión a Supabase
    const { data: connectionTest, error: connectionError } = await supabase
      .from('orders')
      .select('count')
      .limit(1);

    if (connectionError) {
      return NextResponse.json({
        success: false,
        error: 'Error de conexión a Supabase',
        details: connectionError.message
      });
    }

    // Obtener estadísticas de las tablas
    const [
      { count: ordersCount },
      { count: pendingCount },
      { count: messagesCount }
    ] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('pending_orders').select('*', { count: 'exact', head: true }),
      supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true })
    ]);

    // Obtener las últimas órdenes para verificar cambios
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, status, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      data: {
        connection: 'OK',
        tables: {
          orders: ordersCount,
          pending_orders: pendingCount,
          whatsapp_messages: messagesCount
        },
        recentOrders: recentOrders || [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error en realtime-status:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
