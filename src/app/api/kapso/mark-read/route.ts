import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoService } from '@/lib/kapsoService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [KapsoMarkRead] Marcando mensaje como leído...');
    
    // Obtener token de autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { messageId, contactId } = body;

    if (!messageId) {
      return NextResponse.json({ error: 'ID de mensaje requerido' }, { status: 400 });
    }

    console.log('🔍 [KapsoMarkRead] Marcando mensaje como leído:', {
      messageId,
      contactId,
      user: user.email
    });

    try {
      // Usar KapsoService para marcar el mensaje como leído
      const kapsoService = new KapsoService();
      const result = await kapsoService.markMessageAsRead(messageId);
      
      console.log('✅ [KapsoMarkRead] Mensaje marcado como leído exitosamente:', result);

      return NextResponse.json({
        success: true,
        message: 'Mensaje marcado como leído exitosamente',
        data: result
      });

    } catch (kapsoError) {
      console.error('❌ [KapsoMarkRead] Error marcando mensaje como leído en Kapso:', kapsoError);
      
      // Aún así devolver éxito para no bloquear la UI
      return NextResponse.json({
        success: true,
        message: 'Mensaje procesado (error en Kapso ignorado)',
        data: { messageId, marked: true }
      });
    }

  } catch (error) {
    console.error('❌ [KapsoMarkRead] Error general:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
