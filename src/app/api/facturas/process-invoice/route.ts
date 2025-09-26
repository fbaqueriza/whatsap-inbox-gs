import { NextRequest, NextResponse } from 'next/server';
import { InvoiceProcessingService } from '../../../../lib/invoiceProcessingService';

export async function POST(request: NextRequest) {
  try {
    const { orderId, fileUrl, providerId } = await request.json();

    if (!orderId || !fileUrl) {
      return NextResponse.json({
        success: false,
        error: 'orderId y fileUrl son requeridos'
      }, { status: 400 });
    }

    // 🔧 REFACTORIZADO: Usar servicio centralizado de procesamiento
    const invoiceService = InvoiceProcessingService.getInstance();
    const result = await invoiceService.processInvoiceFromUrl(fileUrl, orderId, providerId);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Factura procesada exitosamente',
      extractedData: result.data,
      orderId: result.orderId
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}