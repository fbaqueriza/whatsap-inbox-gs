import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  console.log('🔍 Iniciando monitoreo de documentos...');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    // Obtener documentos sin mensaje en chat
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (docsError) {
      console.error('❌ Error obteniendo documentos:', docsError);
      return NextResponse.json({ error: 'Error obteniendo documentos' }, { status: 500 });
    }
    
    if (!documents || documents.length === 0) {
      return NextResponse.json({ message: 'No hay documentos para procesar' });
    }
    
    let recoveredCount = 0;
    let errorCount = 0;
    
    for (const doc of documents) {
      // Verificar si ya tiene mensaje en el chat
      const { data: existingMessage, error: msgError } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('message_sid', doc.whatsapp_message_id)
        .single();
      
      if (msgError && msgError.code !== 'PGRST116') {
        console.error(`❌ Error verificando mensaje para documento ${doc.id}:`, msgError);
        errorCount++;
        continue;
      }
      
      if (existingMessage) {
        // Ya tiene mensaje, saltar
        continue;
      }
      
      // Es un documento sin mensaje, recuperarlo
      console.log(`🔄 Recuperando documento: ${doc.filename} (${doc.whatsapp_message_id})`);
      
      try {
        const messageId = uuidv4();
        const messageData = {
          id: messageId,
          content: `📎 ${doc.filename}`,
          message_type: 'received',
          status: 'delivered',
          contact_id: doc.provider_phone,
          user_id: doc.user_id,
          message_sid: doc.whatsapp_message_id,
          timestamp: doc.created_at,
          created_at: doc.created_at,
          media_url: doc.file_url,
          media_type: doc.file_type
        };
        
        const { error: insertError } = await supabase
          .from('whatsapp_messages')
          .insert([messageData]);
        
        if (insertError) {
          console.error(`❌ Error insertando mensaje para documento ${doc.id}:`, insertError);
          errorCount++;
        } else {
          console.log(`✅ Documento recuperado: ${doc.filename}`);
          recoveredCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error procesando documento ${doc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`📊 Monitoreo completado: ${recoveredCount} recuperados, ${errorCount} errores`);
    
    return NextResponse.json({
      success: true,
      recovered: recoveredCount,
      errors: errorCount,
      message: `Recuperados ${recoveredCount} documentos, ${errorCount} errores`
    });
    
  } catch (error) {
    console.error('❌ Error en monitoreo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
