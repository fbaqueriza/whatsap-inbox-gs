import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoService } from '@/lib/kapsoService';
import { normalizePhoneNumber } from '@/lib/phoneNormalization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Debug Contacts Normalized] Verificando contactos con normalización...');

    // Usar el usuario que sabemos que existe
    const testUser = {
      id: '23cceda2-e52d-4ec4-b93c-277b5576e8af',
      email: 'baqufra@gmail.com'
    };

    console.log('👤 [Debug Contacts Normalized] Usando usuario de prueba:', testUser.email);

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

    // Usar KapsoService para obtener conversaciones
    const kapsoService = new KapsoService();
    const conversationsResponse = await kapsoService.getConversations({
      status: 'active',
      page: 1
    });

    console.log('📞 [Debug Contacts Normalized] Conversaciones obtenidas:', conversationsResponse.data.length);

    // Procesar conversaciones con normalización
    const normalizedContacts: any[] = [];
    const phoneNumbers = new Set<string>();

    for (const conv of conversationsResponse.data) {
      const phoneNumber = conv.phone_number || conv.phone;
      if (!phoneNumber) continue;

      // Normalizar el número
      const normalized = normalizePhoneNumber(phoneNumber);
      
      // Verificar si ya existe este número normalizado
      if (phoneNumbers.has(normalized.normalized)) {
        console.log('⚠️ [Debug Contacts Normalized] Número duplicado detectado:', {
          original: phoneNumber,
          normalized: normalized.normalized
        });
        continue;
      }

      phoneNumbers.add(normalized.normalized);

      // Obtener mensajes para este contacto
      const messagesResponse = await kapsoService.getMessagesForPhone(phoneNumber);
      
      normalizedContacts.push({
        originalPhone: phoneNumber,
        normalizedPhone: normalized.normalized,
        contactName: conv.contact_name || normalized.normalized,
        messageCount: messagesResponse.messages.length,
        lastMessage: messagesResponse.messages.length > 0 ? 
          messagesResponse.messages[messagesResponse.messages.length - 1].content : null,
        lastMessageTime: messagesResponse.messages.length > 0 ? 
          messagesResponse.messages[messagesResponse.messages.length - 1].created_at : null
      });
    }

    console.log('📊 [Debug Contacts Normalized] Contactos únicos después de normalización:', normalizedContacts.length);

    return NextResponse.json({
      success: true,
      message: `Se encontraron ${normalizedContacts.length} contactos únicos después de normalización`,
      totalConversations: conversationsResponse.data.length,
      uniqueContacts: normalizedContacts.length,
      contacts: normalizedContacts,
      userConfig: {
        kapso_config_id: userConfig.kapso_config_id,
        whatsapp_phone_number: userConfig.whatsapp_phone_number
      }
    });

  } catch (error: any) {
    console.error('❌ [Debug Contacts Normalized] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
