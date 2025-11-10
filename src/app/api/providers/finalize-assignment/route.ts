import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { userId, cuit, invoiceItems } = await req.json();
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

    // 3) Obtener productos de esas invoices y agregar/actualizar stock
    // PRIORIDAD: Si se envían items modificados desde el cliente, usarlos en lugar de los de la BD
    let itemsToProcess: any[] = [];
    
    if (invoiceItems && Array.isArray(invoiceItems) && invoiceItems.length > 0) {
      // Usar items modificados desde el cliente
      console.log(`📦 [finalize-assignment] Usando ${invoiceItems.length} items modificados desde el cliente`);
      itemsToProcess = invoiceItems.map((item: any) => ({
        description: item.name || item.description || item.productName || '',
        unit: item.unit || item.unitItem || '',
        quantity: item.quantity || item.quantityItem || 0,
        unit_price_net: item.priceUnitNet || item.price_unit_net || item.unitPrice || null,
      }));
    } else if (invoiceIds.length) {
      // Fallback: obtener items desde la base de datos
      const { data: items, error: itemsErr } = await supabase
        .from('processed_invoice_items')
        .select('description, unit, quantity, unit_price_net')
        .in('invoice_id', invoiceIds);
      if (itemsErr) return NextResponse.json({ success: false, error: itemsErr.message }, { status: 500 });
      itemsToProcess = items || [];
    }
    
    if (itemsToProcess.length > 0) {
      console.log(`📦 [finalize-assignment] Procesando ${itemsToProcess.length} items de facturas para agregar a stock`);
      
      for (const it of itemsToProcess) {
        const productName = String((it as any).description || '').slice(0, 255);
        const unit = (it as any).unit || '';
        const quantity = (it as any).quantity || 0;
        const unitPrice = (it as any).unit_price_net || null;
        
        if (!productName) continue;
        
        // Buscar si ya existe en stock
        let { data: existingStock } = await supabase
          .from('stock')
          .select('id, preferred_provider')
          .eq('user_id', userId)
          .eq('product_name', productName)
          .single();
        
        if (!existingStock) {
          // Intento flexible: búsqueda por ilike para evitar duplicados
          const { data: candidates } = await supabase
            .from('stock')
            .select('id, product_name, preferred_provider')
            .eq('user_id', userId)
            .ilike('product_name', `%${productName}%`)
            .limit(1);
          if (candidates && candidates.length > 0) {
            existingStock = candidates[0];
          }
        }
        
        if (existingStock?.id) {
          // Actualizar item existente
          await supabase
            .from('stock')
            .update({
              unit,
              last_price_net: unitPrice,
              quantity: quantity,
              preferred_provider: provider.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingStock.id);
          console.log(`✅ [finalize-assignment] Stock actualizado: ${productName}`);
        } else {
          // Agregar nuevo item a stock
          await supabase
            .from('stock')
            .insert({
              user_id: userId,
              product_name: productName,
              unit,
              last_price_net: unitPrice,
              quantity: quantity,
              category: 'Otros',
              restock_frequency: 'weekly',
              preferred_provider: provider.id
            });
          console.log(`✅ [finalize-assignment] Stock agregado: ${productName}`);
        }
      }
    }

    return NextResponse.json({ success: true, providerId: provider.id, updatedInvoices: invoiceIds.length });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Error' }, { status: 500 });
  }
}


