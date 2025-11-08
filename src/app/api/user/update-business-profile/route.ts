import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { razon_social, cuit } = await req.json();

    if (!razon_social || !cuit) {
      return NextResponse.json({ success: false, error: 'razon_social y cuit son requeridos' }, { status: 400 });
    }

    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    // Guardar en tabla users
    const { error } = await supabase
      .from('users')
      .update({ razon_social, cuit })
      .eq('id', user.id);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Error' }, { status: 500 });
  }
}


