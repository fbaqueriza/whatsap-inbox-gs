import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [KapsoConfigInfo] Obteniendo información de configuración...');

    const kapsoConfigId = 'bae605ec-7674-40da-8787-1990cc42cbb3';
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    const kapsoBaseUrl = process.env.KAPSO_API_URL || 'https://app.kapso.ai/api/v1';

    if (!kapsoApiKey) {
      return NextResponse.json({
        success: false,
        error: 'KAPSO_API_KEY no está configurada'
      }, { status: 500 });
    }

    // Probar diferentes endpoints para obtener información de configuración
    const infoEndpoints = [
      `/whatsapp_configs/${kapsoConfigId}`,
      `/whatsapp_configs/${kapsoConfigId}/webhook`,
      `/whatsapp_configs/${kapsoConfigId}/webhooks`,
      `/whatsapp_configs/${kapsoConfigId}/settings`,
      `/whatsapp_configs/${kapsoConfigId}/configuration`,
      `/whatsapp_configs`,
      `/webhooks`,
      `/webhook`
    ];

    const results = [];

    for (const endpoint of infoEndpoints) {
      try {
        console.log(`🔍 [KapsoConfigInfo] Probando GET ${endpoint}`);
        
        const response = await fetch(`${kapsoBaseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${kapsoApiKey}`,
            'Content-Type': 'application/json'
          }
        });

        const responseText = await response.text();
        
        results.push({
          endpoint,
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          response: responseText.substring(0, 500) // Primeros 500 caracteres
        });

        console.log(`📊 [KapsoConfigInfo] GET ${endpoint}: ${response.status} ${response.statusText}`);

        if (response.ok) {
          console.log(`✅ [KapsoConfigInfo] Información obtenida de ${endpoint}`);
          try {
            const jsonResponse = JSON.parse(responseText);
            return NextResponse.json({
              success: true,
              message: `Información obtenida de ${endpoint}`,
              data: {
                endpoint,
                response: jsonResponse
              }
            });
          } catch (parseError) {
            return NextResponse.json({
              success: true,
              message: `Información obtenida de ${endpoint} (texto plano)`,
              data: {
                endpoint,
                response: responseText
              }
            });
          }
        }
      } catch (error: any) {
        results.push({
          endpoint,
          error: error.message,
          success: false
        });
        console.log(`❌ [KapsoConfigInfo] Error en GET ${endpoint}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: false,
      error: 'No se pudo obtener información de configuración de ningún endpoint',
      results: results,
      kapsoConfigId,
      message: 'Todos los endpoints probados devolvieron error. Es posible que la API de Kapso no tenga endpoints para configuración de webhooks.'
    });

  } catch (error: any) {
    console.error('❌ [KapsoConfigInfo] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
