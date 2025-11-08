import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoService } from '@/lib/kapsoService';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      success: false,
      error: 'Endpoint disponible solo en entornos de desarrollo',
    }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber') || '541135562673';

    console.log('🔍 [Debug Messages Normalized] Probando mensajes con normalización...');
    console.log('📱 Número de teléfono:', phoneNumber);

    // Usar el usuario que sabemos que existe
    const testUser = {
      id: '23cceda2-e52d-4ec4-b93c-277b5576e8af',
      email: 'baqufra@gmail.com'
    };

    console.log('👤 [Debug Messages Normalized] Usando usuario de prueba:', testUser.email);

    // Obtener configuración de WhatsApp del usuario
    const { data: userConfig, error: configError } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', testUser.id)
      .eq('is_active', true)
      .single();

    if (configError || !userConfig) {
      return NextResponse.json({ 
        error: 'No se encontró configuración de WhatsApp',
        details: configError?.message
      }, { status: 400 });
    }

    console.log('📱 [Debug Messages Normalized] Configuración encontrada:', {
      phone_number: userConfig.whatsapp_phone_number,
      kapso_config_id: userConfig.kapso_config_id
    });

    // Usar KapsoService para obtener mensajes con normalización
    const kapsoService = new KapsoService();
    
    console.log('🔍 [Debug Messages Normalized] Obteniendo mensajes para:', phoneNumber);
    const messagesResponse = await kapsoService.getMessagesForPhone(phoneNumber);
    
    console.log('📨 [Debug Messages Normalized] Mensajes obtenidos:', messagesResponse.messages.length);

    return NextResponse.json({
      success: true,
      message: `Se encontraron ${messagesResponse.messages.length} mensajes para ${phoneNumber}`,
      phoneNumber: phoneNumber,
      messages: messagesResponse.messages,
      hasMore: messagesResponse.hasMore,
      userConfig: {
        kapso_config_id: userConfig.kapso_config_id,
        whatsapp_phone_number: userConfig.whatsapp_phone_number
      }
    });

  } catch (error: any) {
    console.error('❌ [Debug Messages Normalized] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
