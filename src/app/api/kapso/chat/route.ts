import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoService } from '@/lib/kapsoService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 🔧 RATE LIMITING: Prevenir loops infinitos
const requestCache = new Map<string, { timestamp: number; response: any }>();
const CACHE_DURATION = 5000; // 5 segundos

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const phoneNumber = searchParams.get('phoneNumber');
    const cursor = searchParams.get('cursor');
    
    // 🔧 RATE LIMITING: Verificar caché para prevenir loops
    const cacheKey = `${action}-${phoneNumber || 'undefined'}`;
    const cached = requestCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log('🔍 [KapsoChat] Usando respuesta en caché para:', cacheKey);
      return NextResponse.json(cached.response);
    }

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

    switch (action) {
      case 'conversations':
        console.log('🔍 [KapsoChat] GET request - action: conversations, user:', user.email);
        
        try {
          // 🔧 SEGURIDAD: Obtener configuración de WhatsApp del usuario
          console.log('📱 [KapsoChat] Obteniendo configuración de WhatsApp del usuario...');
          
          const { data: userConfig, error: configError } = await supabase
            .from('user_whatsapp_config')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single();

          if (configError || !userConfig) {
            console.error('❌ [KapsoChat] Error obteniendo configuración de WhatsApp:', configError);
            return NextResponse.json({ 
              success: true, 
              conversations: [], 
              data: [] 
            });
          }

          console.log('📱 [KapsoChat] Configuración encontrada:', {
            phone_number: userConfig.whatsapp_phone_number,
            kapso_config_id: userConfig.kapso_config_id,
            is_sandbox: userConfig.is_sandbox
          });

          // 🔧 SEGURIDAD: Usar Kapso con filtrado por whatsapp_config_id
          let conversationsResponse;
          if (userConfig.kapso_config_id) {
            console.log('📱 [KapsoChat] Obteniendo conversaciones por configuración de Kapso:', userConfig.kapso_config_id);
            const kapsoService = new KapsoService();
            conversationsResponse = await kapsoService.getConversationsByConfig(userConfig.kapso_config_id, {
              status: 'active',
              page: 1
            });
          } else {
            console.log('⚠️ [KapsoChat] No hay kapso_config_id, no se pueden obtener conversaciones de forma segura');
            // No obtener conversaciones si no hay kapso_config_id para evitar mostrar datos de otros usuarios
            conversationsResponse = { data: [], meta: { total_count: 0 } };
          }
          
          console.log('🔍 [KapsoChat] Conversaciones de Kapso obtenidas:', conversationsResponse.data?.length || conversationsResponse.length);
          console.log('🔍 [KapsoChat] Conversaciones raw:', (conversationsResponse.data || conversationsResponse).map(c => ({
            phone: c.phone_number,
            contact_name: c.contact_name
          })));

          // Mapear conversaciones para el formato esperado
          const conversations = conversationsResponse.data || conversationsResponse;
          const mappedConversations = conversations.map(conv => ({
            id: conv.id,
            phone_number: conv.phone_number,
            contact_name: conv.contact_name || conv.phone_number,
            status: conv.status,
            last_active_at: conv.last_active_at,
            whatsapp_config_id: conv.whatsapp_config_id
          }));


                  console.log('🔍 [KapsoChat] Respuesta final:', {
                    success: true, 
                    conversations: mappedConversations.length,
                    data: mappedConversations 
                  });

                  const response = { 
                    success: true, 
                    conversations: mappedConversations,
                    data: mappedConversations 
                  };
                  
                  // 🔧 RATE LIMITING: Guardar en caché
                  requestCache.set(cacheKey, { timestamp: now, response });
                  
                  return NextResponse.json(response);

        } catch (kapsoError) {
          console.error('❌ [KapsoChat] Error obteniendo conversaciones de Kapso:', kapsoError);
          return NextResponse.json({ 
            success: true, 
            data: [] 
          });
        }

              case 'messages':
                if (!phoneNumber || phoneNumber === 'undefined') {
                  console.log('⚠️ [KapsoChat] Llamada bloqueada: phoneNumber inválido:', phoneNumber);
                  const errorResponse = { 
                    success: true, 
                    messages: [],
                    hasMore: false,
                    nextCursor: null
                  };
                  
                  // 🔧 RATE LIMITING: Guardar error en caché para prevenir loops
                  requestCache.set(cacheKey, { timestamp: now, response: errorResponse });
                  
                  return NextResponse.json(errorResponse);
                }

        console.log('🔍 [KapsoChat] GET request - action: messages, phoneNumber:', phoneNumber, 'user:', user.email);

        try {
          // Usar KapsoService singleton para obtener mensajes de Kapso
          const kapsoService = new KapsoService();
          const messagesResponse = await kapsoService.getMessagesForPhone(phoneNumber);
          
                  console.log('🔍 [KapsoChat] Mensajes de Kapso obtenidos:', messagesResponse.messages.length);

                  const response = { 
                    success: true, 
                    messages: messagesResponse.messages || [],
                    hasMore: messagesResponse.hasMore,
                    nextCursor: null
                  };
                  
                  // 🔧 RATE LIMITING: Guardar en caché
                  requestCache.set(cacheKey, { timestamp: now, response });
                  
                  return NextResponse.json(response);

        } catch (kapsoError) {
          console.error('❌ [KapsoChat] Error obteniendo mensajes de Kapso:', kapsoError);
          return NextResponse.json({ 
            success: true, 
            messages: [],
            hasMore: false,
            nextCursor: null
          });
        }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error en API Kapso Chat:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
