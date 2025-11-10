import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoService } from '@/lib/kapsoService';
import { normalizePhoneNumber } from '@/lib/phoneNormalization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Debug Frontend Normalization] Verificando normalización en frontend...');

    // Usar el usuario que sabemos que existe
    const testUser = {
      id: '23cceda2-e52d-4ec4-b93c-277b5576e8af',
      email: 'baqufra@gmail.com'
    };

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

    // Simular la lógica del frontend
    const kapsoService = new KapsoService();
    const conversationsResponse = await kapsoService.getConversations({
      status: 'active',
      page: 1
    });

    console.log('📞 [Debug Frontend Normalization] Conversaciones obtenidas:', conversationsResponse.data.length);

    // Simular el procesamiento del frontend con normalización
    const processedContacts: any[] = [];
    const contactIds = new Set<string>();

    for (const conv of conversationsResponse.data) {
      const phoneNumber = conv.phone_number || conv.phone;
      if (!phoneNumber) continue;

      // Normalizar el número como lo hace el frontend
      const normalizedPhone = normalizePhoneNumber(phoneNumber).normalized;
      
      // Verificar si ya existe este contacto normalizado
      if (contactIds.has(normalizedPhone)) {
        console.log('⚠️ [Debug Frontend Normalization] Contacto duplicado detectado:', {
          original: phoneNumber,
          normalized: normalizedPhone
        });
        continue;
      }

      contactIds.add(normalizedPhone);

      // Obtener mensajes para este contacto
      const messagesResponse = await kapsoService.getMessagesForPhone(phoneNumber);
      
      // Simular el mapeo de mensajes como lo hace el frontend
      const mappedMessages = messagesResponse.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        contact_id: normalizedPhone, // Usar número normalizado como ID único
        contact_name: conv.contact_name || normalizedPhone,
        timestamp: new Date(msg.created_at),
        type: msg.message_type || 'text',
        direction: msg.direction,
        status: msg.status || 'delivered'
      }));

      processedContacts.push({
        originalPhone: phoneNumber,
        normalizedPhone: normalizedPhone,
        contactName: conv.contact_name || normalizedPhone,
        messageCount: mappedMessages.length,
        contactId: normalizedPhone,
        messages: mappedMessages
      });
    }

    console.log('📊 [Debug Frontend Normalization] Contactos únicos después de procesamiento:', processedContacts.length);

    return NextResponse.json({
      success: true,
      message: `Frontend procesaría ${processedContacts.length} contactos únicos`,
      totalConversations: conversationsResponse.data.length,
      uniqueContacts: processedContacts.length,
      contacts: processedContacts,
      userConfig: {
        kapso_config_id: userConfig.kapso_config_id,
        whatsapp_phone_number: userConfig.whatsapp_phone_number
      }
    });

  } catch (error: any) {
    console.error('❌ [Debug Frontend Normalization] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
