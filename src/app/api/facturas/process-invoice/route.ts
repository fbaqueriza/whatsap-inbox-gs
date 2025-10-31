import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recognizeFromBuffer } from '@/lib/ocr/tesseractProvider';
import { extractHeader, chooseSupplier } from '@/lib/invoiceHeaderExtractor';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runProcessing(
  supabase: ReturnType<typeof createClient>,
  fileUrl: string,
  userId?: string,
  existingInvoiceId?: string
) {
  // Descargar archivo desde signed URL
  const fileResp = await fetch(fileUrl);
  if (!fileResp.ok) {
    throw new Error('No se pudo descargar el archivo');
  }
  const arrayBuffer = await fileResp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = fileResp.headers.get('content-type') || undefined;

  // Extraer texto: PDF nativo o OCR
  let ocr: { text: string; meta?: any };
  const isPdf = (contentType && contentType.includes('pdf')) || /\.pdf($|\?)/i.test(fileUrl);
  if (isPdf) {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const parsed: any = await pdfParse(buffer);
      ocr = {
        text: String(parsed.text || ''),
        meta: { source: 'pdf-text', pages: parsed.numpages, info: parsed.info || null }
      };
      console.log('🧾 [/api/facturas/process-invoice] PDF parsed', { pages: ocr.meta?.pages });
    } catch (e: any) {
      console.warn('🧾 [/api/facturas/process-invoice] PDF parse failed, fallback OCR', e?.message);
      ocr = await recognizeFromBuffer(buffer, contentType);
    }
  } else {
    ocr = await recognizeFromBuffer(buffer, contentType);
  }

  // Extraer encabezado y proveedor
  const header = extractHeader(ocr.text);
  let userBusiness: { cuit?: string; razon_social?: string } | null = null;
  if (userId) {
    const { data: userRow } = await supabase
      .from('users')
      .select('id, razon_social, cuit')
      .eq('id', userId)
      .single();
    if (userRow) userBusiness = { cuit: userRow.cuit || undefined, razon_social: userRow.razon_social || undefined };
  }
  // Resolver CUIT proveedor incluso si el usuario no tiene cargado su CUIT
  let supplier = chooseSupplier(header.parties, userBusiness?.cuit);
  if (!supplier?.cuit) {
    // Heurística: CUIT del comprador suele estar después de "Apellido y Nombre / Razón Social:"
    const txt = ocr.text;
    const cuitMatches = Array.from(txt.matchAll(/(\d{2}[- .]?\d{8}[- .]?\d)/g)).map(m => m[1].replace(/[^0-9]/g, ''));
    const anchorIdx = txt.search(/Apellido\s+y\s+Nombre\s*\/\s*Raz[oó]n\s+Social\s*:/i);
    let buyerCuit: string | undefined;
    if (anchorIdx >= 0) {
      const after = txt.slice(anchorIdx, anchorIdx + 500);
      const m = after.match(/(\d{2}[- .]?\d{8}[- .]?\d)/);
      if (m) buyerCuit = m[1].replace(/[^0-9]/g, '');
    }
    const uniqueCuist = Array.from(new Set(cuitMatches));
    const candidate = uniqueCuist.find(c => !buyerCuit || c !== buyerCuit);
    if (candidate) supplier = { cuit: candidate, role: 'unknown' } as any;
  }
  let providerId: string | undefined;
  let supplierCreated = false;
  let supplierInferredName: string | undefined;
  if (supplier?.cuit) {
    const cuitDigits = supplier.cuit.replace(/[^0-9]/g, '');
    const { data: existingList } = await supabase
      .from('providers')
      .select('id, cuit_cuil')
      .eq('user_id', userId || '')
      .or(`cuit_cuil.eq.${cuitDigits},cuit_cuil.ilike.*${cuitDigits}*`)
      .limit(1);
    const existing = existingList?.[0];
    if (existing?.id) providerId = existing.id;
    else {
      // No crear proveedor automáticamente: abrir modal en frontend con CUIT
      // De todas formas intentamos inferir nombre para prefill opcional
      const ocrLines = ocr.text.split(/\r?\n/).map(l => l.trim());
      const idx = ocrLines.findIndex(l => l.replace(/[^0-9]/g, '').includes(cuitDigits));
      supplierInferredName = undefined;
      for (let j = Math.max(0, idx - 3); j <= Math.min(ocrLines.length - 1, idx + 1); j++) {
        const L = ocrLines[j] || '';
        if (/raz[oó]n\s+social/i.test(L)) {
          supplierInferredName = L.replace(/.*raz[oó]n\s+social\s*:?/i, '').trim();
          break;
        }
        if (/[A-ZÁÉÍÓÚÑ]{3,}/.test(L) && !/[0-9]/.test(L) && L.length <= 80) {
          supplierInferredName = L.trim();
        }
      }
      supplierCreated = false;
    }
  }

  // Parseo por columnas: Producto/Servicio | Cantidad | U. medida | Precio Unit.
  const lines = ocr.text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: any[] = [];
  const parseNumber = (s: string): number => Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;
  const isHeader = (s: string) => /producto.*servicio.*cantidad|u\.\s*medida.*precio\s*unit/i.test(s.replace(/\s+/g, ''));
  let start = lines.findIndex(l => /producto.*servicio/i.test(l.toLowerCase()));
  if (start < 0) start = 0; else start += 1; // saltar encabezado
  for (let i = start; i < lines.length - 2; ) {
    const nameLine = lines[i];
    if (!nameLine || isHeader(nameLine)) { i++; continue; }
    // Ignorar líneas de totales y otros pies de página
    if (/^importe\s|^total\s|^iva\s|^cae\b|vto\.?\s*de\s*cae|comprobante\s+autorizado/i.test(nameLine.toLowerCase())) { i++; continue; }
    const unitLine = lines[i + 1] || '';
    const amountsLine = (lines[i + 2] || '').replace(/\s+/g, '');

    // Cantidad es el último número del nameLine
    const qtyMatch = nameLine.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?!.*\d)/);
    const qty = qtyMatch ? parseNumber(qtyMatch[1]) : 0;
    const name = qtyMatch ? nameLine.slice(0, nameLine.lastIndexOf(qtyMatch[1])).trim() : nameLine.trim();
    // Unidad: tomar literal de la línea siguiente (ej: "unidades")
    const unit = unitLine.toLowerCase();
    // Precio Unit: primer número de la línea de montos
    const priceMatch = amountsLine.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/);
    const priceUnit = priceMatch ? parseNumber(priceMatch[1]) : 0;
    const subtotal = +(qty * priceUnit).toFixed(2);

    if (name && qty > 0) {
      const already = items.find(it => it.name === name && it.quantity === qty && it.unit === unit && it.priceUnitNet === priceUnit);
      if (!already) items.push({ name, quantity: qty, unit, priceUnitNet: priceUnit, priceTotalNet: subtotal });
      i += 3;
    } else {
      i++;
    }
  }
  const extractedData = {
    invoiceNumber: undefined,
    totalAmount: items.reduce((s, it) => s + (it.priceTotalNet || 0), 0),
    invoiceDate: undefined,
    dueDate: undefined,
    currency: 'ARS',
    providerId,
    items
  };

  // Persistencia
  const supplierCuitDigits = supplier?.cuit ? supplier.cuit.replace(/[^0-9]/g, '') : null;
  const contentHash = crypto.createHash('sha256').update((ocr.text || '') + (supplierCuitDigits || '')).digest('hex');
  let invoiceId = existingInvoiceId;
  if (!invoiceId) {
    const { data: existing } = await supabase
      .from('processed_invoices')
      .select('id')
      .eq('user_id', userId)
      .eq('content_hash', contentHash)
      .single();
    invoiceId = existing?.id;
  }
  if (!invoiceId) {
    const { data: created } = await supabase
      .from('processed_invoices')
      .insert({ user_id: userId || null, supplier_id: providerId || null, source_url: fileUrl, content_hash: contentHash, status: 'processed', header_json: { ...header, supplier_detected: !!supplier?.cuit, supplier_created: supplierCreated, supplier_cuit: supplierCuitDigits, supplier_name: supplier?.name || supplierInferredName || null }, ocr_text: ocr.text })
      .select('id')
      .single();
    invoiceId = created?.id || undefined;
  } else {
    await supabase
      .from('processed_invoices')
      .update({ supplier_id: providerId || null, header_json: { ...header, supplier_detected: !!supplier?.cuit, supplier_created: supplierCreated, supplier_cuit: supplierCuitDigits, supplier_name: supplier?.name || supplierInferredName || null }, ocr_text: ocr.text, status: 'processed' })
      .eq('id', invoiceId);
  }

  if (invoiceId) {
    await supabase.from('processed_invoice_items').delete().eq('invoice_id', invoiceId);
    if (items.length) {
      const rows = items.map((it: any, idx: number) => ({ invoice_id: invoiceId, line_number: idx + 1, description: it.name, unit: it.unit, quantity: it.quantity, unit_price_net: it.priceUnitNet, total_net: it.priceTotalNet }));
      await supabase.from('processed_invoice_items').insert(rows);
    }
    if (items.length) {
      for (const it of items) {
        const productName = String(it.name || '').slice(0, 255);
        const unit = it.unit || '';
        // La tabla usada por el frontend es 'stock' (no 'stock_items')
        let { data: existingStock } = await supabase
          .from('stock')
          .select('id, preferred_provider')
          .eq('user_id', userId)
          .eq('product_name', productName)
          .single();
        if (!existingStock) {
          // Intento flexible: búsqueda por ilike para evitar duplicados por minúsculas/espacios
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
          await supabase
            .from('stock')
            .update({
              unit,
              last_price_net: it.priceUnitNet || null,
              quantity: it.quantity || null,
              updated_at: new Date().toISOString(),
              ...(providerId ? { preferred_provider: providerId } : {})
            })
            .eq('id', existingStock.id);
        } else {
          await supabase
            .from('stock')
            .insert({ user_id: userId, product_name: productName, unit, last_price_net: it.priceUnitNet || null, quantity: it.quantity || 0, category: 'Otros', restock_frequency: 'weekly', preferred_provider: providerId || null });
        }
      }
    }
  }

  return { extractedData, ocr, header, invoiceId };
}

export async function POST(request: NextRequest) {
  try {
    const { fileUrl, userId, async: asyncFlag } = await request.json();
    console.log('🧾 [/api/facturas/process-invoice] START', { fileUrl: String(fileUrl||'').slice(0,80), userId });
    if (!fileUrl) {
      return NextResponse.json({ success: false, error: 'fileUrl requerido' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (asyncFlag) {
      // Crear registro en estado processing y ejecutar en background
      const { data: created } = await supabase
        .from('processed_invoices')
        .insert({ user_id: userId || null, supplier_id: null, source_url: fileUrl, content_hash: null, status: 'processing', header_json: null, ocr_text: null })
        .select('id')
        .single();
      const processingId = created?.id;
      setTimeout(async () => {
        try {
          const result = await runProcessing(supabase, fileUrl, userId, processingId || undefined);
          console.log('🧾 [/api/facturas/process-invoice] BG DONE', { id: processingId, items: result.extractedData.items?.length || 0 });
        } catch (e: any) {
          console.error('🧾 [/api/facturas/process-invoice] BG ERROR', e?.message || e);
          if (processingId) {
            await supabase.from('processed_invoices').update({ status: 'error' }).eq('id', processingId);
          }
        }
      }, 0);
      return NextResponse.json({ success: true, accepted: true, processingId }, { status: 202 });
    }

    const { extractedData, ocr, header, invoiceId } = await runProcessing(supabase, fileUrl, userId);
    console.log('🧾 [/api/facturas/process-invoice] DONE', { items: extractedData.items?.length || 0, providerId: extractedData.providerId });
    return NextResponse.json({ success: true, extractedData, ocrMeta: ocr.meta, header, invoiceId });
  } catch (error: any) {
    console.error('🧾 [/api/facturas/process-invoice] ERROR', error?.message || error);
    return NextResponse.json({ success: false, error: error.message || 'Error procesando factura' }, { status: 500 });
  }
}