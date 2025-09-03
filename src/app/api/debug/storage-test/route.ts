/**
 * 🧪 ENDPOINT DE PRUEBA PARA SERVICIO DE STORAGE
 * 
 * Este endpoint permite probar la funcionalidad del servicio de storage
 * y verificar que los buckets se creen correctamente
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupabaseStorageService } from '../../../../lib/supabaseStorageService';

export async function GET(request: NextRequest) {
  const requestId = `storage_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`🧪 [${requestId}] INICIANDO PRUEBA DE STORAGE`);
    
    // Crear instancia del servicio
    const storageService = new SupabaseStorageService(requestId);
    
    // 🔧 PASO 1: Verificar bucket 'files' (que ya existe)
    console.log(`🔍 [${requestId}] Verificando bucket 'files'...`);
    const filesBucketCheck = await storageService.ensureBucketExists('files');
    
    if (!filesBucketCheck.success) {
      console.error(`❌ [${requestId}] Error verificando bucket 'files':`, filesBucketCheck.error);
      return NextResponse.json({
        success: false,
        error: `Error verificando bucket 'files': ${filesBucketCheck.error}`,
        requestId
      }, { status: 500 });
    }
    
    console.log(`✅ [${requestId}] Bucket 'files' verificado:`, {
      exists: filesBucketCheck.bucketExists,
      created: filesBucketCheck.bucketCreated || false
    });
    
    // 🔧 PASO 2: Probar subida de archivo de prueba
    console.log(`📤 [${requestId}] Probando subida de archivo de prueba...`);
    const testContent = `Archivo de prueba generado el ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent, 'utf-8');
    
    const uploadResult = await storageService.uploadFileWithBucketCheck(
      'files', // Usar bucket existente
      'test/test-file.txt',
      testBuffer,
      {
        contentType: 'text/plain',
        cacheControl: '3600'
      }
    );
    
    if (!uploadResult.success) {
      console.error(`❌ [${requestId}] Error en subida de prueba:`, uploadResult.error);
      return NextResponse.json({
        success: false,
        error: `Error en subida de prueba: ${uploadResult.error}`,
        requestId,
        bucketStatus: filesBucketCheck
      }, { status: 500 });
    }
    
    console.log(`✅ [${requestId}] Archivo de prueba subido exitosamente:`, uploadResult.fileUrl);
    
    // 🔧 PASO 3: Listar archivos en el bucket
    console.log(`📋 [${requestId}] Listando archivos en bucket 'files'...`);
    const listResult = await storageService.listFiles('files', 'test');
    
    if (!listResult.success) {
      console.warn(`⚠️ [${requestId}] No se pudieron listar archivos:`, listResult.error);
    } else {
      console.log(`✅ [${requestId}] Archivos en carpeta 'test':`, listResult.files?.length || 0);
    }
    
    // 🔧 PASO 4: Limpiar archivo de prueba
    console.log(`🗑️ [${requestId}] Limpiando archivo de prueba...`);
    const deleteResult = await storageService.deleteFile('files', 'test/test-file.txt');
    
    if (!deleteResult.success) {
      console.warn(`⚠️ [${requestId}] No se pudo eliminar archivo de prueba:`, deleteResult.error);
    } else {
      console.log(`✅ [${requestId}] Archivo de prueba eliminado`);
    }
    
    console.log(`🎉 [${requestId}] PRUEBA DE STORAGE COMPLETADA EXITOSAMENTE`);
    
    return NextResponse.json({
      success: true,
      requestId,
      bucketStatus: filesBucketCheck,
      testUpload: {
        success: uploadResult.success,
        fileUrl: uploadResult.fileUrl
      },
      testDelete: deleteResult,
      message: 'Servicio de storage funcionando correctamente'
    });
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`❌ [${requestId}] Error en prueba de storage:`, error);
    
    return NextResponse.json({
      success: false,
      error: errorMsg,
      requestId
    }, { status: 500 });
  }
}
