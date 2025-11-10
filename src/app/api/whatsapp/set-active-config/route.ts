import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const phoneNumberId = body.phoneNumberId || request.nextUrl.searchParams.get('phoneNumberId');
    const kapsoConfigId = body.kapsoConfigId || request.nextUrl.searchParams.get('kapsoConfigId');
    const phoneNumber = body.phoneNumber || request.nextUrl.searchParams.get('phoneNumber');

    if (!phoneNumberId || !kapsoConfigId) {
      return NextResponse.json({ success: false, error: 'phoneNumberId y kapsoConfigId son requeridos' }, { status: 400 });
    }

    // Obtener usuario autenticado
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      } catch {}
    }

    // Permitir override local por ?userId=... en desarrollo
    const url = new URL(request.url);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const overrideUserId = url.searchParams.get('userId');
    if (!userId && isLocal && overrideUserId) {
      userId = overrideUserId;
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Usuario no autenticado' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Desactivar otras configuraciones del usuario
    await supabase
      .from('user_whatsapp_config')
      .update({ is_active: false })
      .eq('user_id', userId);

    // Upsert configuración activa
    const upsertData: any = {
      user_id: userId,
      kapso_config_id: kapsoConfigId,
      phone_number_id: phoneNumberId,
      is_active: true
    };
    if (phoneNumber) {
      upsertData.whatsapp_phone_number = phoneNumber;
    }

    const { data, error } = await supabase
      .from('user_whatsapp_config')
      .upsert(upsertData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, config: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as any)?.message || 'Error desconocido' }, { status: 500 });
  }
}


