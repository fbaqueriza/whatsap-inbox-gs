import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    // Obtener proveedores
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select(`
        id,
        name,
        phone,
        email,
        created_at
      `)
      .order('name', { ascending: true });

    if (providersError) {
      console.error('Error obteniendo proveedores:', providersError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo proveedores',
        details: providersError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      providers: providers || [],
      count: providers?.length || 0
    });

  } catch (error) {
    console.error('Error general:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
