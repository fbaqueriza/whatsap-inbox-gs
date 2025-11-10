import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/whatsapp/update-waba-id
 * Actualizar WABA_ID manualmente para un usuario
 * 
 * Body: { userId: string, wabaId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, wabaId } = body;

    if (!userId || !wabaId) {
      return NextResponse.json({
        success: false,
        error: 'userId y wabaId son requeridos'
      }, { status: 400 });
    }

    console.log(`🔧 [UpdateWabaId] Actualizando WABA_ID para usuario ${userId}: ${wabaId}`);

    // Actualizar WABA_ID en la configuración activa del usuario
    const { data, error } = await supabase
      .from('user_whatsapp_config')
      .update({ waba_id: wabaId })
      .eq('user_id', userId)
      .eq('is_active', true)
      .select()
      .single();

    if (error) {
      console.error('❌ [UpdateWabaId] Error actualizando WABA_ID:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log('✅ [UpdateWabaId] WABA_ID actualizado exitosamente');
    return NextResponse.json({
      success: true,
      message: 'WABA_ID actualizado exitosamente',
      config: data
    });

  } catch (error) {
    console.error('❌ [UpdateWabaId] Error inesperado:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

