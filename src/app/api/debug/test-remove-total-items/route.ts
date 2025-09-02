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

    console.log('🧪 TEST - Probando eliminación de totalItems con:', {
      orderData,
      hasItems: !!orderData.items,
      itemsCount: orderData.items?.length || 0
    });

    // Generar detalles del pedido sin totalItems
    const orderDetails = OrderNotificationService.generateOrderDetailsMessage(orderData);

    console.log('🧪 TEST - Mensaje generado sin totalItems:', orderDetails);

    // Verificar que no contenga "Total de items"
    const hasTotalItems = orderDetails.includes('Total de items');
    const hasItemsList = orderDetails.includes('Items del pedido');

    return NextResponse.json({
      success: true,
      message: orderDetails,
      verification: {
        hasTotalItems: hasTotalItems,
        hasItemsList: hasItemsList,
        messageLength: orderDetails.length,
        itemsCount: orderData.items?.length || 0
      },
      debug: {
        inputData: orderData,
        hasItems: !!orderData.items,
        itemsCount: orderData.items?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ Error en test eliminación totalItems:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
