import { NextRequest, NextResponse } from 'next/server';

/**
 * Valida credenciales de Meta Business API
 * POST /api/whatsapp/validate-meta-credentials
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`🔍 [MetaValidation-${requestId}] Iniciando validación de credenciales Meta`);
    
    const body = await request.json();
    const { phone_number_id, access_token, business_account_id } = body;
    
    // Validar campos requeridos
    if (!phone_number_id || !access_token) {
      console.log(`❌ [MetaValidation-${requestId}] Campos requeridos faltantes`);
      return NextResponse.json({
        success: false,
        error: 'phone_number_id y access_token son requeridos'
      }, { status: 400 });
    }
    
    console.log(`📱 [MetaValidation-${requestId}] Validando credenciales para phone_number_id: ${phone_number_id}`);
    
    // Validar con Meta Graph API
    const metaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${phone_number_id}?fields=id,display_phone_number,verified_name,quality_rating,status&access_token=${access_token}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!metaResponse.ok) {
      const errorData = await metaResponse.json();
      console.log(`❌ [MetaValidation-${requestId}] Error de Meta API:`, errorData);
      
      return NextResponse.json({
        success: false,
        error: 'Credenciales inválidas o número no encontrado',
        details: errorData.error?.message || 'Error desconocido'
      }, { status: 400 });
    }
    
    const metaData = await metaResponse.json();
    console.log(`✅ [MetaValidation-${requestId}] Credenciales válidas:`, {
      id: metaData.id,
      display_phone_number: metaData.display_phone_number,
      verified_name: metaData.verified_name,
      status: metaData.status
    });
    
    // Validar que el número esté activo
    if (metaData.status !== 'CONNECTED') {
      console.log(`⚠️ [MetaValidation-${requestId}] Número no está conectado: ${metaData.status}`);
      
      return NextResponse.json({
        success: false,
        error: 'El número de WhatsApp no está conectado',
        details: `Estado actual: ${metaData.status}. El número debe estar en estado CONNECTED.`
      }, { status: 400 });
    }
    
    // Respuesta exitosa
    return NextResponse.json({
      success: true,
      data: {
        phone_number_id: metaData.id,
        display_phone_number: metaData.display_phone_number,
        verified_name: metaData.verified_name,
        quality_rating: metaData.quality_rating,
        status: metaData.status,
        business_account_id: business_account_id || null
      },
      message: 'Credenciales validadas exitosamente'
    });
    
  } catch (error: any) {
    console.error(`❌ [MetaValidation-${requestId}] Error inesperado:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
