import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'disable') {
      // 🔧 OPTIMIZACIÓN: Deshabilitar Realtime temporalmente
      // Esto se puede usar para evitar errores mientras se configura Supabase
      return NextResponse.json({
        success: true,
        message: 'Realtime deshabilitado temporalmente',
        note: 'Configure Realtime en Supabase Dashboard > Database > Replication'
      });
    }

    if (action === 'status') {
      return NextResponse.json({
        success: true,
        realtimeEnabled: false,
        message: 'Realtime no está configurado en Supabase',
        instructions: [
          '1. Ve a Supabase Dashboard',
          '2. Selecciona tu proyecto',
          '3. Ve a Database > Replication',
          '4. Habilita Realtime para las tablas: orders, pending_orders, whatsapp_messages'
        ]
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Acción no válida'
    });

  } catch (error) {
    console.error('❌ Error en disable-realtime:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
