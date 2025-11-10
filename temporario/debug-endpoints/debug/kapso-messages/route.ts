import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoService } from '@/lib/kapsoService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Debug Messages] Obteniendo mensajes directamente de Kapso...');

    // Usar el usuario que sabemos que existe
    const testUser = {
      id: '23cceda2-e52d-4ec4-b93c-277b5576e8af',
      email: 'baqufra@gmail.com'
    };

    console.log('👤 [Debug Messages] Usando usuario de prueba:', testUser.email);

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

    console.log('📱 [Debug Messages] Configuración encontrada:', {
      phone_number: userConfig.whatsapp_phone_number,
      kapso_config_id: userConfig.kapso_config_id
    });

    // Usar KapsoService para obtener conversaciones
    const kapsoService = new KapsoService();
    const conversationsResponse = await kapsoService.getConversationsByConfig(userConfig.kapso_config_id, {
      status: 'active',
      page: 1
    });
    
    console.log('🔍 [Debug Messages] Conversaciones encontradas:', conversationsResponse.length);

    if (conversationsResponse.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay conversaciones',
        conversations: [],
        messages: []
      });
    }

    // Obtener mensajes para cada conversación
    const allMessages = [];
    
    for (const conv of conversationsResponse) {
      console.log(`📱 [Debug Messages] Obteniendo mensajes para conversación: ${conv.id} (${conv.phone_number})`);
      
      try {
        const messagesResponse = await kapsoService.getMessages(conv.id, {
          page: 1,
          per_page: 50
        });
        
        console.log(`📨 [Debug Messages] Mensajes obtenidos para ${conv.phone_number}:`, messagesResponse.data?.length || 0);
        
        if (messagesResponse.data && messagesResponse.data.length > 0) {
          const mappedMessages = messagesResponse.data.map(msg => ({
            id: msg.id,
            conversation_id: msg.conversation_id,
            content: msg.content,
            timestamp: msg.timestamp,
            type: msg.type,
            direction: msg.direction,
            status: msg.status,
            media_url: msg.media_url,
            filename: msg.filename,
            mime_type: msg.mime_type
          }));
          
          allMessages.push(...mappedMessages);
        }
      } catch (error: any) {
        console.error(`❌ [Debug Messages] Error obteniendo mensajes para ${conv.phone_number}:`, error.message);
      }
    }

    console.log('📊 [Debug Messages] Total de mensajes obtenidos:', allMessages.length);

    return NextResponse.json({
      success: true,
      message: `Se encontraron ${allMessages.length} mensajes en ${conversationsResponse.length} conversaciones`,
      conversations: conversationsResponse.map(conv => ({
        id: conv.id,
        phone_number: conv.phone_number,
        contact_name: conv.contact_name,
        status: conv.status,
        last_active_at: conv.last_active_at
      })),
      messages: allMessages
    });

  } catch (error: any) {
    console.error('❌ [Debug Messages] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
