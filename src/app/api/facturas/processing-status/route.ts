import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const fileUrl = req.nextUrl.searchParams.get('fileUrl');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let data: any = null; let error: any = null;
    if (id) {
      ({ data, error } = await supabase
        .from('processed_invoices')
        .select('id, status, supplier_id, header_json, source_url, created_at')
        .eq('id', id)
        .single());
    } else if (fileUrl) {
      const resp = await supabase
        .from('processed_invoices')
        .select('id, status, supplier_id, header_json, source_url, created_at')
        .eq('source_url', fileUrl)
        .order('created_at', { ascending: false })
        .limit(1);
      data = resp.data?.[0] || null; error = resp.error;
    } else {
      return NextResponse.json({ success: false, error: 'id o fileUrl requerido' }, { status: 400 });
    }
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Error' }, { status: 500 });
  }
}


