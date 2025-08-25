import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/serverClient';

export async function GET(request: NextRequest) {
  try {
    // Obtener el token de autorización del header
    const authHeader = request.headers.get('authorization');
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // Verificar el token y obtener el usuario
        const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
        if (user && !authError) {
          userId = user.id;
        }
      } catch (error) {
        console.log('⚠️ API data/providers - Error verificando token:', error);
      }
    }
    
    // Construir la consulta
    let query = supabaseServer.from('providers').select('*').order('name');
    
    // Si hay usuario autenticado, filtrar por user_id
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data: providers, error } = await query;
    
    if (error) {
      console.error('❌ Error obteniendo providers:', error);
      return NextResponse.json(
        { error: 'Error obteniendo providers' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      providers: providers || [] 
    });

  } catch (error) {
    console.error('❌ Error en API data/providers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
