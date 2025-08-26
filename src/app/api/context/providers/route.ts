import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Verificar variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ API providers - Variables de entorno faltantes');
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

export async function GET(request: NextRequest) {
  try {
    console.log('📥 API /api/context/providers - Obteniendo providers...');
    
    // Obtener el usuario actual de la sesión
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;
    
    if (!currentUserId) {
      console.log('⚠️ No hay usuario autenticado');
      return NextResponse.json({
        success: true,
        providers: [],
        message: 'No authenticated user'
      });
    }
    
    console.log('👤 Usuario actual:', currentUserId);
    
    // Obtener los proveedores del usuario actual
    const { data: providers, error } = await supabase
      .from('providers')
      .select('*')
      .eq('user_id', currentUserId);
    
    if (error) {
      console.error('❌ Error obteniendo providers:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Error obteniendo providers' 
      }, { status: 500 });
    }
    
    console.log('✅ Providers obtenidos:', providers?.length || 0);
    
    return NextResponse.json({
      success: true,
      providers: providers || [],
      message: 'Providers obtenidos correctamente'
    });
    
  } catch (error) {
    console.error('❌ API /api/context/providers - Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
