import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Solo crear el cliente si las variables están disponibles
let supabase: any = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.error('❌ API users - Variables de entorno faltantes');
}

export async function GET(request: NextRequest) {
  try {
    console.log('📥 API /api/users - Obteniendo usuarios...');
    
    // Verificar que Supabase esté inicializado
    if (!supabase) {
      console.error('❌ Supabase no inicializado');
      return NextResponse.json({
        success: false,
        error: 'Database not configured',
        users: []
      }, { status: 500 });
    }
    
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ API /api/users - Error obteniendo usuarios:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Error obteniendo usuarios' 
      }, { status: 500 });
    }
    
    console.log('✅ API /api/users - Usuarios obtenidos:', users?.length || 0);
    
    return NextResponse.json({
      success: true,
      users: users || []
    });
    
  } catch (error) {
    console.error('❌ API /api/users - Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
