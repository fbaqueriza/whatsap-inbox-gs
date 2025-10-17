import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Obtener conversaciones
    const { data: conversations, error: convError } = await supabase
      .from('kapso_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });

    if (convError) {
      console.error('❌ Error obteniendo conversaciones:', convError);
      return NextResponse.json({ error: 'Error obteniendo conversaciones' }, { status: 500 });
    }

    // Obtener mensajes
    const { data: messages, error: msgError } = await supabase
      .from('kapso_messages')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true });

    if (msgError) {
      console.error('❌ Error obteniendo mensajes:', msgError);
      return NextResponse.json({ error: 'Error obteniendo mensajes' }, { status: 500 });
    }

    // Obtener contactos
    const { data: contacts, error: contError } = await supabase
      .from('kapso_contacts')
      .select('*')
      .eq('user_id', userId);

    if (contError) {
      console.error('❌ Error obteniendo contactos:', contError);
      return NextResponse.json({ error: 'Error obteniendo contactos' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        conversations: conversations || [],
        messages: messages || [],
        contacts: contacts || []
      }
    });

  } catch (error) {
    console.error('❌ Error en API de datos de Kapso:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
