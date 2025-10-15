import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
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

    // Obtener perfil del usuario
    const { data: profile, error } = await supabase
      .from('users')
      .select('id, email, display_name, profile_picture_url, status_message, status_emoji, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error obteniendo perfil:', error);
      return NextResponse.json({ error: 'Error obteniendo perfil' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      profile: {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        profilePictureUrl: profile.profile_picture_url,
        statusMessage: profile.status_message,
        statusEmoji: profile.status_emoji,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    });

  } catch (error) {
    console.error('Error en GET /api/user/profile:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    // Obtener datos del body
    const body = await request.json();
    const { displayName, statusMessage, statusEmoji } = body;

    // Validar datos
    if (displayName && displayName.length > 100) {
      return NextResponse.json({ error: 'El nombre no puede tener más de 100 caracteres' }, { status: 400 });
    }

    if (statusMessage && statusMessage.length > 200) {
      return NextResponse.json({ error: 'El mensaje de estado no puede tener más de 200 caracteres' }, { status: 400 });
    }

    if (statusEmoji && statusEmoji.length > 10) {
      return NextResponse.json({ error: 'El emoji de estado no puede tener más de 10 caracteres' }, { status: 400 });
    }

    // Actualizar perfil
    const updateData: any = {};
    if (displayName !== undefined) updateData.display_name = displayName;
    if (statusMessage !== undefined) updateData.status_message = statusMessage;
    if (statusEmoji !== undefined) updateData.status_emoji = statusEmoji;

    const { data: updatedProfile, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select('id, email, display_name, profile_picture_url, status_message, status_emoji, updated_at')
      .single();

    if (error) {
      console.error('Error actualizando perfil:', error);
      return NextResponse.json({ error: 'Error actualizando perfil' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Perfil actualizado exitosamente',
      profile: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        displayName: updatedProfile.display_name,
        profilePictureUrl: updatedProfile.profile_picture_url,
        statusMessage: updatedProfile.status_message,
        statusEmoji: updatedProfile.status_emoji,
        updatedAt: updatedProfile.updated_at
      }
    });

  } catch (error) {
    console.error('Error en PUT /api/user/profile:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
