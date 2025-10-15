import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Obtener el user_id del header de autorización
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Obtener el archivo del FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Tipo de archivo no válido. Solo se permiten: JPEG, PNG, WebP' 
      }, { status: 400 });
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'El archivo es demasiado grande. Máximo 5MB' 
      }, { status: 400 });
    }

    // Generar nombre único para el archivo
    const fileExtension = file.name.split('.').pop();
    const fileName = `profile-pictures/${user.id}_${Date.now()}.${fileExtension}`;

    // Convertir File a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Subir archivo a Supabase Storage
    // Intentar con bucket 'public' primero, si no existe usar 'documents'
    let bucketName = 'public';
    let { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, uint8Array, {
        contentType: file.type,
        upsert: false
      });

    // Si el bucket 'public' no existe, intentar con 'documents'
    if (uploadError && uploadError.message.includes('Bucket not found')) {
      console.log('Bucket "public" no encontrado, intentando con "documents"');
      bucketName = 'documents';
      const retryResult = await supabase.storage
        .from(bucketName)
        .upload(fileName, uint8Array, {
          contentType: file.type,
          upsert: false
        });
      uploadData = retryResult.data;
      uploadError = retryResult.error;
    }

    if (uploadError) {
      console.error('Error subiendo archivo:', uploadError);
      return NextResponse.json({ error: 'Error subiendo archivo' }, { status: 500 });
    }

    // Obtener URL pública del archivo
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // Actualizar perfil del usuario con la nueva URL
    const { error: updateError } = await supabase
      .from('users')
      .update({ profile_picture_url: publicUrl })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error actualizando perfil:', updateError);
      // Intentar eliminar el archivo subido si falla la actualización
      try {
        await supabase.storage.from(bucketName).remove([fileName]);
      } catch (deleteError) {
        console.warn('No se pudo eliminar archivo tras error:', deleteError);
      }
      return NextResponse.json({ error: 'Error actualizando perfil' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Foto de perfil actualizada exitosamente',
      profilePictureUrl: publicUrl
    });

  } catch (error) {
    console.error('Error en POST /api/user/profile-picture:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Obtener el user_id del header de autorización
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Obtener URL actual de la foto de perfil
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('profile_picture_url')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error obteniendo perfil:', profileError);
      return NextResponse.json({ error: 'Error obteniendo perfil' }, { status: 500 });
    }

    // Si hay una foto de perfil, intentar eliminarla del storage
    if (profile.profile_picture_url) {
      try {
        // Extraer el nombre del archivo de la URL
        const urlParts = profile.profile_picture_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const fullPath = `profile-pictures/${fileName}`;

        // Intentar eliminar del bucket 'public' primero, luego 'documents'
        let deleteError = null;
        try {
          await supabase.storage.from('public').remove([fullPath]);
        } catch (error) {
          deleteError = error;
          // Intentar con bucket 'documents'
          try {
            await supabase.storage.from('documents').remove([fullPath]);
            deleteError = null;
          } catch (docError) {
            console.warn('No se pudo eliminar archivo del storage:', docError);
          }
        }
        
        if (deleteError) {
          console.warn('No se pudo eliminar archivo del storage:', deleteError);
        }
      } catch (storageError) {
        console.warn('No se pudo eliminar archivo del storage:', storageError);
        // Continuar con la eliminación del perfil aunque falle el storage
      }
    }

    // Eliminar URL de la foto de perfil del perfil del usuario
    const { error: updateError } = await supabase
      .from('users')
      .update({ profile_picture_url: null })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error eliminando foto de perfil:', updateError);
      return NextResponse.json({ error: 'Error eliminando foto de perfil' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Foto de perfil eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error en DELETE /api/user/profile-picture:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
