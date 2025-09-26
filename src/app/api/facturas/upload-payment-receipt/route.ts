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
    const orderIds = formData.get('orderIds') as string;
    const paymentAmount = formData.get('paymentAmount') as string;
    const paymentDate = formData.get('paymentDate') as string;
    const paymentMethod = formData.get('paymentMethod') as string;
    const notes = formData.get('notes') as string;

    if (!file || !orderIds || !paymentAmount) {
      return NextResponse.json({
        success: false,
        error: 'Archivo, IDs de órdenes y monto son requeridos'
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

    // Parsear IDs de órdenes
    const orderIdArray = orderIds.split(',').map(id => id.trim());
    
    // Verificar que las órdenes existan y estén pendientes de pago
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, currency, status, provider_id')
      .in('id', orderIdArray);

    if (ordersError || !orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se pudieron verificar las órdenes'
      }, { status: 400 });
    }

    // Verificar que todas las órdenes estén pendientes de pago
    const invalidOrders = orders.filter(order => 
      order.status === 'pagado'
    );

    if (invalidOrders.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Algunas órdenes ya están pagadas o finalizadas',
        invalidOrders: invalidOrders.map(o => o.order_number)
      }, { status: 400 });
    }

    // Calcular total de las órdenes seleccionadas
    const totalOrdersAmount = orders.reduce((sum, order) => 
      sum + parseFloat(order.total_amount || '0'), 0
    );

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const fileName = `payment_receipt_${timestamp}_${file.name}`;
    const filePath = `payment_receipts/${timestamp}/${fileName}`;

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
      .upload(filePath, file);

    // 🔧 CORREGIDO: Eliminada referencia a tabla payment_receipts que no existe
    // Los datos del comprobante se guardan directamente en las órdenes
    console.log('📄 Comprobante de pago guardado en storage:', publicUrl);

    // Actualizar todas las órdenes seleccionadas
    const updatePromises = orderIdArray.map(orderId => 
      supabase
        .from('orders')
        .update({
          status: 'pagado',
          payment_receipt_url: publicUrl,
          payment_date: paymentDate || new Date().toISOString(),
          payment_method: paymentMethod || 'transferencia',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
    );

    const updateResults = await Promise.all(updatePromises);
    const updateErrors = updateResults.filter(result => result.error);

    if (updateErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Error actualizando algunas órdenes',
        details: updateErrors.map(e => e.error?.message)
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Comprobante de pago subido y órdenes marcadas como pagadas',
      receiptUrl: publicUrl,
      updatedOrders: orderIdArray,
      totalAmount: totalOrdersAmount,
      paymentAmount: parseFloat(paymentAmount)
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
