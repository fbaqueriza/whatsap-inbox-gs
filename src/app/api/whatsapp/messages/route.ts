import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Verificar variables de entorno antes de crear el cliente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ API messages - Variables de entorno faltantes:', {
    url: !!supabaseUrl,
    key: !!supabaseKey
  });
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    
    let query = supabase
      .from('whatsapp_messages')
      .select('*')
      .order('timestamp', { ascending: true });
    
    // Si se proporciona timestamp, filtrar mensajes más recientes
    if (since) {
      const sinceDate = new Date(parseInt(since));
      query = query.gt('timestamp', sinceDate.toISOString());
    }
    
    const { data: messages, error } = await query;
    
    if (error) {
      console.error('❌ Error obteniendo mensajes:', error);
      return NextResponse.json({ error: 'Error obteniendo mensajes' }, { status: 500 });
    }
    
    // Log para debug
    console.log('📥 API messages - Mensajes obtenidos:', messages?.map(m => ({
      id: m.id,
      message_sid: m.message_sid,
      content: m.content,
      message_type: m.message_type,
      contact_id: m.contact_id,
      timestamp: m.timestamp
    })));
    
    return NextResponse.json({
      messages: messages || [],
      count: messages?.length || 0,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Error en endpoint messages:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Generar un UUID válido para el campo id
    const messageId = randomUUID();
    
    const { data: savedMessage, error } = await supabase
      .from('whatsapp_messages')
      .insert({
        id: messageId,
        message_sid: body.message_sid || body.id || `msg_${Date.now()}`,
        contact_id: body.contact_id,
        content: body.content,
        message_type: body.message_type || 'received',
        status: body.status || 'received',
        user_id: body.user_id || 'default_user',
        timestamp: body.timestamp || new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error guardando mensaje:', error);
      return NextResponse.json({
        success: false,
        error: 'Error guardando mensaje',
        details: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Mensaje guardado correctamente',
      data: savedMessage
    });
  } catch (error) {
    console.error('Error en POST API messages:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 