import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerPhone = searchParams.get('providerPhone');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Variables de entorno faltantes' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener mensajes de WhatsApp
    let messagesQuery = supabase
      .from('whatsapp_messages')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (providerPhone) {
      messagesQuery = messagesQuery.eq('contact_id', providerPhone);
    }

    const { data: messages, error: messagesError } = await messagesQuery;

    // Obtener pedidos pendientes
    let pendingQuery = supabase
      .from('pending_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (providerPhone) {
      pendingQuery = pendingQuery.eq('provider_phone', providerPhone);
    }

    const { data: pendingOrders, error: pendingError } = await pendingQuery;

    // Obtener órdenes recientes
    const { data: recentOrders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      data: {
        messages: messages || [],
        pendingOrders: pendingOrders || [],
        recentOrders: recentOrders || [],
        errors: {
          messages: messagesError?.message,
          pending: pendingError?.message,
          orders: ordersError?.message
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en chat-status:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}



