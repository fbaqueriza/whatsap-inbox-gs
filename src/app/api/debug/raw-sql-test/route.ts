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

    console.log('🔍 Probando búsqueda SQL raw con número:', providerPhone);

    // Usar SQL raw para verificar
    const { data: rawResult, error: rawError } = await supabase
      .rpc('test_phone_lookup', { phone_param: providerPhone });

    // También probar con una consulta SQL directa
    const { data: sqlResult, error: sqlError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('status', 'pending_confirmation');

    // Filtrar manualmente en JavaScript
    const manualFilter = sqlResult?.filter(order => 
      order.provider_phone === providerPhone
    ) || [];

    return NextResponse.json({
      success: true,
      searchNumber: providerPhone,
      searchNumberLength: providerPhone.length,
      searchNumberType: typeof providerPhone,
      rawResult: {
        data: rawResult,
        error: rawError
      },
      sqlResult: {
        data: sqlResult || [],
        error: sqlError,
        count: sqlResult?.length || 0
      },
      manualFilter: {
        data: manualFilter,
        count: manualFilter.length
      },
      allPhones: sqlResult?.map(o => ({
        id: o.id,
        phone: o.provider_phone,
        phoneType: typeof o.provider_phone,
        phoneLength: o.provider_phone?.length,
        matches: o.provider_phone === providerPhone
      })) || []
    });

  } catch (error) {
    console.error('❌ Error en raw SQL test:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
