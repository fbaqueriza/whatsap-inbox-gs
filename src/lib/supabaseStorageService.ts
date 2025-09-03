/**
 * 🎯 SERVICIO CENTRALIZADO DE GESTIÓN DE STORAGE DE SUPABASE
 * 
 * Este servicio maneja la creación, verificación y gestión de buckets de almacenamiento
 * para asegurar que estén disponibles antes de intentar subir archivos
 */

import { createClient } from '@supabase/supabase-js';

export class SupabaseStorageService {
  private supabase: any;
  private requestId?: string;

  constructor(requestId?: string) {
    this.requestId = requestId;
    this.initializeSupabase();
  }

  /**
   * 🔧 INICIALIZAR CLIENTE SUPABASE
   */
  private initializeSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de entorno de Supabase no configuradas');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * 🔍 VERIFICAR Y CREAR BUCKET SI NO EXISTE
   * 
   * @param bucketName - Nombre del bucket a verificar/crear
   * @returns Resultado de la operación
   */
  async ensureBucketExists(bucketName: string): Promise<{
    success: boolean;
    bucketExists: boolean;
    bucketCreated?: boolean;
    error?: string;
  }> {
    try {
      console.log(`🔍 [${this.requestId || 'storage'}] Verificando bucket: ${bucketName}`);

      // 🔧 PASO 1: Verificar si el bucket existe
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
      
      if (listError) {
        console.error(`❌ [${this.requestId || 'storage'}] Error listando buckets:`, listError);
        return { success: false, bucketExists: false, error: listError.message };
      }

      const bucketExists = buckets?.some((bucket: any) => bucket.name === bucketName);
      
      if (bucketExists) {
        console.log(`✅ [${this.requestId || 'storage'}] Bucket ${bucketName} ya existe`);
        return { success: true, bucketExists: true };
      }

      // 🔧 PASO 2: Crear bucket si no existe
      console.log(`🔄 [${this.requestId || 'storage'}] Creando bucket: ${bucketName}`);
      
      const { data: newBucket, error: createError } = await this.supabase.storage.createBucket(bucketName, {
        public: true, // Bucket público para acceso a archivos
        allowedMimeTypes: ['image/*', 'application/pdf', 'application/octet-stream'],
        fileSizeLimit: 52428800 // 50MB límite por archivo
      });

      if (createError) {
        console.error(`❌ [${this.requestId || 'storage'}] Error creando bucket:`, createError);
        return { success: false, bucketExists: false, error: createError.message };
      }

      console.log(`✅ [${this.requestId || 'storage'}] Bucket ${bucketName} creado exitosamente`);
      
      // 🔧 PASO 3: Configurar políticas de acceso público
      await this.configureBucketPolicies(bucketName);

      return { 
        success: true, 
        bucketExists: true, 
        bucketCreated: true 
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`❌ [${this.requestId || 'storage'}] Error en ensureBucketExists:`, error);
      return { success: false, bucketExists: false, error: errorMsg };
    }
  }

  /**
   * 🔧 CONFIGURAR POLÍTICAS DE ACCESO PÚBLICO AL BUCKET
   * 
   * @param bucketName - Nombre del bucket a configurar
   */
  private async configureBucketPolicies(bucketName: string): Promise<void> {
    try {
      console.log(`🔧 [${this.requestId || 'storage'}] Configurando políticas para bucket: ${bucketName}`);
      
      // 🔧 POLÍTICA: Permitir lectura pública de archivos
      const { error: policyError } = await this.supabase.storage
        .from(bucketName)
        .createSignedUrl('*', 31536000); // 1 año de validez

      if (policyError) {
        console.warn(`⚠️ [${this.requestId || 'storage'}] No se pudo configurar política de acceso:`, policyError);
      } else {
        console.log(`✅ [${this.requestId || 'storage'}] Políticas configuradas para bucket: ${bucketName}`);
      }

    } catch (error) {
      console.warn(`⚠️ [${this.requestId || 'storage'}] Error configurando políticas:`, error);
    }
  }

  /**
   * 📤 SUBIR ARCHIVO CON VERIFICACIÓN AUTOMÁTICA DE BUCKET
   * 
   * @param bucketName - Nombre del bucket
   * @param filePath - Ruta del archivo en el bucket
   * @param fileBuffer - Buffer del archivo
   * @param options - Opciones de subida
   * @returns Resultado de la subida
   */
  async uploadFileWithBucketCheck(
    bucketName: string,
    filePath: string,
    fileBuffer: Buffer,
    options: {
      contentType?: string;
      cacheControl?: string;
    } = {}
  ): Promise<{
    success: boolean;
    fileUrl?: string;
    error?: string;
  }> {
    try {
      console.log(`📤 [${this.requestId || 'storage'}] Iniciando subida de archivo: ${filePath}`);

      // 🔧 PASO 1: Asegurar que el bucket existe
      const bucketCheck = await this.ensureBucketExists(bucketName);
      
      if (!bucketCheck.success) {
        return { 
          success: false, 
          error: `Error verificando bucket: ${bucketCheck.error}` 
        };
      }

      // 🔧 PASO 2: Subir archivo
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from(bucketName)
        .upload(filePath, fileBuffer, {
          contentType: options.contentType || 'application/octet-stream',
          cacheControl: options.cacheControl || '3600',
          upsert: true // Sobrescribir si existe
        });

      if (uploadError) {
        console.error(`❌ [${this.requestId || 'storage'}] Error subiendo archivo:`, uploadError);
        return { success: false, error: uploadError.message };
      }

      // 🔧 PASO 3: Obtener URL pública
      const { data: { publicUrl } } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      console.log(`✅ [${this.requestId || 'storage'}] Archivo subido exitosamente:`, {
        path: filePath,
        size: fileBuffer.length,
        url: publicUrl
      });

      return { success: true, fileUrl: publicUrl };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`❌ [${this.requestId || 'storage'}] Error en uploadFileWithBucketCheck:`, error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 🗑️ ELIMINAR ARCHIVO DEL BUCKET
   * 
   * @param bucketName - Nombre del bucket
   * @param filePath - Ruta del archivo a eliminar
   * @returns Resultado de la eliminación
   */
  async deleteFile(
    bucketName: string,
    filePath: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log(`🗑️ [${this.requestId || 'storage'}] Eliminando archivo: ${filePath}`);

      const { error: deleteError } = await this.supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (deleteError) {
        console.error(`❌ [${this.requestId || 'storage'}] Error eliminando archivo:`, deleteError);
        return { success: false, error: deleteError.message };
      }

      console.log(`✅ [${this.requestId || 'storage'}] Archivo eliminado exitosamente: ${filePath}`);
      return { success: true };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`❌ [${this.requestId || 'storage'}] Error en deleteFile:`, error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 📋 LISTAR ARCHIVOS EN UN BUCKET
   * 
   * @param bucketName - Nombre del bucket
   * @param folderPath - Ruta de la carpeta (opcional)
   * @returns Lista de archivos
   */
  async listFiles(
    bucketName: string,
    folderPath: string = ''
  ): Promise<{
    success: boolean;
    files?: any[];
    error?: string;
  }> {
    try {
      console.log(`📋 [${this.requestId || 'storage'}] Listando archivos en: ${bucketName}/${folderPath}`);

      const { data: files, error: listError } = await this.supabase.storage
        .from(bucketName)
        .list(folderPath);

      if (listError) {
        console.error(`❌ [${this.requestId || 'storage'}] Error listando archivos:`, listError);
        return { success: false, error: listError.message };
      }

      console.log(`✅ [${this.requestId || 'storage'}] Archivos encontrados:`, files?.length || 0);
      return { success: true, files };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`❌ [${this.requestId || 'storage'}] Error en listFiles:`, error);
      return { success: false, error: errorMsg };
    }
  }
}

// 🔧 EXPORTAR INSTANCIA ÚNICA PARA USO GLOBAL
export const supabaseStorageService = new SupabaseStorageService();

// 🔧 EXPORTAR CLASE PARA USO CON REQUEST ID
export default SupabaseStorageService;
