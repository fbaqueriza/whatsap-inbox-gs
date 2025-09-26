import { NextRequest, NextResponse } from 'next/server';
import { orderFlowService } from '../../../../lib/orderFlowService';

export async function POST(request: NextRequest) {
  try {
    console.log('💳 ===== API UPLOAD-PAYMENT-PROOF INICIADO =====');
    
    const formData = await request.formData();
    const orderId = formData.get('orderId') as string;
    const userId = formData.get('userId') as string;
    const paymentProofFile = formData.get('paymentProof') as File;

    if (!orderId || !userId || !paymentProofFile) {
      console.log('❌ Error: orderId, userId y paymentProof son requeridos');
      return NextResponse.json(
        { error: 'orderId, userId y paymentProof son requeridos' },
        { status: 400 }
      );
    }

    console.log('💳 Subiendo comprobante de pago:', { orderId, userId, fileName: paymentProofFile.name });

    // Procesar comprobante de pago usando el servicio unificado
    const result = await orderFlowService.processPaymentProof(orderId, paymentProofFile, userId);

    console.log('📊 Resultado:', result);
    console.log('🏁 ===== API UPLOAD-PAYMENT-PROOF FINALIZADO =====');

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error en API upload-payment-proof:', error);
    console.log('🏁 ===== API UPLOAD-PAYMENT-PROOF ERROR =====');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
