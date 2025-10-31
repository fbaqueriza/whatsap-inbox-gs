import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [TestRealtime] Insertando mensaje de prueba...');

    const testMessage = {
      id: crypto.randomUUID(),
      content: 'Mensaje de prueba desde debug endpoint',
      timestamp: new Date().toISOString(),
      contact_id: '+541135562673',
      user_id: 'b5a237e6-c9f9-4561-af07-a1408825ab50', // Usuario hardcodeado para prueba
      message_type: 'received',
      status: 'received',
      message_sid: `test_${Date.now()}`,
      created_at: new Date().toISOString()
    };

    console.log('📨 [TestRealtime] Insertando mensaje:', testMessage);

    const { error } = await supabase
      .from('whatsapp_messages')
      .insert([testMessage]);

    if (error) {
      console.error('❌ [TestRealtime] Error insertando mensaje:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log('✅ [TestRealtime] Mensaje insertado exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Mensaje de prueba insertado',
      data: testMessage
    });

  } catch (error: any) {
    console.error('❌ [TestRealtime] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 [TestRealtime] Insertando mensaje de prueba...');

    const testMessage = {
      id: crypto.randomUUID(),
      content: 'Mensaje de prueba desde debug endpoint',
      timestamp: new Date().toISOString(),
      contact_id: '+541135562673',
      user_id: 'b5a237e6-c9f9-4561-af07-a1408825ab50', // Usuario hardcodeado para prueba
      message_type: 'received',
      status: 'received',
      message_sid: `test_${Date.now()}`,
      created_at: new Date().toISOString()
    };

    console.log('📨 [TestRealtime] Insertando mensaje:', testMessage);

    const { error } = await supabase
      .from('whatsapp_messages')
      .insert([testMessage]);

    if (error) {
      console.error('❌ [TestRealtime] Error insertando mensaje:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log('✅ [TestRealtime] Mensaje insertado exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Mensaje de prueba insertado',
      data: testMessage
    });

  } catch (error: any) {
    console.error('❌ [TestRealtime] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
