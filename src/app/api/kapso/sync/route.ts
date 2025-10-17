import { NextRequest, NextResponse } from 'next/server';
import { KapsoSupabaseService } from '../../../../lib/kapsoSupabaseService';

export async function POST(request: NextRequest) {
  const requestId = `kapso_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`📥 [${requestId}] ===== KAPSO SYNC WEBHOOK RECIBIDO =====`);

  try {
    const body = await request.json();
    console.log(`📥 [${requestId}] Body completo recibido:`, JSON.stringify(body, null, 2));

    // Asumiendo que Kapso envía un formato específico para la sincronización
    // Este es un ejemplo, el formato real dependerá de cómo Kapso envíe los datos
    const {
      conversation_id,
      phone_number,
      contact_name,
      message_id,
      from_number,
      to_number,
      content,
      message_type,
      timestamp,
      user_id // Kapso debería proporcionar el user_id asociado
    } = body;

    if (!conversation_id || !message_id || !from_number || !to_number || !content || !message_type || !timestamp || !user_id) {
      console.error(`❌ [${requestId}] Datos incompletos en el webhook de Kapso.`);
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const syncResult = await KapsoSupabaseService.syncKapsoData({
      conversationId: conversation_id,
      phoneNumber: phone_number,
      contactName: contact_name,
      messageId: message_id,
      fromNumber: from_number,
      toNumber: to_number,
      content: content,
      messageType: message_type,
      timestamp: timestamp,
      userId: user_id
    });

    if (syncResult.success) {
      console.log(`✅ [${requestId}] Datos sincronizados exitosamente:`, syncResult.data);
      return NextResponse.json({ success: true, message: 'Data synced successfully', data: syncResult.data });
    } else {
      console.error(`❌ [${requestId}] Error sincronizando datos:`, syncResult.error);
      return NextResponse.json({ success: false, error: syncResult.error }, { status: 500 });
    }

  } catch (error) {
    console.error(`❌ [${requestId}] Error procesando webhook de Kapso:`, error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}