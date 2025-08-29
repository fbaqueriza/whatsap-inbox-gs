import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, table, event } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Variables de entorno faltantes' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === 'test_subscription') {
      // Crear una suscripción de prueba
      const channel = supabase
        .channel('test-channel')
        .on(
          'postgres_changes',
          {
            event: event || 'INSERT',
            schema: 'public',
            table: table || 'orders'
          },
          (payload) => {
            console.log('🔔 Evento Realtime recibido:', payload);
          }
        )
        .subscribe((status) => {
          console.log('📡 Estado de suscripción:', status);
        });

      return NextResponse.json({
        success: true,
        message: 'Suscripción de prueba creada',
        channel: 'test-channel',
        table,
        event
      });
    }

    if (action === 'test_insert') {
      // Insertar un registro de prueba para verificar Realtime
      const { data, error } = await supabase
        .from('orders')
        .insert([{
          user_id: 'b5a237e6-c9f9-4561-af07-a1408825ab50', // UUID válido
          provider_id: '4e0c6eec-dee9-4cea-ad9b-d2476fb30409', // UUID válido
          status: 'test',
          items: [],
          order_number: `TEST-${Date.now()}`,
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) {
        return NextResponse.json({
          success: false,
          error: 'Error insertando registro de prueba',
          details: error.message
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Registro de prueba insertado',
        data
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Acción no válida'
    });

  } catch (error) {
    console.error('❌ Error en test-realtime:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
