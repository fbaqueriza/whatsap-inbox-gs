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

    console.log('🔍 Probando búsqueda con número:', providerPhone);

    // 1. Buscar con el número exacto
    const { data: exactMatch, error: exactError } = await supabase
      .from('pending_orders')
      .select('id, order_id, provider_phone, status')
      .eq('provider_phone', providerPhone)
      .eq('status', 'pending_confirmation');

    // 2. Buscar con LIKE para ver si hay variaciones
    const { data: likeMatch, error: likeError } = await supabase
      .from('pending_orders')
      .select('id, order_id, provider_phone, status')
      .like('provider_phone', `%${providerPhone.replace('+', '')}%`)
      .eq('status', 'pending_confirmation');

    // 3. Obtener todos los pedidos pendientes para comparar
    const { data: allPending, error: allError } = await supabase
      .from('pending_orders')
      .select('id, order_id, provider_phone, status')
      .eq('status', 'pending_confirmation');

    return NextResponse.json({
      success: true,
      searchNumber: providerPhone,
      exactMatch: {
        data: exactMatch || [],
        error: exactError,
        count: exactMatch?.length || 0
      },
      likeMatch: {
        data: likeMatch || [],
        error: likeError,
        count: likeMatch?.length || 0
      },
      allPending: {
        data: allPending || [],
        error: allError,
        count: allPending?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ Error en test endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
