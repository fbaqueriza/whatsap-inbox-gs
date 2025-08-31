import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Solo crear el cliente si las variables están disponibles
let supabase: any = null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.error('❌ API mark-as-read - Variables de entorno faltantes');
}

export async function POST(request: NextRequest) {
  try {
    // Verificar que Supabase esté inicializado
    if (!supabase) {
      console.error('❌ Supabase no inicializado');
      return NextResponse.json({
        success: false,
        error: 'Database not configured'
      }, { status: 500 });
    }
    
    const body = await request.json();
    const { contactId } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId es requerido' },
        { status: 400 }
      );
    }

    // Marcar mensajes como leídos en la base de datos
    const { error } = await supabase
      .from('whatsapp_messages')
      .update({ status: 'read' })
      .eq('contact_id', contactId)
      .eq('message_type', 'received');

    if (error) {
      console.error('Error marcando mensajes como leídos:', error);
      return NextResponse.json(
        { error: 'Error marcando mensajes como leídos' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en POST /api/whatsapp/mark-as-read:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
