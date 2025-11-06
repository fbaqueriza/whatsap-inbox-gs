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
  console.log('🔍 [process-invoice] Iniciando extracción de header');
  const header = extractHeader(ocr.text);
  console.log('📊 [process-invoice] Header extraído:', JSON.stringify(header, null, 2));
  
  let userBusiness: { cuit?: string; razon_social?: string } | null = null;
  if (userId) {
    const { data: userRow } = await supabase
      .from('users')
      .select('id, razon_social, cuit')
      .eq('id', userId)
      .single();
    if (userRow) userBusiness = { cuit: userRow.cuit || undefined, razon_social: userRow.razon_social || undefined };
    console.log('👤 [process-invoice] Datos del usuario:', userBusiness);
  }
  
  // Resolver CUIT proveedor incluso si el usuario no tiene cargado su CUIT
  let supplier = chooseSupplier(header.parties, userBusiness?.cuit);
  console.log('🔍 [process-invoice] Supplier elegido:', supplier);
  
  if (!supplier?.cuit) {
    console.log('⚠️ [process-invoice] No se encontró supplier en header.parties, intentando heurística adicional');
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
    if (candidate) {
      supplier = { cuit: candidate, role: 'unknown' } as any;
      console.log('✅ [process-invoice] Supplier encontrado por heurística:', supplier);
    }
  }
  
  let providerId: string | undefined;
  let supplierCreated = false;
  let supplierInferredName: string | undefined;
  let supplierInferredAddress: string | undefined;
  
  if (supplier?.cuit) {
    const cuitDigits = supplier.cuit.replace(/[^0-9]/g, '');
    console.log(`🔍 [process-invoice] Buscando proveedor existente con CUIT: ${cuitDigits}`);
    
    const { data: existingList } = await supabase
      .from('providers')
      .select('id, cuit_cuil')
      .eq('user_id', userId || '')
      .or(`cuit_cuil.eq.${cuitDigits},cuit_cuil.ilike.*${cuitDigits}*`)
      .limit(1);
    const existing = existingList?.[0];
    
    if (existing?.id) {
      providerId = existing.id;
      console.log(`✅ [process-invoice] Proveedor existente encontrado: ${providerId}`);
    } else {
      console.log('⚠️ [process-invoice] No se encontró proveedor existente, extrayendo datos para prefill');
      // Usar datos extraídos del header si están disponibles
      supplierInferredName = supplier.razonSocial; // Solo usar razón social, no name
      supplierInferredAddress = supplier.address;
      
      console.log(`📊 [process-invoice] Datos inferidos para prefill:`, {
        razonSocial: supplier.razonSocial || supplierInferredName,
        address: supplierInferredAddress
      });
      
      // Si no hay datos en el supplier, intentar extracción adicional
      if (!supplierInferredName || !supplierInferredAddress) {
        const ocrLines = ocr.text.split(/\r?\n/).map(l => l.trim());
        const idx = ocrLines.findIndex(l => l.replace(/[^0-9]/g, '').includes(cuitDigits));
        console.log(`🔍 [process-invoice] Buscando datos alrededor de CUIT en línea ${idx}`);
        
        const EXCLUDE_LABELS = /^(apellido\s+y\s+nombre|apellido\s+y\s+nombre\s*\/\s*raz[oó]n\s+social|nombre\s+y\s+apellido|raz[oó]n\s+social\s*:?\s*$|denominaci[oó]n\s*:?\s*$)/i;
        const EXCLUDE_WORDS = /^(ORIGINAL|DUPLICADO|TRIPLICADO|COPIA|FACTURA|NOTA|CREDITO|DEBITO|RECIBO|COMPROBANTE|A|B|C|PAGO|PENDIENTE)$/i;
        const ADDRESS_HINTS = /(domicilio|direcci[oó]n|direcci[oó]n\s+fiscal|localidad|provincia|cp|c\.p\.|código postal)/i;
        
        for (let j = Math.max(0, idx - 10); j <= Math.min(ocrLines.length - 1, idx + 10); j++) {
          const L = ocrLines[j] || '';
          // Ignorar líneas que son solo labels o palabras comunes de facturas
          if (EXCLUDE_LABELS.test(L)) {
            console.log(`⚠️ [process-invoice] Ignorando línea label: "${L}"`);
            continue;
          }
          if (EXCLUDE_WORDS.test(L.trim())) {
            console.log(`⚠️ [process-invoice] Ignorando palabra común de factura: "${L.trim()}"`);
            continue;
          }
          
          // Buscar razón social - PRIMERO en la misma línea, luego en la siguiente
          if (!supplierInferredName && /raz[oó]n\s+social/i.test(L)) {
            console.log(`🔍 [process-invoice] Línea con hint de razón social encontrada: "${L}" (línea ${j})`);
            
            // PRIORIDAD 1: Extraer de la misma línea después del label (más común)
            // Ejemplos: 
            // - "Razón Social: PEREZ HILERO ARMANDO ENRIQUE"
            // - "Razón Social PEREZ HILERO ARMANDO ENRIQUE"
            // - "Razón Social:PEREZ HILERO ARMANDO ENRIQUE"
            const patterns = [
              /raz[oó]n\s+social\s*:?\s*(.+)/i,  // "Razón Social: VALOR" o "Razón Social VALOR"
              /(?:raz[oó]n\s+social|denominaci[oó]n)\s*:?\s*(.+)/i,  // Más flexible
            ];
            
            for (const pattern of patterns) {
              const sameLineMatch = L.match(pattern);
              if (sameLineMatch && sameLineMatch[1]) {
                let candidate = sameLineMatch[1].trim();
                // Limpiar posibles restos de labels o separadores
                candidate = candidate.replace(/^[:#\-]\s*/, '').trim();
                
                console.log(`🔍 [process-invoice] Candidato extraído: "${candidate}" (longitud: ${candidate.length})`);
                
                if (candidate && candidate.length > 2 && candidate.length < 150) {
                  // Validaciones
                  const isExcludedLabel = EXCLUDE_LABELS.test(candidate);
                  const isNameHint = /raz[oó]n\s+social|domicilio|direcci[oó]n/i.test(candidate);
                  const hasCuit = /(\d{2}[- .]?\d{8}[- .]?\d)/.test(candidate);
                  
                  console.log(`🔍 [process-invoice] Validaciones: isExcludedLabel=${isExcludedLabel}, isNameHint=${isNameHint}, hasCuit=${hasCuit}`);
                  
                  if (!isExcludedLabel && !isNameHint && !hasCuit) {
                    supplierInferredName = candidate;
                    console.log(`✅ [process-invoice] Razón social encontrada (misma línea): "${supplierInferredName}"`);
                    break;
                  }
                }
              }
            }
            
            // Si aún no encontramos, intentar método alternativo: buscar después del ":" sin regex estricto
            if (!supplierInferredName) {
              const colonIndex = L.indexOf(':');
              if (colonIndex > 0 && /raz[oó]n\s+social/i.test(L.substring(0, colonIndex))) {
                let candidate = L.substring(colonIndex + 1).trim();
                if (candidate && candidate.length > 2 && candidate.length < 150) {
                  const isExcludedLabel = EXCLUDE_LABELS.test(candidate);
                  const hasCuit = /(\d{2}[- .]?\d{8}[- .]?\d)/.test(candidate);
                  if (!isExcludedLabel && !hasCuit) {
                    supplierInferredName = candidate;
                    console.log(`✅ [process-invoice] Razón social encontrada (método alternativo, misma línea): "${supplierInferredName}"`);
                  }
                }
              }
            }
            
            // PRIORIDAD 2: Si no hay nada en la misma línea, buscar en la línea siguiente
            if (!supplierInferredName) {
              const nextLineIdx = j + 1;
              if (nextLineIdx < ocrLines.length) {
                const nextLine = ocrLines[nextLineIdx];
                console.log(`🔍 [process-invoice] Revisando línea siguiente: "${nextLine}" (línea ${nextLineIdx})`);
                if (nextLine && nextLine.length > 2 && nextLine.length < 150 && 
                    !EXCLUDE_LABELS.test(nextLine) &&
                    !/raz[oó]n\s+social|domicilio|direcci[oó]n/i.test(nextLine)) {
                  // Verificar que no sea un CUIT
                  const hasCuit = /(\d{2}[- .]?\d{8}[- .]?\d)/.test(nextLine);
                  if (!hasCuit) {
                    supplierInferredName = nextLine.trim();
                    console.log(`✅ [process-invoice] Razón social encontrada (línea siguiente): "${supplierInferredName}"`);
                  }
                }
              }
            }
          }
          
          // Buscar dirección - PRIMERO en la misma línea, luego en la siguiente
          if (!supplierInferredAddress && ADDRESS_HINTS.test(L)) {
            // PRIORIDAD 1: Extraer de la misma línea después del label (más común)
            // Ejemplo: "Domicilio Comercial: Rodriguez Peña 99 Piso:local - Ciudad de Buenos Aires"
            const sameLineMatch = L.match(/(?:domicilio\s+comercial|domicilio|direcci[oó]n|direcci[oó]n\s+fiscal)\s*:?\s*(.+)/i);
            if (sameLineMatch && sameLineMatch[1]) {
              const candidate = sameLineMatch[1].trim();
              if (candidate && candidate.length > 5 && 
                  !EXCLUDE_LABELS.test(candidate) &&
                  !ADDRESS_HINTS.test(candidate) &&
                  !/raz[oó]n\s+social/i.test(candidate) &&
                  // La dirección suele tener números (calle, número, etc.)
                  (/\d/.test(candidate) || /calle|avenida|av\.|avda|boulevard|blvd|ruta/i.test(candidate))) {
                supplierInferredAddress = candidate;
                console.log(`✅ [process-invoice] Dirección encontrada (misma línea): "${supplierInferredAddress}"`);
              }
            }
            
            // PRIORIDAD 2: Si no hay nada en la misma línea, buscar en líneas siguientes
            if (!supplierInferredAddress) {
              for (let k = j + 1; k <= Math.min(ocrLines.length - 1, j + 5); k++) {
                const nextLine = ocrLines[k];
                if (nextLine && nextLine.length > 5 && 
                    !EXCLUDE_LABELS.test(nextLine) &&
                    !ADDRESS_HINTS.test(nextLine) &&
                    !/raz[oó]n\s+social/i.test(nextLine) &&
                    !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(nextLine) &&
                    // La dirección suele tener números (calle, número, etc.)
                    (/\d/.test(nextLine) || /calle|avenida|av\.|avda|boulevard|blvd|ruta/i.test(nextLine))) {
                  supplierInferredAddress = nextLine.trim();
                  console.log(`✅ [process-invoice] Dirección encontrada (línea siguiente): "${supplierInferredAddress}"`);
                  break;
                }
              }
            }
          }
        }
      }
      
      supplierCreated = false;
    }
  } else {
    console.log('❌ [process-invoice] No se encontró CUIT del proveedor en la factura');
  }

  // Parseo por columnas: Producto/Servicio | Cantidad | U. medida | Precio Unit. (MEJORADO)
  const lines = ocr.text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  console.log(`📋 [process-invoice] Total líneas: ${lines.length}`);
  console.log(`📋 [process-invoice] Primeras 30 líneas:`, lines.slice(0, 30));
  const items: any[] = [];
  const parseNumber = (s: string): number => Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;
  
  // 🔧 FUNCIÓN: No limpiar nombres de productos - dejar códigos tal cual
  // (El usuario reportó que se estaba eliminando la primera palabra junto con el código)
  const cleanProductName = (name: string): string => {
    // Devolver el nombre tal cual, sin modificar
    return name ? name.trim() : '';
  };
  
  const isHeader = (s: string) => /producto.*servicio.*cantidad|u\.\s*medida.*precio\s*unit|codigo.*producto.*servicio/i.test(s.replace(/\s+/g, ''));
  const isTotalLine = (s: string) => /^importe\s|^total\s|^subtotal|^iva\s|\d+%:.*\$\d|^cae\s*[n°º]|vto\.?\s*de\s*cae|comprobante\s+autorizado|^codigo.*producto.*servicio/i.test(s.toLowerCase());
  let start = lines.findIndex(l => /producto.*servicio|codigo.*producto.*servicio/i.test(l.toLowerCase()));
  console.log(`📋 [process-invoice] Start index: ${start}`);
  if (start < 0) start = 0; else start += 1; // saltar encabezado
  
  for (let i = start; i < lines.length - 2; ) {
    const line1 = lines[i] || '';
    const line2 = lines[i + 1] || '';
    const line3 = lines[i + 2] || '';
    
    // Skip headers y líneas de totales
    if (!line1 || isHeader(line1) || isTotalLine(line1)) { i++; continue; }
    
    // PATRÓN C: Producto con "x cantidad" (intentamos primero este porque es más específico)
    const xPatternMatch = line1.match(/^(.+?)\s+x\s*(\d+(?:\.\d+)?)\s*$/i);
    if (xPatternMatch) {
      const rawName = xPatternMatch[1].trim();
      const name = cleanProductName(rawName);
      const qty = parseNumber(xPatternMatch[2]);
      const unit = line2.trim().length > 0 ? line2.toLowerCase() : 'un';
      const priceMatches = line3.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g);
      if (priceMatches && priceMatches.length > 0) {
        const priceUnit = parseNumber(priceMatches[0]);
        const total = parseNumber(priceMatches[priceMatches.length - 1]) || (qty * priceUnit);
        if (name.length >= 3 && qty > 0) {
          const already = items.find(it => it.name === name && it.quantity === qty);
          if (!already) {
            console.log(`📦 [process-invoice] Item extraído: "${name}" (qty: ${qty})`);
            items.push({ name, quantity: qty, unit, priceUnitNet: priceUnit, priceTotalNet: total });
          }
          i += 3;
          continue;
        }
      }
    }
    
    // PATRÓN A: nameLine con cantidad al final, unitLine, amountsLine
    const qtyAtEndMatch = line1.match(/(.+?)[\.]?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})$/);
    if (qtyAtEndMatch && line2.toLowerCase().match(/^(un|unidad|unidades|kg|kgs|kg\.|litro|litros|m|metros?|cm|metros?)$/)) {
      const rawName = qtyAtEndMatch[1].trim();
      const name = cleanProductName(rawName);
      const qty = parseNumber(qtyAtEndMatch[2]);
      const unit = line2.toLowerCase();
      const priceMatches = line3.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g);
      if (priceMatches && priceMatches.length > 0) {
        const priceUnit = parseNumber(priceMatches[0]);
        const total = parseNumber(priceMatches[priceMatches.length - 1]) || (qty * priceUnit);
        if (name.length >= 3 && qty > 0) {
          const already = items.find(it => it.name === name && it.quantity === qty);
          if (!already) {
            console.log(`📦 [process-invoice] Item extraído: "${name}" (qty: ${qty})`);
            items.push({ name, quantity: qty, unit, priceUnitNet: priceUnit, priceTotalNet: total });
          }
          i += 3;
          continue;
        }
      }
    }
    
    // PATRÓN B: nombre en line1, cantidad en line2, unidad+precios en line3
    const qtyOnlyMatch = line2.match(/^(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})$/);
    if (qtyOnlyMatch) {
      const rawName = line1.trim();
      const name = cleanProductName(rawName);
      const qty = parseNumber(qtyOnlyMatch[1]);
      const unitPriceMatches = line3.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g);
      if (unitPriceMatches && unitPriceMatches.length > 0) {
        const unitMatch = line3.match(/^([^\d,\.]+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/);
        const unit = unitMatch ? unitMatch[1].trim().toLowerCase() : 'un';
        const priceUnit = parseNumber(unitPriceMatches[0]);
        const total = parseNumber(unitPriceMatches[unitPriceMatches.length - 1]) || (qty * priceUnit);
        if (name.length >= 3 && qty > 0) {
          const already = items.find(it => it.name === name && it.quantity === qty);
          if (!already) {
            console.log(`📦 [process-invoice] Item extraído: "${name}" (qty: ${qty})`);
            items.push({ name, quantity: qty, unit, priceUnitNet: priceUnit, priceTotalNet: total });
          }
          i += 3;
          continue;
        }
      }
    }
    
    // Si ningún patrón funcionó, avanzar
    i++;
  }
  
  console.log(`📋 [process-invoice] Items extraídos: ${items.length}`);
  if (items.length > 0) {
    console.log(`📋 [process-invoice] Items:`, items);
  } else {
    console.log(`⚠️ [process-invoice] NO se extrajeron items`);
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
      .insert({ user_id: userId || null, supplier_id: providerId || null, source_url: fileUrl, content_hash: contentHash, status: 'processed', header_json: { ...header, supplier_detected: !!supplier?.cuit, supplier_created: supplierCreated, supplier_cuit: supplierCuitDigits, supplier_name: null, supplier_razon_social: supplier?.razonSocial || supplierInferredName || null, supplier_address: supplier?.address || supplierInferredAddress || null }, ocr_text: ocr.text })
      .select('id')
      .single();
    invoiceId = created?.id || undefined;
  } else {
    await supabase
      .from('processed_invoices')
      .update({ supplier_id: providerId || null, header_json: { ...header, supplier_detected: !!supplier?.cuit, supplier_created: supplierCreated, supplier_cuit: supplierCuitDigits, supplier_name: null, supplier_razon_social: supplier?.razonSocial || supplierInferredName || null, supplier_address: supplier?.address || supplierInferredAddress || null }, ocr_text: ocr.text, status: 'processed' })
      .eq('id', invoiceId);
  }

  if (invoiceId) {
    await supabase.from('processed_invoice_items').delete().eq('invoice_id', invoiceId);
    if (items.length) {
      const rows = items.map((it: any, idx: number) => ({ invoice_id: invoiceId, line_number: idx + 1, description: it.name, unit: it.unit, quantity: it.quantity, unit_price_net: it.priceUnitNet, total_net: it.priceTotalNet }));
      await supabase.from('processed_invoice_items').insert(rows);
    }
    
    // 🔧 CORRECCIÓN: Solo agregar items a stock si hay un proveedor confirmado (providerId)
    // Si no hay providerId, los items se agregarán cuando el usuario confirme el proveedor
    if (items.length && providerId) {
      console.log(`📦 [process-invoice] Agregando ${items.length} items a stock para proveedor ${providerId}`);
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
              preferred_provider: providerId
            })
            .eq('id', existingStock.id);
        } else {
          await supabase
            .from('stock')
            .insert({ user_id: userId, product_name: productName, unit, last_price_net: it.priceUnitNet || null, quantity: it.quantity || 0, category: 'Otros', restock_frequency: 'weekly', preferred_provider: providerId });
        }
      }
    } else if (items.length && !providerId) {
      console.log(`⚠️ [process-invoice] No hay providerId, items NO se agregarán a stock hasta que se confirme el proveedor`);
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