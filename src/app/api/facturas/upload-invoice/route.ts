import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const providerId = formData.get('providerId') as string;
    const orderId = formData.get('orderId') as string;

    if (!file || !providerId) {
      return NextResponse.json({
        success: false,
        error: 'Archivo y proveedor son requeridos'
      }, { status: 400 });
    }

    // Validar tipo de archivo
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'Solo se permiten archivos PDF e imágenes'
      }, { status: 400 });
    }

    // Generar nombre único para el archivo
    const fileName = `invoice_${Date.now()}_${file.name}`;
    const filePath = `invoices/${providerId}/${fileName}`;

    // Subir archivo a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      return NextResponse.json({
        success: false,
        error: 'Error subiendo archivo',
        details: uploadError.message
      }, { status: 500 });
    }

    // Obtener URL pública del archivo
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    // Si se especificó una orden específica, asociarla directamente y procesarla
    if (orderId) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          receipt_url: publicUrl,
          status: 'pendiente_de_pago',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        return NextResponse.json({
          success: false,
          error: 'Error asociando factura a orden',
          details: updateError.message
        }, { status: 500 });
      }

      // 🔧 CORREGIDO: Procesar automáticamente la factura
      try {
        console.log('🔍 Iniciando procesamiento de factura:', publicUrl);
        
        // 🔧 REFACTORIZADO: Procesar con servicio centralizado
        const processResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/facturas/process-invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderId,
            fileUrl: publicUrl,
            providerId: providerId
          })
        });

        const processData = await processResponse.json();
        
        if (processData.success) {
          console.log('✅ Factura procesada automáticamente:', processData.extractedData);
        } else {
          console.warn('⚠️ Error en procesamiento automático:', processData.error);
        }
      } catch (processError) {
        console.warn('⚠️ Error en procesamiento automático:', processError);
      }

      return NextResponse.json({
        success: true,
        message: 'Factura asociada y procesada automáticamente',
        orderId,
        fileUrl: publicUrl
      });
    }

    // Si no se especificó orden, buscar la más reciente del proveedor
    const { data: latestOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount')
      .eq('provider_id', providerId)
      .is('receipt_url', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (orderError || !latestOrder || latestOrder.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron órdenes pendientes para este proveedor'
      }, { status: 404 });
    }

    const orderToUpdate = latestOrder[0];

    // Asociar factura a la orden más reciente
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        receipt_url: publicUrl,
        status: 'factura_recibida',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderToUpdate.id);

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: 'Error asociando factura a orden',
        details: updateError.message
      }, { status: 500 });
    }

    // 🔧 NUEVO: Procesar automáticamente la factura con OCR real
    try {
      console.log('🔍 Iniciando OCR real para factura (sin orden específica):', publicUrl);
      
      // 🔧 OCR REAL: Usar Tesseract.js en el servidor
      const Tesseract = require('tesseract.js');
      
      const { data: { text, confidence } } = await Tesseract.recognize(
        publicUrl,
        'spa', // Español
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              console.log(`📄 OCR Progreso: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      console.log('📄 Texto extraído por OCR:', text.substring(0, 500) + '...');
      console.log('🎯 Confianza OCR:', confidence);

      // 🔧 PARSING: Extraer datos específicos del texto
      const extractedData = parseInvoiceText(text, { name: providerId });
      
      const realOCRData = {
        text,
        confidence,
        invoiceNumber: extractedData.invoiceNumber || `FAC-${Date.now()}`,
        totalAmount: extractedData.totalAmount || orderToUpdate.total_amount,
        invoiceDate: extractedData.invoiceDate || new Date().toISOString(),
        cuit: extractedData.cuit || providerId
      };

      const processResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/facturas/process-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderToUpdate.id,
          fileUrl: publicUrl,
          providerId: providerId,
          ocrData: realOCRData
        })
      });

      const processData = await processResponse.json();
      
      if (processData.success) {
        console.log('✅ Factura procesada automáticamente:', processData.extractedData);
      } else {
        console.warn('⚠️ Error en procesamiento automático:', processData.error);
      }
    } catch (processError) {
      console.warn('⚠️ Error en procesamiento automático:', processError);
    }

    return NextResponse.json({
      success: true,
      message: 'Factura procesada y asociada automáticamente',
      orderId: orderToUpdate.id,
      orderNumber: orderToUpdate.order_number,
      fileUrl: publicUrl
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

// 🔧 NUEVO: Función para parsear texto extraído por OCR
function parseInvoiceText(text: string, providerData: any) {
  console.log('📄 Parseando texto OCR:', text.substring(0, 500) + '...');

  // 🔧 REGEX: Patrones para extraer datos específicos
  const patterns = {
    // Número de factura (varios formatos)
    invoiceNumber: [
      /(?:factura|invoice|n[º°]?[:\s]*)([A-Z0-9\-]+)/i,
      /(?:n[º°]?[:\s]*)([0-9]{4,})/i,
      /(?:comprobante|recibo)[:\s]*([A-Z0-9\-]+)/i
    ],
    
    // Monto total (varios formatos)
    totalAmount: [
      /(?:total|importe|monto)[:\s]*\$?\s*([0-9,\.]+)/i,
      /(?:a\s+pagar|total\s+a\s+pagar)[:\s]*\$?\s*([0-9,\.]+)/i,
      /\$\s*([0-9,\.]+)\s*(?:pesos|ars)?/i
    ],
    
    // Fecha (varios formatos)
    invoiceDate: [
      /(?:fecha|date)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
      /([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/,
      /(?:emisi[óo]n|emitido)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i
    ],
    
    // CUIT/CUIL
    cuit: [
      /(?:cuit|cuil)[:\s]*([0-9]{2}[\/\-]?[0-9]{8}[\/\-]?[0-9])/i,
      /([0-9]{2}[\/\-]?[0-9]{8}[\/\-]?[0-9])/
    ]
  };

  // 🔧 EXTRACCIÓN: Buscar cada patrón
  let extractedData: any = {};

  // Buscar número de factura
  for (const pattern of patterns.invoiceNumber) {
    const match = text.match(pattern);
    if (match && match[1]) {
      extractedData.invoiceNumber = match[1].trim();
      break;
    }
  }

  // Buscar monto total
  for (const pattern of patterns.totalAmount) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const amountStr = match[1].replace(/[^\d,\.]/g, '').replace(',', '.');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        extractedData.totalAmount = amount;
        break;
      }
    }
  }

  // Buscar fecha
  for (const pattern of patterns.invoiceDate) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const dateStr = match[1].trim();
      const parsedDate = parseDate(dateStr);
      if (parsedDate) {
        extractedData.invoiceDate = parsedDate.toISOString();
        break;
      }
    }
  }

  // Buscar CUIT
  for (const pattern of patterns.cuit) {
    const match = text.match(pattern);
    if (match && match[1]) {
      extractedData.cuit = match[1].replace(/[^\d]/g, '');
      break;
    }
  }

  console.log('📄 Datos extraídos:', extractedData);
  return extractedData;
}

// 🔧 NUEVO: Función para parsear fechas
function parseDate(dateStr: string): Date | null {
  try {
    const formats = [
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let day = parseInt(match[1]);
        let month = parseInt(match[2]) - 1;
        let year = parseInt(match[3]);
        
        if (year < 100) {
          year += 2000;
        }

        const date = new Date(year, month, day);
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
          return date;
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}
