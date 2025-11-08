import { NextRequest, NextResponse } from 'next/server';
import { PaymentReceiptService } from '../../../../lib/paymentReceiptService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('📄 [API] Obteniendo comprobantes de pago');
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Obtener comprobantes del usuario
    const receipts = await PaymentReceiptService.getUserPaymentReceipts(userId);

    console.log('✅ [API] Comprobantes obtenidos:', receipts.length);
    return NextResponse.json({
      success: true,
      receipts,
      count: receipts.length
    });

  } catch (error) {
    console.error('❌ [API] Error obteniendo comprobantes:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
