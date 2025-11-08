import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoService } from '@/lib/kapsoService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Debug Frontend] Simulando llamada del frontend...');

    // Usar el usuario que sabemos que existe
    const testUser = {
      id: '23cceda2-e52d-4ec4-b93c-277b5576e8af',
      email: 'baqufra@gmail.com'
    };

    console.log('👤 [Debug Frontend] Usando usuario de prueba:', testUser.email);

    // Obtener configuración de WhatsApp del usuario
    const { data: userConfig, error: configError } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', testUser.id)
      .eq('is_active', true)
      .single();

    if (configError || !userConfig) {
      return NextResponse.json({ 
        success: true, 
        conversations: [], 
        data: [] 
      });
    }

    console.log('📱 [Debug Frontend] Configuración encontrada:', {
      phone_number: userConfig.whatsapp_phone_number,
      kapso_config_id: userConfig.kapso_config_id,
      is_sandbox: userConfig.is_sandbox
    });

    // Usar KapsoService para obtener conversaciones
    const kapsoService = new KapsoService();
    const conversationsResponse = await kapsoService.getConversationsByConfig(userConfig.kapso_config_id, {
      status: 'active',
      page: 1
    });
    
    console.log('🔍 [Debug Frontend] Conversaciones de Kapso obtenidas:', conversationsResponse.length);

    // Mapear conversaciones para el formato esperado
    const mappedConversations = conversationsResponse.map(conv => ({
      id: conv.id,
      phone_number: conv.phone_number,
      contact_name: conv.contact_name || conv.phone_number,
      status: conv.status,
      last_active_at: conv.last_active_at,
      whatsapp_config_id: conv.whatsapp_config_id
    }));

    console.log('🔍 [Debug Frontend] Conversaciones mapeadas:', mappedConversations.length);

    // Simular la respuesta exacta que recibe el frontend
    const response = { 
      success: true, 
      conversations: mappedConversations,
      data: mappedConversations 
    };
    
    console.log('📊 [Debug Frontend] Respuesta final:', {
      success: response.success,
      conversationsCount: response.conversations.length,
      dataCount: response.data.length
    });

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [Debug Frontend] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
