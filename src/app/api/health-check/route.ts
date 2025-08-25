import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase/client';

export async function GET() {
  try {
    // Verificar configuración de Supabase
    
    // Verificar conexión a Supabase
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    // Verificar tablas principales
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('count')
      .limit(1);
    
    const { data: providersData, error: providersError } = await supabase
      .from('providers')
      .select('count')
      .limit(1);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      supabase: {
        connected: !sessionError,
        sessionError: sessionError?.message || null,
        tables: {
          orders: !ordersError,
          providers: !providersError
        }
      },
      environment: {
        supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
