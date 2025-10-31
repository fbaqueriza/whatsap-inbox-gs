import { NextRequest, NextResponse } from 'next/server';
import { MetaWhatsAppService } from '../../../../lib/metaWhatsAppService';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [TestMetaInit] Probando inicialización de MetaWhatsAppService...');
    
    const metaService = new MetaWhatsAppService();
    console.log('📊 [TestMetaInit] Estado antes de inicializar:', metaService.getStatus());
    
    await metaService.initialize();
    console.log('📊 [TestMetaInit] Estado después de inicializar:', metaService.getStatus());
    
    return NextResponse.json({
      success: true,
      status: metaService.getStatus()
    });
    
  } catch (error: any) {
    console.error('❌ [TestMetaInit] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
