import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Configuración de base de datos faltante' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Obtener todos los usuarios y sus proveedores
    console.log('🔍 Obteniendo usuarios y proveedores...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email');

    if (usersError) {
      console.error('❌ Error obteniendo usuarios:', usersError);
      return NextResponse.json(
        { error: 'Error obteniendo usuarios' },
        { status: 500 }
      );
    }

         // 2. Obtener proveedores de cada usuario de la app
     const userProviderMap = new Map<string, string[]>(); // user_id -> [phone_numbers]

    for (const user of users) {
      const { data: providers, error: providersError } = await supabase
        .from('providers')
        .select('phone')
        .eq('user_id', user.id);

      if (providersError) {
        console.error(`❌ Error obteniendo proveedores para usuario ${user.id}:`, providersError);
        continue;
      }

      const phoneNumbers = providers?.map(p => {
        let phone = p.phone as string;
        if (phone && !phone.startsWith('+')) {
          phone = `+${phone}`;
        }
        return phone;
      }) || [];

             userProviderMap.set(user.id, phoneNumbers);
       console.log(`✅ Usuario de la app ${user.email}: ${phoneNumbers.length} proveedores`);
    }

    // 3. Obtener mensajes sin user_id
    console.log('🔍 Obteniendo mensajes sin user_id...');
    const { data: messagesWithoutUserId, error: messagesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .is('user_id', null)
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('❌ Error obteniendo mensajes:', messagesError);
      return NextResponse.json(
        { error: 'Error obteniendo mensajes' },
        { status: 500 }
      );
    }

    console.log(`✅ Encontrados ${messagesWithoutUserId.length} mensajes sin user_id`);

    // 4. Asignar user_id a los mensajes
    let assignedCount = 0;
    let skippedCount = 0;

    for (const message of messagesWithoutUserId) {
      const contactId = message.contact_id;
      if (!contactId) {
        skippedCount++;
        continue;
      }

      // Normalizar contact_id
      let normalizedContactId = contactId.replace(/[\s\-\(\)]/g, '');
      if (!normalizedContactId.startsWith('+')) {
        normalizedContactId = `+${normalizedContactId}`;
      }

             // Buscar usuario de la app que tenga este número como proveedor
       let assignedUserId = null;
       for (const [userId, phoneNumbers] of userProviderMap.entries()) {
         if (phoneNumbers.includes(normalizedContactId)) {
           assignedUserId = userId; // Este es el user_id del usuario de la app
           break;
         }
       }

      if (assignedUserId) {
        // Actualizar el mensaje con el user_id
        const { error: updateError } = await supabase
          .from('whatsapp_messages')
          .update({ user_id: assignedUserId })
          .eq('id', message.id);

        if (updateError) {
          console.error(`❌ Error actualizando mensaje ${message.id}:`, updateError);
                 } else {
           assignedCount++;
           console.log(`✅ Asignado user_id del usuario de la app ${assignedUserId} a mensaje ${message.id} (contact_id: ${contactId})`);
         }
       } else {
         skippedCount++;
         console.log(`⚠️ No se pudo asignar user_id del usuario de la app a mensaje ${message.id} (contact_id: ${contactId})`);
       }
    }

    console.log(`✅ Proceso completado: ${assignedCount} mensajes asignados, ${skippedCount} omitidos`);

    return NextResponse.json({
      success: true,
      assignedCount,
      skippedCount,
      totalProcessed: messagesWithoutUserId.length
    });

  } catch (error) {
    console.error('❌ Error en assign-user-to-messages:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
