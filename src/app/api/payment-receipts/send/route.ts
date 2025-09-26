import { NextRequest, NextResponse } from 'next/server';
import { PaymentReceiptService } from '../../../../lib/paymentReceiptService';

export async function POST(request: NextRequest) {
  try {
    console.log('📱 [API] Enviando comprobante a proveedor');
    
    const body = await request.json();
    const { receiptId, providerId } = body;

    // Validaciones
    if (!receiptId) {
      return NextResponse.json({ success: false, error: 'ID de comprobante requerido' }, { status: 400 });
    }

    if (!providerId) {
      return NextResponse.json({ success: false, error: 'ID de proveedor requerido' }, { status: 400 });
    }

    // Enviar comprobante
    const result = await PaymentReceiptService.sendReceiptToProvider(receiptId, providerId);

    if (result.success) {
      console.log('✅ [API] Comprobante enviado exitosamente:', result.messageId);
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: 'Comprobante enviado exitosamente al proveedor'
      });
    } else {
      console.error('❌ [API] Error enviando comprobante:', result.error);
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Error enviando comprobante' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [API] Error en endpoint de envío:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
