import { NextRequest, NextResponse } from 'next/server';
import { OrderNotificationService } from '../../../../lib/orderNotificationService';

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

    console.log('🧪 TEST - Probando generateOrderDetailsMessage con:', {
      orderData,
      hasProviders: !!orderData.providers,
      providerName: orderData.providers?.name,
      providerId: orderData.providers?.id,
      providerNotes: orderData.providers?.notes,
      orderDate: orderData.order_date,
      orderNotes: orderData.notes
    });

    // Generar detalles del pedido
    const orderDetails = OrderNotificationService.generateOrderDetailsMessage(orderData);

    console.log('🧪 TEST - Resultado de generateOrderDetailsMessage:', orderDetails);

    return NextResponse.json({
      success: true,
      orderDetails,
      debug: {
        inputData: orderData,
        hasProviders: !!orderData.providers,
        providerName: orderData.providers?.name,
        providerId: orderData.providers?.id,
        providerNotes: orderData.providers?.notes,
        orderDate: orderData.order_date,
        orderNotes: orderData.notes
      }
    });

  } catch (error) {
    console.error('❌ Error en test generateOrderDetailsMessage:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
