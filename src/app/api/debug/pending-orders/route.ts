import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Solo crear el cliente si las variables están disponibles
let supabase: any = null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.error('❌ API debug pending-orders - Variables de entorno faltantes');
}

export async function GET(request: NextRequest) {
  try {
    // Verificar que Supabase esté inicializado
    if (!supabase) {
      console.error('❌ Supabase no inicializado');
      return NextResponse.json({
        success: false,
        error: 'Database not configured',
        pendingOrders: []
      }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const providerPhone = searchParams.get('providerPhone');
    
    let query = supabase
      .from('pending_orders')
      .select('*');
    
    if (providerPhone) {
      query = query.eq('provider_phone', providerPhone);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Error obteniendo pedidos pendientes:', error);
      return NextResponse.json({ 
        error: 'Error obteniendo pedidos pendientes',
        details: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      pendingOrders: data || [],
      count: data?.length || 0,
      providerPhone: providerPhone || 'all'
    });
    
  } catch (error) {
    console.error('❌ Error en debug pending-orders:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
