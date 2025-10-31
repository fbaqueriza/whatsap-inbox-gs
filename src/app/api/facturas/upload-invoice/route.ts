import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null; // opcional

    if (!file) {
      return NextResponse.json({ success: false, error: 'Archivo requerido' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const bucket = 'invoices';
    // Crear bucket si no existe (no falla si ya existe)
    try { await supabase.storage.createBucket(bucket, { public: false }); } catch {}

    const ext = file.name.split('.').pop() || 'bin';
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `${userId || 'anonymous'}/${filename}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false
    });

    if (uploadError) {
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
    }

    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);

    return NextResponse.json({ success: true, bucket, path, fileUrl: signed?.signedUrl });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al subir factura' }, { status: 500 });
  }
}

