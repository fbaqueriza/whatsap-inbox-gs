import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const requestId = `test_doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`🧪 [${requestId}] ===== TEST DOCUMENT WEBHOOK =====`);
    
    // Simular un webhook de Kapso con documento
    const testDocumentWebhook = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1123051623072203',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '5491141780300',
                  phone_number_id: '670680919470999'
                },
                messages: [
                  {
                    from: '5491135562673',
                    id: 'wamid.test_document_' + Date.now(),
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: 'document',
                    document: {
                      filename: 'factura_test.pdf',
                      mime_type: 'application/pdf',
                      sha256: 'test_sha256_hash',
                      id: 'test_document_id_' + Date.now(),
                      url: 'https://example.com/test_document.pdf'
                    }
                  }
                ],
                contacts: [
                  {
                    profile: {
                      name: 'Proveedor Test'
                    },
                    wa_id: '5491135562673'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ],
      controller: 'api/webhooks/whatsapp',
      action: 'receive',
      whatsapp: {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '1123051623072203',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '5491141780300',
                    phone_number_id: '670680919470999'
                  },
                  messages: [
                    {
                      from: '5491135562673',
                      id: 'wamid.test_document_' + Date.now(),
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      type: 'document',
                      document: {
                        filename: 'factura_test.pdf',
                        mime_type: 'application/pdf',
                        sha256: 'test_sha256_hash',
                        id: 'test_document_id_' + Date.now(),
                        url: 'https://example.com/test_document.pdf'
                      }
                    }
                  ],
                  contacts: [
                    {
                      profile: {
                        name: 'Proveedor Test'
                      },
                      wa_id: '5491135562673'
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      }
    };
    
    console.log(`📤 [${requestId}] Enviando test webhook con documento...`);
    console.log(`📄 [${requestId}] Documento simulado:`, JSON.stringify(testDocumentWebhook, null, 2));
    
    // Enviar el webhook simulado al endpoint real
    const response = await fetch('http://localhost:3001/api/kapso/supabase-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kapso-signature': '2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb'
      },
      body: JSON.stringify(testDocumentWebhook)
    });
    
    const result = await response.json();
    
    console.log(`📥 [${requestId}] Respuesta del webhook:`, result);
    
    return NextResponse.json({
      status: 'ok',
      message: 'Test document webhook enviado',
      requestId,
      webhookResponse: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error en test document webhook:`, error);
    return NextResponse.json({
      status: 'error',
      message: 'Error en test document webhook',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
