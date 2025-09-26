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

    console.log('🧪 TEST - Probando horarios de entrega con:', {
      orderData,
      hasProviders: !!orderData.providers,
      providerName: orderData.providers?.name,
      defaultDeliveryTime: orderData.providers?.default_delivery_time
    });

    // Generar detalles del pedido con horarios de entrega
    const orderDetails = OrderNotificationService.generateOrderDetailsMessage(orderData);

    console.log('🧪 TEST - Mensaje generado con horarios:', orderDetails);

    // Verificar que contenga horarios de entrega
    const hasDeliveryTimes = orderDetails.includes('Horario de entrega:') || orderDetails.includes('Horarios de entrega:');
    const hasNoSpecified = orderDetails.includes('No especificado');
    const hasItemsList = orderDetails.includes('Items del pedido:');

    return NextResponse.json({
      success: true,
      message: orderDetails,
      verification: {
        hasDeliveryTimes: hasDeliveryTimes,
        hasNoSpecified: hasNoSpecified,
        hasItemsList: hasItemsList,
        messageLength: orderDetails.length,
        defaultDeliveryTime: orderData.providers?.default_delivery_time || []
      },
      debug: {
        inputData: orderData,
        hasProviders: !!orderData.providers,
        providerName: orderData.providers?.name,
        defaultDeliveryTime: orderData.providers?.default_delivery_time || []
      }
    });

  } catch (error) {
    console.error('❌ Error en test horarios de entrega:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
