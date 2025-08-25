import { supabase } from './client';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  fileName?: string;
  isLocal?: boolean; // Flag to indicate if file is stored locally
}

export async function uploadCatalogFile(
  file: File, 
  providerId: string, 
  userId: string
): Promise<UploadResult> {
  try {
    // console.log('DEBUG: Starting file upload to Supabase Storage');
    // console.log('DEBUG: File details:', {
    //   name: file.name,
    //   size: file.size,
    //   type: file.type,
    //   providerId,
    //   userId
    // });

    // First, let's diagnose the storage situation
    // console.log('DEBUG: Diagnosing storage buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('DEBUG: Error listing buckets:', bucketsError);
      return {
        success: false,
        error: `Error accessing storage: ${bucketsError.message}`
      };
    }
    
    // console.log('DEBUG: Available buckets:', buckets);
    
    // Try different bucket names in order of preference
    const bucketNames = ['files', 'avatars', 'public', 'uploads'];
    let bucketName = null;
    
    for (const name of bucketNames) {
      const bucketExists = buckets?.some(bucket => bucket.name === name);
      if (bucketExists) {
        bucketName = name;
        // console.log('DEBUG: Found bucket:', bucketName);
        break;
      }
    }
    
    if (!bucketName) {
      // console.log('DEBUG: No suitable bucket found, will try to create one');
      bucketName = 'files';
    }

    // Create a unique file name to avoid conflicts
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `catalog_${providerId}_${timestamp}.${fileExtension}`;
    
    // console.log('DEBUG: Generated file name:', fileName);

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName) // Use the determined bucket name
      .upload(`${userId}/catalogs/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('DEBUG: Supabase upload error:', error);
      
      // Check if it's an RLS (Row Level Security) error
      if (error.message.includes('row-level security') || error.message.includes('violates row-level security')) {
        // console.log('DEBUG: RLS error detected - user lacks permissions, trying local storage');
        
        // Try local storage as fallback
                  try {
            const localResult = await uploadCatalogFileLocal(file, providerId, userId);
            if (localResult.success) {
              // console.log('DEBUG: Successfully stored file locally');
              return {
                success: true,
                url: localResult.url,
                fileName: localResult.fileName,
                isLocal: true // Flag to indicate this is a local file
              };
            } else {
              return {
                success: false,
                error: 'Error de permisos: El usuario no tiene permisos para subir archivos. Contacta al administrador para configurar los permisos de Storage.'
              };
            }
          } catch (localError) {
            console.error('DEBUG: Local storage also failed:', localError);
          return {
            success: false,
            error: 'Error de permisos: El usuario no tiene permisos para subir archivos. Contacta al administrador para configurar los permisos de Storage.'
          };
        }
      }
      
      // If it's a bucket not found error, try with a different bucket
      if (error.message.includes('bucket') || error.message.includes('not found')) {
        // console.log('DEBUG: Bucket not found, trying with avatars bucket');
        const { data: retryData, error: retryError } = await supabase.storage
          .from('avatars')
          .upload(`${userId}/catalogs/${fileName}`, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (retryError) {
          console.error('DEBUG: Retry upload error:', retryError);
          return {
            success: false,
            error: `Error uploading to storage: ${retryError.message}`
          };
        }
        
        // Get the public URL for the retry
        const { data: retryUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(`${userId}/catalogs/${fileName}`);
        
        return {
          success: true,
          url: retryUrlData.publicUrl,
          fileName: file.name
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }

    // console.log('DEBUG: File uploaded successfully:', data);

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(`${userId}/catalogs/${fileName}`);

    const publicUrl = urlData.publicUrl;
    // console.log('DEBUG: Public URL generated:', publicUrl);

    return {
      success: true,
      url: publicUrl,
      fileName: file.name
    };

  } catch (error) {
    console.error('DEBUG: Unexpected error during upload:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function deleteCatalogFile(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // console.log('DEBUG: Deleting file from Supabase Storage:', filePath);

    const { error } = await supabase.storage
      .from('files')
      .remove([filePath]);

    if (error) {
      console.error('DEBUG: Supabase delete error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    // console.log('DEBUG: File deleted successfully');
    return { success: true };

  } catch (error) {
    console.error('DEBUG: Unexpected error during delete:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Temporary function to store files locally until Storage permissions are configured
export async function uploadCatalogFileLocal(
  file: File, 
  providerId: string, 
  userId: string
): Promise<UploadResult> {
  try {
    // console.log('DEBUG: Using local file storage as fallback');
    
    // Convert file to base64 for persistent storage
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const bytes = [];
    for (let i = 0; i < uint8Array.length; i++) {
      bytes.push(uint8Array[i]);
    }
    const base64 = btoa(String.fromCharCode.apply(null, bytes));
    const dataUrl = `data:${file.type};base64,${base64}`;
    
    // console.log('DEBUG: Created persistent data URL for file:', file.name);
    
    return {
      success: true,
      url: dataUrl,
      fileName: file.name,
      isLocal: true
    };
    
  } catch (error) {
    console.error('DEBUG: Error in local file storage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 