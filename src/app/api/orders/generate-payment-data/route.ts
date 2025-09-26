import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';
import { paymentDataService } from '../../../../lib/paymentDataService.js';

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Order ID es requerido'
      }, { status: 400 });
    }

    // Obtener usuario autenticado
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no autenticado'
      }, { status: 401 });
    }

    console.log('💳 [API] Generando datos de pago para orden:', orderId, 'usuario:', user.id);

    // Generar datos de pago
    const result = await paymentDataService.generatePaymentData(orderId, user.id);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    // Actualizar la orden con los datos de pago generados
    const updateResult = await paymentDataService.updateOrderWithPaymentData(
      orderId, 
      user.id, 
      result.data
    );

    if (!updateResult.success) {
      console.warn('⚠️ [API] Error actualizando orden con datos de pago:', updateResult.error);
      // No fallar la respuesta, solo loggear el warning
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('❌ [API] Error generando datos de pago:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Order ID es requerido'
      }, { status: 400 });
    }

    // Obtener usuario autenticado
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no autenticado'
      }, { status: 401 });
    }

    // Generar datos de pago (solo lectura, sin actualizar la orden)
    const result = await paymentDataService.generatePaymentData(orderId, user.id);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('❌ [API] Error obteniendo datos de pago:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}
