import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '20';
    const providerId = searchParams.get('providerId');
    const userId = searchParams.get('userId');

    // 🔧 CORRECCIÓN: Requerir userId como parámetro obligatorio
    if (!userId) {
      console.warn('⚠️ userId es requerido para obtener mensajes');
      return NextResponse.json({ messages: [] });
    }
    
    const currentUserId = userId;

    // 🔧 OPTIMIZACIÓN: Conectar con Supabase para obtener mensajes reales
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Variables de entorno faltantes para mensajes');
      return NextResponse.json({ messages: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

     // 🔧 CORRECCIÓN: Obtener mensajes de WhatsApp con columnas correctas
     let query = supabase
       .from('whatsapp_messages')
       .select('id, content, timestamp, message_type, status, contact_id, user_id, created_at, read_at, media_url, media_type')
       .order('timestamp', { ascending: false })
       .limit(parseInt(limit));
     
     // 🔧 CORRECCIÓN: Lógica más robusta para incluir mensajes del usuario
     if (currentUserId) {
       // Incluir mensajes con user_id específico O mensajes de proveedores del usuario
       query = query.or(`user_id.eq.${currentUserId},user_id.is.null`);
     }
    
    // Si hay providerId específico, filtrar por él
    if (providerId) {
      query = query.eq('provider_id', providerId);
    }
    
    const { data: messages, error } = await query;

    if (error) {
      console.error('❌ Error obteniendo mensajes:', error);
      return NextResponse.json({ messages: [] });
    }

    // 🔧 MEJORA: Filtrar mensajes sin user_id para incluir solo los de proveedores del usuario
    let filteredMessages = messages || [];
    
    if (currentUserId && messages) {
      // Obtener proveedores del usuario para filtrar mensajes sin user_id
      const { data: userProviders } = await supabase
        .from('providers')
        .select('phone')
        .eq('user_id', currentUserId);
      
      if (userProviders && userProviders.length > 0) {
        const userProviderPhones = userProviders.map(p => p.phone);
        
        filteredMessages = messages.filter((msg: any) => {
          // Incluir mensajes con user_id del usuario actual
          if (msg.user_id === currentUserId) {
            return true;
          }
          
          // Para mensajes sin user_id, verificar si el contact_id corresponde a un proveedor del usuario
          if (!msg.user_id && msg.contact_id) {
            return userProviderPhones.some((providerPhone: string) => {
              const normalizedProviderPhone = providerPhone.replace(/\D/g, '');
              const normalizedContactId = msg.contact_id.replace(/\D/g, '');
              return normalizedProviderPhone.includes(normalizedContactId.slice(-8)) || 
                     normalizedContactId.includes(normalizedProviderPhone.slice(-8));
            });
          }
          
          return false;
        });
      } else {
        // Si no hay proveedores, solo incluir mensajes con user_id específico
        filteredMessages = messages.filter((msg: any) => msg.user_id === currentUserId);
      }
    }

    // Logs removidos para limpieza

    return NextResponse.json({ 
      messages: filteredMessages,
      count: filteredMessages.length
    });
  } catch (error) {
    console.error('❌ Error en GET /api/whatsapp/messages:', error);
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providerId, userId, message, type = 'text', direction = 'outbound' } = body;

    if (!providerId || !userId || !message) {
      return NextResponse.json(
        { error: 'providerId, userId y message son requeridos' },
        { status: 400 }
      );
    }

    // 🔧 OPTIMIZACIÓN: Guardar mensaje real en Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Variables de entorno faltantes para mensajes');
      return NextResponse.json(
        { error: 'Configuración de base de datos faltante' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: savedMessage, error } = await supabase
      .from('whatsapp_messages')
      .insert([{
        user_id: userId,
        content: message,
        message_type: type,
        status: direction === 'outbound' ? 'sent' : 'received',
        contact_id: providerId, // Usar providerId como contact_id
        message_sid: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 🔧 CORRECCIÓN: Generar message_sid único
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error guardando mensaje:', error);
      return NextResponse.json(
        { error: 'Error guardando mensaje' },
        { status: 500 }
      );
    }

    console.log('✅ Mensaje guardado exitosamente:', savedMessage.id);
    return NextResponse.json({ 
      success: true,
      message: savedMessage 
    });
  } catch (error) {
    console.error('❌ Error en POST /api/whatsapp/messages:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
