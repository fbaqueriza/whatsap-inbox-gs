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

    // Obtener user_id de los headers o query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'user_id es requerido'
      }, { status: 400 });
    }

    // Obtener proveedores del usuario
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (providersError) {
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
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}