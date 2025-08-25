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

    // Normalizar el número de teléfono para la búsqueda
    let normalizedPhone = providerPhone.replace(/[\s\-\(\)]/g, '');
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = `+${normalizedPhone}`;
    }
    
    console.log('🔍 Buscando pedido pendiente para:', normalizedPhone);
    
    // Buscar con el número normalizado
    console.log('🔍 Buscando pedido pendiente con número:', normalizedPhone);
    let { data, error } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('provider_phone', normalizedPhone)
      .eq('status', 'pending_confirmation')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    console.log('🔍 Resultado de búsqueda con +:', { data, error });
    
    // Si no se encuentra, buscar sin el +
    if (error || !data) {
      console.log('🔍 No encontrado con +, buscando sin +...');
      const phoneWithoutPlus = normalizedPhone.replace('+', '');
      console.log('🔍 Buscando con número sin +:', phoneWithoutPlus);
      const result = await supabase
        .from('pending_orders')
        .select('*')
        .eq('provider_phone', phoneWithoutPlus)
        .eq('status', 'pending_confirmation')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      console.log('🔍 Resultado de búsqueda sin +:', { data: result.data, error: result.error });
      
      // Solo actualizar si encontramos datos
      if (result.data && !result.error) {
        data = result.data;
        error = null; // Resetear el error si encontramos datos
      }
    }

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
    console.error('Error en get-pending-order:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
