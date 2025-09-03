/**
 * 🔍 ENDPOINT DE DIAGNÓSTICO SIMPLE PARA STORAGE
 * 
 * Este endpoint verifica las variables de entorno y la conexión básica
 * sin intentar operaciones complejas
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestId = `storage_simple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`🔍 [${requestId}] INICIANDO DIAGNÓSTICO SIMPLE DE STORAGE`);
    
    // 🔧 PASO 1: Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log(`🔍 [${requestId}] Variables de entorno:`, {
      supabaseUrl: supabaseUrl ? 'Configurado' : 'NO CONFIGURADO',
      supabaseKey: supabaseKey ? 'Configurado' : 'NO CONFIGURADO'
    });
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Variables de entorno faltantes',
        details: {
          NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: !!supabaseKey
        },
        requestId
      }, { status: 500 });
    }
    
    // 🔧 PASO 2: Intentar crear cliente básico
    console.log(`🔧 [${requestId}] Intentando crear cliente Supabase...`);
    
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      console.log(`✅ [${requestId}] Cliente Supabase creado exitosamente`);
      
      // 🔧 PASO 3: Verificar conexión básica
      console.log(`🔍 [${requestId}] Verificando conexión básica...`);
      
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error(`❌ [${requestId}] Error listando buckets:`, listError);
        return NextResponse.json({
          success: false,
          error: `Error de conexión: ${listError.message}`,
          details: listError,
          requestId
        }, { status: 500 });
      }
      
      console.log(`✅ [${requestId}] Conexión exitosa. Buckets encontrados:`, buckets?.length || 0);
      
      return NextResponse.json({
        success: true,
        requestId,
        message: 'Conexión a Supabase exitosa',
        buckets: buckets?.map(b => b.name) || [],
        environment: {
          supabaseUrl: 'Configurado',
          supabaseKey: 'Configurado'
        }
      });
      
    } catch (clientError) {
      console.error(`❌ [${requestId}] Error creando cliente:`, clientError);
      return NextResponse.json({
        success: false,
        error: `Error creando cliente: ${clientError instanceof Error ? clientError.message : 'Error desconocido'}`,
        details: clientError,
        requestId
      }, { status: 500 });
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`❌ [${requestId}] Error en diagnóstico:`, error);
    
    return NextResponse.json({
      success: false,
      error: errorMsg,
      requestId
    }, { status: 500 });
  }
}
