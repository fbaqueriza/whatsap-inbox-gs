/**
 * 🔧 REFACTORIZACIÓN: Servicio estandarizado de storage
 * Maneja upload, download y gestión de archivos de forma consistente
 */

import { getSupabaseServerClient } from './supabase/serverClient';

export interface UploadResult {
  success: boolean;
  fileUrl?: string;
  filePath?: string;
  error?: string;
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  url: string;
  path: string;
  uploadedAt: Date;
}

export class StorageService {
  private static instance: StorageService;
  private supabase = getSupabaseServerClient();
  
  // 🔧 Bucket estandarizado para todos los documentos
  private readonly DOCUMENTS_BUCKET = 'documents';

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * 🔧 Subir archivo con path estandarizado
   */
  async uploadFile(
    file: Buffer | File,
    category: 'invoices' | 'receipts' | 'orders' | 'general',
    fileName: string,
    metadata?: Record<string, any>
  ): Promise<UploadResult> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'No se pudo conectar a Supabase' };
      }

      // Generar path estandarizado
      const filePath = this.generateStandardPath(category, fileName);
      
      // Determinar content type
      const contentType = this.getContentType(fileName);
      
      // Subir archivo
      const { data, error } = await this.supabase.storage
        .from(this.DOCUMENTS_BUCKET)
        .upload(filePath, file, {
          contentType,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('❌ Error subiendo archivo:', error);
        return { success: false, error: error.message };
      }

      // Obtener URL pública
      const { data: { publicUrl } } = this.supabase.storage
        .from(this.DOCUMENTS_BUCKET)
        .getPublicUrl(filePath);

      console.log('✅ Archivo subido exitosamente:', { filePath, publicUrl });

      return {
        success: true,
        fileUrl: publicUrl,
        filePath: filePath
      };

    } catch (error) {
      console.error('❌ Error en upload:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error subiendo archivo' 
      };
    }
  }

  /**
   * 🔧 Subir factura con path específico
   */
  async uploadInvoice(
    file: Buffer | File,
    orderId: string,
    providerId: string,
    originalFileName?: string
  ): Promise<UploadResult> {
    const timestamp = Date.now();
    const extension = this.getFileExtension(originalFileName || 'invoice.pdf');
    const fileName = `invoice_${timestamp}_${orderId}_${providerId}.${extension}`;
    
    return this.uploadFile(file, 'invoices', fileName, {
      orderId,
      providerId,
      type: 'invoice',
      uploadedAt: new Date().toISOString()
    });
  }

  /**
   * 🔧 Subir comprobante de pago
   */
  async uploadReceipt(
    file: Buffer | File,
    orderId: string,
    originalFileName?: string
  ): Promise<UploadResult> {
    const timestamp = Date.now();
    const extension = this.getFileExtension(originalFileName || 'receipt.pdf');
    const fileName = `receipt_${timestamp}_${orderId}.${extension}`;
    
    return this.uploadFile(file, 'receipts', fileName, {
      orderId,
      type: 'receipt',
      uploadedAt: new Date().toISOString()
    });
  }

  /**
   * 🔧 Subir archivo de orden
   */
  async uploadOrderFile(
    file: Buffer | File,
    orderId: string,
    originalFileName: string
  ): Promise<UploadResult> {
    const timestamp = Date.now();
    const extension = this.getFileExtension(originalFileName);
    const fileName = `order_${timestamp}_${orderId}_${originalFileName}`;
    
    return this.uploadFile(file, 'orders', fileName, {
      orderId,
      type: 'order_file',
      uploadedAt: new Date().toISOString()
    });
  }

  /**
   * 🔧 Descargar archivo
   */
  async downloadFile(filePath: string): Promise<{ success: boolean; data?: Buffer; error?: string }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'No se pudo conectar a Supabase' };
      }

      const { data, error } = await this.supabase.storage
        .from(this.DOCUMENTS_BUCKET)
        .download(filePath);

      if (error) {
        console.error('❌ Error descargando archivo:', error);
        return { success: false, error: error.message };
      }

      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return { success: true, data: buffer };

    } catch (error) {
      console.error('❌ Error en download:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error descargando archivo' 
      };
    }
  }

  /**
   * 🔧 Obtener información del archivo
   */
  async getFileInfo(filePath: string): Promise<{ success: boolean; info?: FileInfo; error?: string }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'No se pudo conectar a Supabase' };
      }

      const { data, error } = await this.supabase.storage
        .from(this.DOCUMENTS_BUCKET)
        .list(filePath.split('/').slice(0, -1).join('/'), {
          search: filePath.split('/').pop()
        });

      if (error) {
        console.error('❌ Error obteniendo info del archivo:', error);
        return { success: false, error: error.message };
      }

      if (!data || data.length === 0) {
        return { success: false, error: 'Archivo no encontrado' };
      }

      const file = data[0];
      const { data: { publicUrl } } = this.supabase.storage
        .from(this.DOCUMENTS_BUCKET)
        .getPublicUrl(filePath);

      const info: FileInfo = {
        name: file.name,
        size: file.metadata?.size || 0,
        type: file.metadata?.mimetype || 'application/octet-stream',
        url: publicUrl,
        path: filePath,
        uploadedAt: new Date(file.created_at)
      };

      return { success: true, info };

    } catch (error) {
      console.error('❌ Error obteniendo info del archivo:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error obteniendo info del archivo' 
      };
    }
  }

  /**
   * 🔧 Eliminar archivo
   */
  async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'No se pudo conectar a Supabase' };
      }

      const { error } = await this.supabase.storage
        .from(this.DOCUMENTS_BUCKET)
        .remove([filePath]);

      if (error) {
        console.error('❌ Error eliminando archivo:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Archivo eliminado exitosamente:', filePath);
      return { success: true };

    } catch (error) {
      console.error('❌ Error eliminando archivo:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error eliminando archivo' 
      };
    }
  }

  /**
   * 🔧 Listar archivos por categoría
   */
  async listFiles(category: 'invoices' | 'receipts' | 'orders' | 'general'): Promise<{ success: boolean; files?: FileInfo[]; error?: string }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'No se pudo conectar a Supabase' };
      }

      const { data, error } = await this.supabase.storage
        .from(this.DOCUMENTS_BUCKET)
        .list(category);

      if (error) {
        console.error('❌ Error listando archivos:', error);
        return { success: false, error: error.message };
      }

      const files: FileInfo[] = (data || []).map(file => ({
        name: file.name,
        size: file.metadata?.size || 0,
        type: file.metadata?.mimetype || 'application/octet-stream',
        url: this.getPublicUrl(`${category}/${file.name}`),
        path: `${category}/${file.name}`,
        uploadedAt: new Date(file.created_at)
      }));

      return { success: true, files };

    } catch (error) {
      console.error('❌ Error listando archivos:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error listando archivos' 
      };
    }
  }

  /**
   * 🔧 Obtener URL pública
   */
  getPublicUrl(filePath: string): string {
    if (!this.supabase) return '';
    
    const { data: { publicUrl } } = this.supabase.storage
      .from(this.DOCUMENTS_BUCKET)
      .getPublicUrl(filePath);
    
    return publicUrl;
  }

  /**
   * 🔧 Generar path estandarizado
   */
  private generateStandardPath(category: string, fileName: string): string {
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `${category}/${timestamp}/${fileName}`;
  }

  /**
   * 🔧 Obtener content type basado en extensión
   */
  private getContentType(fileName: string): string {
    const extension = this.getFileExtension(fileName).toLowerCase();
    
    const contentTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    return contentTypes[extension] || 'application/octet-stream';
  }

  /**
   * 🔧 Obtener extensión del archivo
   */
  private getFileExtension(fileName: string): string {
    return fileName.split('.').pop() || 'bin';
  }

  /**
   * 🔧 Validar que el archivo es válido
   */
  validateFile(file: Buffer | File, maxSizeMB: number = 10): { valid: boolean; error?: string } {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (file instanceof Buffer) {
      if (file.length > maxSizeBytes) {
        return { valid: false, error: `Archivo demasiado grande. Máximo ${maxSizeMB}MB` };
      }
    } else {
      if (file.size > maxSizeBytes) {
        return { valid: false, error: `Archivo demasiado grande. Máximo ${maxSizeMB}MB` };
      }
    }

    return { valid: true };
  }

  /**
   * 🔧 Verificar que el bucket existe
   */
  async ensureBucketExists(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'No se pudo conectar a Supabase' };
      }

      const { data, error } = await this.supabase.storage
        .listBuckets();

      if (error) {
        console.error('❌ Error listando buckets:', error);
        return { success: false, error: error.message };
      }

      const bucketExists = data?.some(bucket => bucket.name === this.DOCUMENTS_BUCKET);
      
      if (!bucketExists) {
        // Crear bucket si no existe
        const { error: createError } = await this.supabase.storage
          .createBucket(this.DOCUMENTS_BUCKET, {
            public: true,
            allowedMimeTypes: [
              'application/pdf',
              'image/jpeg',
              'image/png',
              'image/gif',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ],
            fileSizeLimit: 10485760 // 10MB
          });

        if (createError) {
          console.error('❌ Error creando bucket:', createError);
          return { success: false, error: createError.message };
        }

        console.log('✅ Bucket creado exitosamente:', this.DOCUMENTS_BUCKET);
      }

      return { success: true };

    } catch (error) {
      console.error('❌ Error verificando bucket:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error verificando bucket' 
      };
    }
  }
}
