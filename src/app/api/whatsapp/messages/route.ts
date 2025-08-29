import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');
    const userId = searchParams.get('userId');

    // Si no hay parámetros, devolver mensajes vacíos (para evitar errores)
    if (!providerId || !userId) {
      return NextResponse.json({ messages: [] });
    }

    // 🔧 OPTIMIZACIÓN: Conectar con Supabase para obtener mensajes reales
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Variables de entorno faltantes para mensajes');
      return NextResponse.json({ messages: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener mensajes de WhatsApp con información del proveedor
    const { data: messages, error } = await supabase
      .from('whatsapp_messages')
      .select(`
        *,
        providers!inner(name, phone)
      `)
      .eq('user_id', userId)
      .order('timestamp', { ascending: true })
      .limit(100); // Limitar a 100 mensajes para rendimiento

    if (error) {
      console.error('❌ Error obteniendo mensajes:', error);
      return NextResponse.json({ messages: [] });
    }

    return NextResponse.json({ 
      messages: messages || [],
      count: messages?.length || 0
    });
  } catch (error) {
    console.error('❌ Error en GET /api/whatsapp/messages:', error);
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providerId, userId, message, type = 'text', direction = 'outbound' } = body;

    if (!providerId || !userId || !message) {
      return NextResponse.json(
        { error: 'providerId, userId y message son requeridos' },
        { status: 400 }
      );
    }

    // 🔧 OPTIMIZACIÓN: Guardar mensaje real en Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Variables de entorno faltantes para mensajes');
      return NextResponse.json(
        { error: 'Configuración de base de datos faltante' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: savedMessage, error } = await supabase
      .from('whatsapp_messages')
      .insert([{
        provider_id: providerId,
        user_id: userId,
        content: message,
        type,
        direction,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error guardando mensaje:', error);
      return NextResponse.json(
        { error: 'Error guardando mensaje' },
        { status: 500 }
      );
    }

    console.log('✅ Mensaje guardado exitosamente:', savedMessage.id);
    return NextResponse.json({ 
      success: true,
      message: savedMessage 
    });
  } catch (error) {
    console.error('❌ Error en POST /api/whatsapp/messages:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
