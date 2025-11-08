import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { contactId } = await request.json();
    
    console.log('🧪 [TestMarkRead] Probando markAsRead para:', contactId);
    
    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
    }

    // Marcar mensajes como leídos
    const { error } = await supabase
      .from('whatsapp_messages')
      .update({ status: 'read' })
      .eq('contact_id', contactId)
      .eq('message_type', 'received');

    if (error) {
      console.error('❌ [TestMarkRead] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ [TestMarkRead] Mensajes marcados como leídos exitosamente');
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('❌ [TestMarkRead] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
