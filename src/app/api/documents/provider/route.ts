/**
 * 📁 API ENDPOINT: Documentos del Proveedor
 * 
 * Permite acceder a todos los documentos de un proveedor específico
 * desde el frontend
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('provider_id');
    const userId = searchParams.get('user_id');
    const fileType = searchParams.get('file_type'); // opcional: 'factura', 'comprobante', 'catalogo', etc.
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!providerId || !userId) {
      return NextResponse.json({
        success: false,
        error: 'provider_id y user_id son requeridos'
      }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    // Construir query con filtros
    let query = supabase
      .from('documents')
      .select(`
        id,
        filename,
        file_url,
        file_size,
        file_type,
        mime_type,
        status,
        sender_phone,
        whatsapp_message_id,
        extracted_text,
        ocr_data,
        confidence_score,
        created_at,
        updated_at,
        processed_at,
        order_id,
        providers!inner(
          id,
          name,
          phone
        )
      `)
      .eq('user_id', userId)
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Aplicar filtro de tipo si se especifica
    if (fileType) {
      query = query.eq('file_type', fileType);
    }

    const { data: documents, error: documentsError } = await query;

    if (documentsError) {
      console.error('Error obteniendo documentos del proveedor:', documentsError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo documentos',
        details: documentsError.message
      }, { status: 500 });
    }

    // Obtener estadísticas del proveedor
    const { data: stats, error: statsError } = await supabase
      .from('documents')
      .select('file_type, status')
      .eq('user_id', userId)
      .eq('provider_id', providerId);

    const providerStats = {
      total: stats?.length || 0,
      by_type: {
        factura: stats?.filter(d => d.file_type === 'factura').length || 0,
        comprobante: stats?.filter(d => d.file_type === 'comprobante').length || 0,
        catalogo: stats?.filter(d => d.file_type === 'catalogo').length || 0,
        foto: stats?.filter(d => d.file_type === 'foto').length || 0,
        other: stats?.filter(d => d.file_type === 'other').length || 0
      },
      by_status: {
        pending: stats?.filter(d => d.status === 'pending').length || 0,
        processing: stats?.filter(d => d.status === 'processing').length || 0,
        processed: stats?.filter(d => d.status === 'processed').length || 0,
        assigned: stats?.filter(d => d.status === 'assigned').length || 0,
        error: stats?.filter(d => d.status === 'error').length || 0
      }
    };

    return NextResponse.json({
      success: true,
      data: {
        documents: documents || [],
        stats: providerStats,
        pagination: {
          limit,
          offset,
          total: providerStats.total,
          has_more: (offset + limit) < providerStats.total
        }
      }
    });

  } catch (error: any) {
    console.error('Error in provider documents API:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message || 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * 📤 POST: Subir documento manualmente a un proveedor
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const providerId = formData.get('provider_id') as string;
    const userId = formData.get('user_id') as string;
    const fileType = formData.get('file_type') as string || 'other';

    if (!file || !providerId || !userId) {
      return NextResponse.json({
        success: false,
        error: 'file, provider_id y user_id son requeridos'
      }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    // Convertir archivo a buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Generar nombre único
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const fileExtension = file.name.split('.').pop() || 'bin';
    const uniqueFilename = `manual_${timestamp}_${randomId}.${fileExtension}`;
    
    // Ruta en storage: providers/{userId}/{providerId}/{filename}
    const storagePath = `providers/${userId}/${providerId}/${uniqueFilename}`;
    
    // Subir archivo
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('files')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Error subiendo archivo:', uploadError);
      return NextResponse.json({
        success: false,
        error: 'Error subiendo archivo',
        details: uploadError.message
      }, { status: 500 });
    }

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('files')
      .getPublicUrl(storagePath);

    // ✅ OPTIMIZADO: Procesar documento con OCR automáticamente si es factura
    if (fileType === 'factura') {
      try {
        const { manualDocumentProcessor } = await import('../../../../lib/manualDocumentProcessor');
        const requestId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 🔧 CRÍTICO: Usar el mismo cliente supabase que se pasa en la función
        // Este cliente ya tiene el contexto correcto para disparar Realtime
        const result = await manualDocumentProcessor.processManualDocument({
          file: fileBuffer,
          filename: uniqueFilename,
          mimeType: file.type,
          providerId,
          userId,
          requestId,
          supabaseClient: supabase // 🔧 CRÍTICO: Usar el cliente que dispara Realtime
        });

        if (result.success && result.documentId) {
          return NextResponse.json({
            success: true,
            data: {
              document_id: result.documentId,
              filename: uniqueFilename,
              file_url: publicUrl,
              file_size: fileBuffer.length,
              order_id: result.orderId,
              ocr_processed: true
            }
          });
        }
      } catch (ocrError) {
        console.error('Error procesando OCR, creando documento sin OCR:', ocrError);
        // Continuar con creación básica si OCR falla
      }
    }

    // Crear documento en la base de datos (fallback si no es factura o OCR falló)
    const { data: documentData, error: documentError } = await supabase
      .from('documents')
      .insert([{
        user_id: userId,
        provider_id: providerId,
        filename: uniqueFilename,
        file_url: publicUrl,
        file_size: fileBuffer.length,
        file_type: fileType,
        mime_type: file.type,
        sender_type: 'user',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (documentError) {
      console.error('Error creando documento:', documentError);
      return NextResponse.json({
        success: false,
        error: 'Error creando documento',
        details: documentError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        document_id: documentData.id,
        filename: uniqueFilename,
        file_url: publicUrl,
        file_size: fileBuffer.length,
        ocr_processed: false
      }
    });

  } catch (error: any) {
    console.error('Error in provider documents POST API:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message || 'Error desconocido'
    }, { status: 500 });
  }
}
