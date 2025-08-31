import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`🧪 [${requestId}] TEST ENDPOINT INICIADO:`, new Date().toISOString());
    
    // 1. Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log(`🔧 [${requestId}] Variables de entorno:`, {
      supabaseUrl: supabaseUrl ? 'Configurado' : 'NO CONFIGURADO',
      supabaseKey: supabaseKey ? 'Configurado' : 'NO CONFIGURADO'
    });
    
    if (!supabaseUrl || !supabaseKey) {
      console.error(`❌ [${requestId}] Variables de entorno faltantes`);
      return NextResponse.json({ 
        error: 'Variables de entorno faltantes',
        requestId: requestId 
      }, { status: 500 });
    }
    
    // 2. Probar conexión a Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log(`🔗 [${requestId}] Probando conexión a Supabase...`);
    
    // 3. Buscar proveedor específico
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('user_id, phone, name')
      .or(`phone.eq.+5491135562673,phone.eq.5491135562673`);
    
    if (providersError) {
      console.error(`❌ [${requestId}] Error buscando proveedor:`, providersError);
      return NextResponse.json({ 
        error: 'Error buscando proveedor',
        details: providersError,
        requestId: requestId 
      }, { status: 500 });
    }
    
    console.log(`✅ [${requestId}] Proveedores encontrados:`, providers);
    
    // 4. Probar guardar mensaje de prueba
    if (providers && providers.length > 0) {
      const testMessage = {
        content: `Mensaje de prueba desde endpoint de test - ${new Date().toLocaleString()}`,
        message_type: 'received',
        status: 'delivered',
        contact_id: '+5491135562673',
        user_id: providers[0].user_id,
        message_sid: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      
      console.log(`💾 [${requestId}] Guardando mensaje de prueba:`, testMessage);
      
      const { error: saveError } = await supabase
        .from('whatsapp_messages')
        .insert([testMessage]);
      
      if (saveError) {
        console.error(`❌ [${requestId}] Error guardando mensaje de prueba:`, saveError);
        return NextResponse.json({ 
          error: 'Error guardando mensaje de prueba',
          details: saveError,
          requestId: requestId 
        }, { status: 500 });
      }
      
      console.log(`✅ [${requestId}] Mensaje de prueba guardado correctamente`);
    }
    
    // 5. Verificar mensajes existentes
    const { data: mensajes, error: mensajesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', '+5491135562673')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (mensajesError) {
      console.error(`❌ [${requestId}] Error obteniendo mensajes:`, mensajesError);
    } else {
      console.log(`📱 [${requestId}] Mensajes del proveedor:`, mensajes?.length || 0);
    }
    
    const duration = Date.now() - startTime;
    console.log(`🏁 [${requestId}] TEST ENDPOINT COMPLETADO en ${duration}ms`);
    
    return NextResponse.json({
      status: 'ok',
      requestId: requestId,
      duration: duration,
      providers: providers,
      mensajesCount: mensajes?.length || 0,
      testMessageSaved: providers && providers.length > 0
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [${requestId}] Error en test endpoint:`, error);
    console.error(`💥 [${requestId}] TEST ENDPOINT FALLÓ en ${duration}ms`);
    
    return NextResponse.json({ 
      error: 'Error en test endpoint',
      details: error instanceof Error ? error.message : 'Error desconocido',
      requestId: requestId,
      duration: duration 
    }, { status: 500 });
  }
}
