import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '../../../../lib/notificationService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderData } = body;

    if (!orderData) {
      return NextResponse.json(
        { error: 'orderData es requerido' },
        { status: 400 }
      );
    }

    console.log('🧪 TEST - Probando nuevo formato de mensaje con:', {
      orderData,
      hasProviders: !!orderData.providers,
      providerName: orderData.providers?.name,
      orderNumber: orderData.order_number
    });

    // Generar detalles del pedido con el nuevo formato
    const orderDetails = OrderNotificationService.generateOrderDetailsMessage(orderData);

    console.log('🧪 TEST - Nuevo formato de mensaje generado:', orderDetails);

    return NextResponse.json({
      success: true,
      newFormat: orderDetails,
      debug: {
        inputData: orderData,
        hasProviders: !!orderData.providers,
        providerName: orderData.providers?.name,
        orderNumber: orderData.order_number,
        messageLength: orderDetails.length
      }
    });

  } catch (error) {
    console.error('❌ Error en test nuevo formato:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
