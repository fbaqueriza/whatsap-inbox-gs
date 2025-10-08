/**
 * 🔄 API ENDPOINT: Sincronización Automática de Documentos
 * 
 * Este endpoint sincroniza automáticamente documentos que llegaron
 * pero no se crearon mensajes correspondientes en el chat.
 * Se puede llamar periódicamente o cuando se detecte un nuevo documento.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Iniciando sincronización automática de documentos...');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Obtener documentos que no tienen mensaje correspondiente
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select(`
        id,
        filename,
        file_url,
        file_type,
        mime_type,
        created_at,
        sender_phone,
        provider_id,
        user_id,
        whatsapp_message_id,
        providers!inner(
          id,
          name,
          phone
        )
      `)
      .is('whatsapp_message_id', null) // Solo documentos sin mensaje
      .order('created_at', { ascending: false })
      .limit(20); // Procesar hasta 20 documentos a la vez

    if (docsError) {
      console.error('❌ Error obteniendo documentos:', docsError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo documentos',
        details: docsError.message
      }, { status: 500 });
    }

    if (!documents || documents.length === 0) {
      console.log('✅ No hay documentos para sincronizar');
      return NextResponse.json({
        success: true,
        message: 'No hay documentos para sincronizar',
        synced: 0
      });
    }

    console.log(`📎 Encontrados ${documents.length} documentos para sincronizar`);

    // 2. Crear mensajes para cada documento
    let syncedCount = 0;
    const errors = [];

    for (const doc of documents) {
      try {
        console.log(`📄 Procesando: ${doc.filename}`);

        // Generar UUID para el mensaje
        const messageId = uuidv4();
        
        const messageData = {
          id: messageId,
          content: `📎 ${doc.filename}`,
          message_type: 'received',
          status: 'delivered',
          contact_id: doc.providers.phone,
          user_id: doc.user_id,
          message_sid: `doc_${doc.id}`,
          timestamp: doc.created_at,
          created_at: doc.created_at,
          media_url: doc.file_url,
          media_type: doc.mime_type
        };

        console.log(`📱 Creando mensaje con UUID: ${messageId}`);

        const { data: insertedMessage, error: insertError } = await supabase
          .from('whatsapp_messages')
          .insert([messageData])
          .select('id')
          .single();

        if (insertError) {
          console.error(`❌ Error insertando mensaje:`, insertError);
          errors.push({ document: doc.filename, error: insertError.message });
          continue;
        }

        // 3. Actualizar documento con el ID del mensaje creado
        const { error: updateError } = await supabase
          .from('documents')
          .update({ whatsapp_message_id: insertedMessage.id })
          .eq('id', doc.id);

        if (updateError) {
          console.error(`❌ Error actualizando documento:`, updateError);
          errors.push({ document: doc.filename, error: updateError.message });
          continue;
        }

        console.log(`✅ Sincronizado: ${doc.filename} → ${messageId}`);
        syncedCount++;

      } catch (error) {
        console.error(`❌ Error procesando ${doc.filename}:`, error);
        errors.push({ document: doc.filename, error: error instanceof Error ? error.message : 'Error desconocido' });
      }
    }

    // 4. Resumen
    console.log(`📊 Sincronización completada: ${syncedCount} documentos sincronizados, ${errors.length} errores`);

    return NextResponse.json({
      success: true,
      message: 'Sincronización completada',
      synced: syncedCount,
      errors: errors.length,
      details: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('❌ Error en sincronización automática:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message || 'Error desconocido'
    }, { status: 500 });
  }
}

// También permitir GET para testing
export async function GET(request: NextRequest) {
  return POST(request);
}
