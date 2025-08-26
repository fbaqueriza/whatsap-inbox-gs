import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const to = formData.get('to') as string;

    if (!file || !to) {
      return NextResponse.json(
        { success: false, error: 'Archivo y destinatario son requeridos' },
        { status: 400 }
      );
    }

    // Validar tipo de archivo
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de archivo no permitido' },
        { status: 400 }
      );
    }

    // Validar tamaño (máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'El archivo es demasiado grande (máximo 10MB)' },
        { status: 400 }
      );
    }

    // Crear directorio para documentos si no existe
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'documents');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = join(uploadDir, fileName);

    // Guardar archivo
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // URL pública del archivo
    const documentUrl = `/uploads/documents/${fileName}`;

    // Enviar documento a través de Twilio (simulado por ahora)
    // En una implementación real, usarías la API de Twilio para enviar documentos
    console.log(`📎 Documento guardado: ${documentUrl}`);
    console.log(`📤 Enviando documento a: ${to}`);

    // Simular envío exitoso
    const messageId = `doc-${timestamp}`;

    // Guardar en base de datos
    const userId = null; // En una implementación real, obtendrías el userId del contexto
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error } = await supabase
        .from('whatsapp_messages')
        .insert({
          message_sid: messageId,
          contact_id: to,
          content: `Documento: ${file.name}`,
          message_type: 'sent',
          status: 'sent',
          user_id: userId,
          document_url: documentUrl,
          document_name: file.name,
          document_size: file.size,
          document_type: file.type
        });

      if (error) {
        console.error('Error guardando documento en BD:', error);
      }
    } catch (error) {
      console.error('Error guardando documento en BD:', error);
    }

    return NextResponse.json({
      success: true,
      messageId,
      documentUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

  } catch (error) {
    console.error('Error enviando documento:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}