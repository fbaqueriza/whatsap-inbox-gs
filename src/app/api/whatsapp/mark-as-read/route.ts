import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { contactId } = await request.json();
    
    console.log('📖 [MarkAsRead] Marcando mensajes como leídos para contacto:', contactId);
    
    if (!contactId) {
      console.error('❌ [MarkAsRead] contactId es requerido');
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
    }

    // Obtener el usuario actual
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');
    
    let accessToken = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    } else if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      accessToken = cookies['sb-access-token'] || cookies['access_token'];
    }

    if (!accessToken) {
      console.error('❌ [MarkAsRead] No se encontró token de acceso');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Crear cliente de Supabase con el token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    );

    // Obtener el usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ [MarkAsRead] Error obteniendo usuario:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('👤 [MarkAsRead] Usuario autenticado:', user.id);

    // Marcar mensajes como leídos
    const { error: updateError } = await supabase
      .from('whatsapp_messages')
      .update({ status: 'read' })
      .eq('contact_id', contactId)
      .eq('user_id', user.id)
      .eq('message_type', 'received');

    if (updateError) {
      console.error('❌ [MarkAsRead] Error actualizando mensajes:', updateError);
      return NextResponse.json({ error: 'Error updating messages' }, { status: 500 });
    }

    console.log('✅ [MarkAsRead] Mensajes marcados como leídos exitosamente');

    return NextResponse.json({ 
      success: true,
      message: 'Messages marked as read',
      contactId: contactId
    });
  } catch (error: any) {
    console.error('❌ [MarkAsRead] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}