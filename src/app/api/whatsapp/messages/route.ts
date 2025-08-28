import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');
    const userId = searchParams.get('userId');

    // Si no hay parámetros, devolver mensajes vacíos (para evitar errores)
    if (!providerId || !userId) {
      return NextResponse.json({ messages: [] });
    }

    // Simular mensajes vacíos (en producción esto conectaría con Supabase)
    return NextResponse.json({ messages: [] });
  } catch (error) {
    console.error('Error en GET /api/whatsapp/messages:', error);
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providerId, userId, message, type = 'text' } = body;

    if (!providerId || !userId || !message) {
      return NextResponse.json(
        { error: 'providerId, userId y message son requeridos' },
        { status: 400 }
      );
    }

    // Simular guardado de mensaje (en producción esto conectaría con Supabase)
    const mockMessage = {
      id: `msg_${Date.now()}`,
      provider_id: providerId,
      user_id: userId,
      message,
      type,
      direction: 'outbound',
      created_at: new Date().toISOString()
    };

    return NextResponse.json({ message: mockMessage });
  } catch (error) {
    console.error('Error en POST /api/whatsapp/messages:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
