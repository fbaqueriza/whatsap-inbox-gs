import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { userId, cuit } = await req.json();
    if (!userId || !cuit) return NextResponse.json({ success: false, error: 'userId y cuit requeridos' }, { status: 400 });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const digits = String(cuit).replace(/[^0-9]/g, '');
    const canonical = digits; // almacenar y buscar por CUIT sin guiones

    // 1) Resolver provider por CUIT para este usuario
    const { data: providers, error: provErr } = await supabase
      .from('providers')
      .select('id, cuit_cuil, name')
      .eq('user_id', userId)
      .or(`cuit_cuil.eq.${digits},cuit_cuil.ilike.*${digits}*`)
      .order('created_at', { ascending: false })
      .limit(1);
    if (provErr) return NextResponse.json({ success: false, error: provErr.message }, { status: 500 });
    const provider = providers?.[0];
    if (!provider) return NextResponse.json({ success: false, error: 'Proveedor no encontrado para ese CUIT' }, { status: 404 });

    // 2) Actualizar processed_invoices sin supplier_id pero con supplier_cuit detectado
    const likeDigits = `%${digits}%`;
    const { data: invoices, error: invErr } = await supabase
      .from('processed_invoices')
      .select('id')
      .eq('user_id', userId)
      .is('supplier_id', null)
      .or(`header_json->>supplier_cuit.eq.${digits},header_json->>supplier_cuit.ilike.${likeDigits}`);
    if (invErr) return NextResponse.json({ success: false, error: invErr.message }, { status: 500 });
    const invoiceIds = (invoices || []).map(r => r.id);
    if (invoiceIds.length) {
      const { error: updInvErr } = await supabase
        .from('processed_invoices')
        .update({ supplier_id: provider.id })
        .in('id', invoiceIds);
      if (updInvErr) return NextResponse.json({ success: false, error: updInvErr.message }, { status: 500 });
    }

    // 3) Obtener productos de esas invoices y actualizar stock.preferred_provider
    if (invoiceIds.length) {
      const { data: items, error: itemsErr } = await supabase
        .from('processed_invoice_items')
        .select('description, invoice_id')
        .in('invoice_id', invoiceIds);
      if (itemsErr) return NextResponse.json({ success: false, error: itemsErr.message }, { status: 500 });
      const productNames = Array.from(new Set((items || []).map(it => (it as any).description).filter(Boolean)));
      if (productNames.length) {
        // Actualizar por tandas si es necesario
        const batchSize = 50;
        for (let i = 0; i < productNames.length; i += batchSize) {
          const batch = productNames.slice(i, i + batchSize);
          const { error: updStockErr } = await supabase
            .from('stock')
            .update({ preferred_provider: provider.id })
            .eq('user_id', userId)
            .is('preferred_provider', null)
            .in('product_name', batch);
          if (updStockErr) return NextResponse.json({ success: false, error: updStockErr.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true, providerId: provider.id, updatedInvoices: invoiceIds.length });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Error' }, { status: 500 });
  }
}


