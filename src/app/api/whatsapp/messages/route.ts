import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '20';
    const providerId = searchParams.get('providerId');
    const userId = searchParams.get('userId');

    // 🔧 CORRECCIÓN: Requerir userId como parámetro obligatorio
    if (!userId) {
      console.warn('⚠️ userId es requerido para obtener mensajes');
      return NextResponse.json({ messages: [] });
    }
    
    const currentUserId = userId;

    // 🔧 OPTIMIZACIÓN: Conectar con Supabase para obtener mensajes reales
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Variables de entorno faltantes para mensajes');
      return NextResponse.json({ messages: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

     // 🔧 CORRECCIÓN: Obtener mensajes de WhatsApp con columnas correctas
     let query = supabase
       .from('whatsapp_messages')
       .select('id, content, timestamp, message_type, status, contact_id, user_id, created_at, read_at')
       .order('timestamp', { ascending: false })
       .limit(parseInt(limit));
     
     // 🔧 CORRECCIÓN: Lógica simplificada y escalable
     // Solo incluir mensajes del usuario específico (ya tienen user_id asignado)
     if (currentUserId) {
       query = query.eq('user_id', currentUserId);
     }
    
    // Si hay providerId específico, filtrar por él
    if (providerId) {
      query = query.eq('provider_id', providerId);
    }
    
    const { data: messages, error } = await query;

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
        user_id: userId,
        content: message,
        message_type: type,
        status: direction === 'outbound' ? 'sent' : 'received',
        contact_id: providerId, // Usar providerId como contact_id
        message_sid: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 🔧 CORRECCIÓN: Generar message_sid único
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
