import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaWhatsAppService } from '@/lib/metaWhatsAppService';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 ===== API SEND-DOCUMENT INICIADO =====');
    
    // Parsear el FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const recipient = formData.get('recipient') as string;
    const message = formData.get('message') as string || '';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    if (!recipient) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó el destinatario' },
        { status: 400 }
      );
    }

    console.log('📄 Documento recibido:', {
      name: file.name,
      size: file.size,
      type: file.type,
      recipient,
      message: message.substring(0, 50) + '...'
    });

    // Validar tipo de archivo
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de archivo no permitido' },
        { status: 400 }
      );
    }

    // Validar tamaño (máximo 16MB para WhatsApp)
    const maxSize = 16 * 1024 * 1024; // 16MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'El archivo es demasiado grande. Máximo 16MB' },
        { status: 400 }
      );
    }

    // Subir archivo a Supabase Storage
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'Configuración de almacenamiento faltante' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `documents/${timestamp}_${file.name}`;

    console.log('📤 Subiendo archivo a Supabase Storage...');

    // Convertir File a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Error subiendo archivo:', uploadError);
      return NextResponse.json(
        { success: false, error: 'Error subiendo archivo' },
        { status: 500 }
      );
    }

    // Obtener URL pública del archivo
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(fileName);

    console.log('✅ Archivo subido exitosamente:', publicUrl);

    // Determinar tipo de media para WhatsApp
    let mediaType = 'document';
    if (file.type.startsWith('image/')) {
      mediaType = 'image';
    }

    // Enviar documento por WhatsApp
    const whatsappService = new MetaWhatsAppService();
    const result = await whatsappService.sendMessageWithDocument(
      recipient,
      message,
      publicUrl,
      mediaType
    );

    if (!result) {
      // Si falla el envío, eliminar el archivo subido
      await supabase.storage.from('whatsapp-media').remove([fileName]);
      
      return NextResponse.json(
        { success: false, error: 'Error enviando documento por WhatsApp' },
        { status: 500 }
      );
    }

    console.log('✅ Documento enviado por WhatsApp exitosamente');

    // Guardar mensaje en la base de datos
    const { data: messageData, error: dbError } = await supabase
      .from('whatsapp_messages')
      .insert([{
        id: result.messages?.[0]?.id || `msg_${Date.now()}`,
        content: message || `[Documento: ${file.name}]`,
        message_type: 'sent',
        contact_id: recipient,
        user_id: 'system', // TODO: Obtener del contexto de usuario
        status: 'sent',
        timestamp: new Date().toISOString(),
        media_url: publicUrl,
        media_type: mediaType,
        filename: file.name,
        file_size: file.size
      }]);

    if (dbError) {
      console.error('❌ Error guardando mensaje en BD:', dbError);
      // No fallar el request por esto, el documento ya se envió
    }

    console.log('🏁 ===== API SEND-DOCUMENT FINALIZADO =====');

    return NextResponse.json({
      success: true,
      message: 'Documento enviado exitosamente',
      data: {
        messageId: result.messages?.[0]?.id,
        mediaUrl: publicUrl,
        filename: file.name,
        fileSize: file.size
      }
    });

  } catch (error) {
    console.error('❌ Error en send-document:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}
