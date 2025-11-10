/**
 * 🔄 API ENDPOINT: Sincronizar Documentos al Chat
 * 
 * Sincroniza documentos existentes en la carpeta del proveedor
 * creando mensajes correspondientes en whatsapp_messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';

export async function POST(request: NextRequest) {
  try {
    const { providerId, userId } = await request.json();

    if (!providerId || !userId) {
      return NextResponse.json({
        success: false,
        error: 'providerId y userId son requeridos'
      }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    console.log(`🔄 Sincronizando documentos del proveedor ${providerId} para el usuario ${userId}`);

    // 1. Obtener documentos del proveedor que no tienen mensaje correspondiente
    const { data: documents, error: documentsError } = await supabase
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
        providers!inner(
          id,
          name,
          phone
        )
      `)
      .eq('provider_id', providerId)
      .eq('user_id', userId)
      .is('whatsapp_message_id', null)
      .order('created_at', { ascending: false });

    if (documentsError) {
      console.error('Error obteniendo documentos:', documentsError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo documentos',
        details: documentsError.message
      }, { status: 500 });
    }

    if (!documents || documents.length === 0) {
      console.log('No hay documentos para sincronizar');
      return NextResponse.json({
        success: true,
        message: 'No hay documentos para sincronizar',
        synced: 0
      });
    }

    console.log(`📎 Encontrados ${documents.length} documentos para sincronizar`);

    // 2. Crear mensajes en whatsapp_messages para cada documento
    const messagesToInsert = documents.map(doc => ({
      id: `doc_${doc.id}_${Date.now()}`,
      content: `📎 ${doc.filename}`,
      message_type: 'received',
      status: 'delivered',
      contact_id: doc.providers.phone,
      user_id: userId,
      message_sid: `doc_${doc.id}`,
      timestamp: doc.created_at,
      created_at: doc.created_at,
      media_url: doc.file_url,
      media_type: doc.mime_type
    }));

    const { data: insertedMessages, error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert(messagesToInsert)
      .select('id');

    if (insertError) {
      console.error('Error insertando mensajes:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Error insertando mensajes',
        details: insertError.message
      }, { status: 500 });
    }

    // 3. Actualizar documentos con el ID del mensaje creado
    const updatePromises = documents.map((doc, index) => {
      const messageId = insertedMessages[index]?.id;
      if (messageId) {
        return supabase
          .from('documents')
          .update({ whatsapp_message_id: messageId })
          .eq('id', doc.id);
      }
      return Promise.resolve({ error: null });
    });

    const updateResults = await Promise.all(updatePromises);
    const updateErrors = updateResults.filter(result => result.error);

    if (updateErrors.length > 0) {
      console.warn('Algunos documentos no se pudieron actualizar:', updateErrors);
    }

    console.log(`✅ Sincronizados ${insertedMessages.length} documentos al chat`);

    return NextResponse.json({
      success: true,
      message: 'Documentos sincronizados exitosamente',
      synced: insertedMessages.length,
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        file_type: doc.file_type
      }))
    });

  } catch (error: any) {
    console.error('Error in sync documents to chat API:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message || 'Error desconocido'
    }, { status: 500 });
  }
}
