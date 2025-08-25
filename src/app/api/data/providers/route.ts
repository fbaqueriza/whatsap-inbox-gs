import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usar las variables de entorno correctas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ API data/providers - Variables de entorno faltantes:', {
    url: !!supabaseUrl,
    key: !!supabaseKey
  });
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener el token de autorización del header
    const authHeader = request.headers.get('authorization');
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // Verificar el token y obtener el usuario
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (user && !authError) {
          userId = user.id;
        }
      } catch (error) {
        console.log('⚠️ API data/providers - Error verificando token:', error);
      }
    }
    
    // Construir la consulta
    let query = supabase.from('providers').select('*').order('name');
    
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

    return NextResponse.json({ providers });

  } catch (error) {
    console.error('❌ Error en API data/providers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
