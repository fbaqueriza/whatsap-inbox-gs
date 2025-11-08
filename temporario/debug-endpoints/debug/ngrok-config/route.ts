import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔗 [NgrokConfig] Obteniendo configuración de ngrok...');

    // Obtener información de ngrok
    const ngrokResponse = await fetch('http://localhost:4040/api/tunnels');
    const ngrokData = await ngrokResponse.json();

    // Elegir el túnel https que apunte a localhost:3001
    const tunnels: any[] = Array.isArray(ngrokData?.tunnels) ? ngrokData.tunnels : [];
    const match = tunnels.find((t: any) => {
      const url: string = t?.public_url || '';
      const addr: string = t?.config?.addr || '';
      return url.startsWith('https://') && /(:|\/)3001$/.test(String(addr)) || addr.includes('localhost:3001') || addr.includes('127.0.0.1:3001');
    }) || tunnels.find((t: any) => String(t?.public_url || '').startsWith('https://')) || tunnels[0];

    const publicUrl = match?.public_url;
    
    if (!publicUrl) {
      return NextResponse.json({
        success: false,
        error: 'Ngrok no está ejecutándose o no hay túneles activos'
      }, { status: 500 });
    }

    const webhookUrl = `${publicUrl}/api/kapso/supabase-events`;
    
    console.log('📊 [NgrokConfig] Configuración obtenida:', {
      publicUrl,
      webhookUrl,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Configuración de ngrok obtenida',
      data: {
        ngrokUrl: publicUrl,
        webhookUrl: webhookUrl,
        localUrl: 'http://localhost:3001',
        instructions: {
          step1: 'Ir a Kapso Dashboard',
          step2: 'Configurar webhook con la URL proporcionada',
          step3: 'Probar enviando un mensaje de WhatsApp',
          step4: 'Los mensajes aparecerán en tiempo real en el chat'
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ [NgrokConfig] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Asegúrate de que ngrok esté ejecutándose con: ngrok http 3001'
    }, { status: 500 });
  }
}
