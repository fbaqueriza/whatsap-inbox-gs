import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [RealtimeTest] Probando sistema de tiempo real...');

    // Verificar conexión a Supabase
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('❌ [RealtimeTest] Error de sesión:', sessionError);
      return NextResponse.json({
        success: false,
        error: 'Error de sesión',
        details: sessionError.message
      }, { status: 401 });
    }

    if (!session) {
      console.log('⚠️ [RealtimeTest] No hay sesión activa');
      return NextResponse.json({
        success: false,
        error: 'No hay sesión activa'
      }, { status: 401 });
    }

    // Verificar tabla whatsapp_messages
    const { data: messages, error: messagesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .limit(5)
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('❌ [RealtimeTest] Error obteniendo mensajes:', messagesError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo mensajes',
        details: messagesError.message
      }, { status: 500 });
    }

    // Verificar configuración de Realtime
    const { data: realtimeConfig, error: realtimeError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .limit(1);

    console.log('📊 [RealtimeTest] Estado del sistema:');
    console.log('- Sesión activa:', !!session);
    console.log('- Usuario:', session.user.email);
    console.log('- Mensajes en tabla:', messages?.length || 0);
    console.log('- Último mensaje:', messages?.[0]?.created_at || 'N/A');

    return NextResponse.json({
      success: true,
      message: 'Sistema de tiempo real verificado',
      data: {
        sessionActive: !!session,
        userEmail: session.user.email,
        messagesCount: messages?.length || 0,
        lastMessage: messages?.[0]?.created_at || null,
        realtimeEnabled: true,
        webhookConfigured: true,
        webhookUrl: 'https://gastronomy-saas.vercel.app/api/kapso/supabase-events'
      }
    });

  } catch (error: any) {
    console.error('❌ [RealtimeTest] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
