import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');
    const userId = searchParams.get('userId');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Variables de entorno faltantes' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener proveedores
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('*')
      .eq('user_id', userId || 'b5a237e6-c9f9-4561-af07-a1408825ab50')
      .order('created_at', { ascending: false });

    // Obtener stock items
    const { data: stockItems, error: stockError } = await supabase
      .from('stock')
      .select(`
        *,
        associated_providers
      `)
      .eq('user_id', userId || 'b5a237e6-c9f9-4561-af07-a1408825ab50')
      .order('preferred_provider', { ascending: true });

    // Obtener items específicos del proveedor si se especifica
    let providerItems = [];
    if (providerId) {
      const { data: items, error: itemsError } = await supabase
        .from('stock')
        .select('*')
        .eq('user_id', userId || 'b5a237e6-c9f9-4561-af07-a1408825ab50')
        .contains('associated_providers', [providerId]);
      
      providerItems = items || [];
    }

    return NextResponse.json({
      success: true,
      data: {
        providers: providers || [],
        stockItems: stockItems || [],
        providerItems: providerItems,
        errors: {
          providers: providersError?.message,
          stock: stockError?.message
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en provider-items:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
