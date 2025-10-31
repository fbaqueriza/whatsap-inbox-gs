import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { KapsoWhatsAppProxyService } from '@/lib/kapsoWhatsAppProxyService';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phoneNumberId = searchParams.get('phoneNumberId');

    if (!phoneNumberId) {
      return NextResponse.json({ 
        error: 'phoneNumberId es requerido' 
      }, { status: 400 });
    }

    // Verificar que el usuario tiene acceso al phoneNumberId
    const { data: config, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('phone_number_id', phoneNumberId)
      .single();

    if (configError || !config) {
      return NextResponse.json({ 
        error: 'Número de teléfono no autorizado' 
      }, { status: 403 });
    }

    const whatsappService = new KapsoWhatsAppProxyService();
    
    const result = await whatsappService.getMessageTemplates(phoneNumberId);

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      templates: result.data,
      message: 'Plantillas obtenidas exitosamente'
    });

  } catch (error) {
    console.error('❌ [WhatsAppTemplates] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
