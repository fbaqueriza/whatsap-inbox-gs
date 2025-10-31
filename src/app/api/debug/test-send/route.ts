import { NextRequest, NextResponse } from 'next/server';
import { MetaWhatsAppService } from '../../../../lib/metaWhatsAppService';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 [TestSend] Probando envío de mensaje...');
    
    const { to, message } = await request.json();
    
    if (!to || !message) {
      return NextResponse.json({
        success: false,
        error: 'to y message son requeridos'
      }, { status: 400 });
    }
    
    console.log('📤 [TestSend] Enviando mensaje:', { to, message });
    
    const metaService = new MetaWhatsAppService();
    await metaService.initialize();
    const result = await metaService.sendMessage(to, message);
    
    console.log('✅ [TestSend] Resultado:', result);
    
    return NextResponse.json({
      success: true,
      result: result
    });
    
  } catch (error: any) {
    console.error('❌ [TestSend] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
