import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 [SimulateMessage] Simulando mensaje de Kapso...');

    const body = await request.json();
    const { content = 'Mensaje de prueba', phone = '+541135562673', type = 'received' } = body;

    // Insertar mensaje simulado en whatsapp_messages
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .insert([{
        id: `sim-${Date.now()}`,
        content: content,
        contact_id: phone,
        contact_name: phone,
        timestamp: new Date().toISOString(),
        type: type,
        direction: type === 'received' ? 'inbound' : 'outbound',
        status: 'delivered',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      console.error('❌ [SimulateMessage] Error insertando mensaje:', error);
      return NextResponse.json({
        success: false,
        error: 'Error insertando mensaje',
        details: error.message
      }, { status: 500 });
    }

    console.log('✅ [SimulateMessage] Mensaje simulado insertado:', data);

    return NextResponse.json({
      success: true,
      message: 'Mensaje simulado insertado correctamente',
      data: data[0]
    });

  } catch (error: any) {
    console.error('❌ [SimulateMessage] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
