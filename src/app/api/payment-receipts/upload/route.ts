import { NextRequest, NextResponse } from 'next/server';
import { PaymentReceiptService } from '../../../../lib/paymentReceiptService';
import { extractPaymentData } from '../../../../lib/simplePaymentExtraction';

export async function POST(request: NextRequest) {
  try {
    console.log('📄 [API] Iniciando subida de comprobante de pago');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    // Los datos de pago se extraerán automáticamente del documento

    // Validaciones
    if (!file) {
      return NextResponse.json({ success: false, error: 'No se proporcionó archivo' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Validar tipo de archivo
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Tipo de archivo no permitido. Solo se permiten PDF, JPG y PNG' 
      }, { status: 400 });
    }

    // Validar tamaño (10MB máximo)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ 
        success: false, 
        error: 'El archivo es demasiado grande. Máximo 10MB' 
      }, { status: 400 });
    }

    // 1. Subir comprobante sin metadatos (se extraerán automáticamente)
    const result = await PaymentReceiptService.uploadPaymentReceipt(file, userId);

    if (result.success && result.receipt) {
      // 2. Procesar el archivo para extraer datos automáticamente
      try {
        console.log('🔍 [API] Iniciando extracción de datos del archivo:', file.name);
        
        // Convertir archivo a texto para extracción
        let extractedText = '';
        
        if (file.type === 'application/pdf') {
          // Para PDFs, usar pdf-parse
          const pdfParse = require('pdf-parse');
          const buffer = await file.arrayBuffer();
          const pdfData = await pdfParse(Buffer.from(buffer));
          extractedText = pdfData.text;
        } else if (file.type.startsWith('image/')) {
          // Para imágenes, por ahora usar datos de ejemplo
          // TODO: Implementar OCR real para imágenes
          extractedText = `COMPROBANTE DE PAGO
Monto: $25000
Fecha: ${new Date().toLocaleDateString('es-AR')}
Método: Transferencia bancaria
Número: TRF-${Date.now()}`;
        }
        
        console.log('📄 [API] Texto extraído:', extractedText.substring(0, 200) + '...');
        
        // Extraer datos estructurados del texto
        const extractionResult = extractPaymentData(extractedText);
        
        if (extractionResult.success && extractionResult.data) {
          const extractedData = extractionResult.data;
          console.log('✅ [API] Datos extraídos automáticamente:', extractedData);

          // 3. Actualizar el comprobante con los datos extraídos
          await PaymentReceiptService.updatePaymentReceiptData(result.receipt.id, extractedData);
          
          // 4. Procesar comprobante para asignación automática (después de tener los datos extraídos)
          // Ejecutar inmediatamente después de confirmar que los datos se guardaron
          console.log('⏳ [API] Procesando comprobante para asignación automática...');
          try {
            const processResult = await PaymentReceiptService.processPaymentReceipt(result.receipt.id);
            if (processResult.success) {
              console.log('✅ [API] Comprobante procesado exitosamente');
            } else {
              console.error('❌ [API] Error procesando comprobante:', processResult.error);
            }
          } catch (error) {
            console.error('❌ [API] Error procesando comprobante:', error);
          }
        } else {
          console.warn('⚠️ [API] No se pudieron extraer datos del texto:', extractionResult.error);
        }
        
      } catch (extractionError) {
        console.warn('⚠️ [API] Error en extracción automática:', extractionError);
        // Continuar aunque falle la extracción
      }
    }

    if (result.success) {
      console.log('✅ [API] Comprobante subido exitosamente:', result.receipt?.id);
      return NextResponse.json({
        success: true,
        receipt: result.receipt,
        message: 'Comprobante subido exitosamente'
      });
    } else {
      console.error('❌ [API] Error subiendo comprobante:', result.error);
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Error subiendo comprobante' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [API] Error en endpoint de subida:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
