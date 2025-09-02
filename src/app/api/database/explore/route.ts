import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    console.log('🔍 EXPLORANDO BASE DE DATOS SUPABASE COMPLETA...');

    // TODAS LAS TABLAS IDENTIFICADAS
    const allTables = [
      'chat_contacts',
      'conversation_members', 
      'conversations',
      'document_analysis',
      'document_processing_logs',
      'documents_wit...', // documents_with_access
      'invoice_order_assignment',
      'orders',
      'pending_orders',
      'providers',
      'received_documents',
      'stock',
      'users',
      'whatsapp_clients',
      'whatsapp_messages',
      'whatsapp_templates'
    ];

    const tableStructures: any = {};
    
    for (const tableName of allTables) {
      try {
        console.log(`🔍 Analizando tabla: ${tableName}`);
        
        // Obtener datos de ejemplo
        const { data: sampleData, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(3);

        if (sampleError) {
          console.error(`❌ Error consultando ${tableName}:`, sampleError);
          tableStructures[tableName] = {
            exists: false,
            error: sampleError.message
          };
          continue;
        }

        // Obtener conteo de registros
        const { count, error: countError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        // Si hay datos, inferir estructura
        let columns: any[] = [];
        if (sampleData && sampleData.length > 0) {
          const firstRecord = sampleData[0];
          columns = Object.keys(firstRecord).map(key => ({
            column_name: key,
            data_type: typeof firstRecord[key],
            sample_value: firstRecord[key]
          }));
        }

        tableStructures[tableName] = {
          columns,
          sampleData: sampleData || [],
          recordCount: count || 0,
          exists: true
        };

        console.log(`✅ ${tableName}: ${count || 0} registros, ${columns.length} columnas`);

      } catch (error) {
        console.error(`❌ Error procesando ${tableName}:`, error);
        tableStructures[tableName] = {
          exists: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        };
      }
    }

    // VERIFICAR RELACIONES CLAVE
    console.log('\n🔗 VERIFICANDO RELACIONES CLAVE...');
    
    // Relación providers -> orders
    if (tableStructures.providers?.exists && tableStructures.orders?.exists) {
      try {
        const { data: providerOrders, error: poError } = await supabase
          .from('orders')
          .select('id, provider_id, created_at')
          .limit(5);

        if (!poError && providerOrders) {
          console.log('✅ Relación providers -> orders verificada');
          tableStructures.orders.relationships = {
            providers: 'provider_id -> providers.id'
          };
        }
      } catch (error) {
        console.log('❌ No se pudo verificar relación providers -> orders');
      }
    }

    // Relación orders -> pending_orders
    if (tableStructures.orders?.exists && tableStructures.pending_orders?.exists) {
      try {
        const { data: pendingData, error: pendingError } = await supabase
          .from('pending_orders')
          .select('id, order_id, provider_phone, status')
          .limit(5);

        if (!pendingError && pendingData) {
          console.log('✅ Relación orders -> pending_orders verificada');
          tableStructures.pending_orders.relationships = {
            orders: 'order_id -> orders.id'
          };
        }
      } catch (error) {
        console.log('❌ No se pudo verificar relación orders -> pending_orders');
      }
    }

    // Relación invoice_order_assignment
    if (tableStructures.invoice_order_assignment?.exists) {
      try {
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoice_order_assignment')
          .select('*')
          .limit(3);

        if (!invoiceError && invoiceData) {
          console.log('✅ Tabla invoice_order_assignment accesible');
        }
      } catch (error) {
        console.log('❌ No se pudo acceder a invoice_order_assignment');
      }
    }

    // Relación documents_with_access
    if (tableStructures['documents_wit...']?.exists) {
      try {
        const { data: docsData, error: docsError } = await supabase
          .from('documents_wit...')
          .select('*')
          .limit(3);

        if (!docsError && docsData) {
          console.log('✅ Tabla documents_with_access accesible');
        }
      } catch (error) {
        console.log('❌ No se pudo acceder a documents_with_access');
      }
    }

    const result = {
      success: true,
      tableStructures,
      summary: {
        totalTables: Object.keys(tableStructures).length,
        existingTables: Object.values(tableStructures).filter((t: any) => t.exists).length,
        totalRecords: Object.values(tableStructures).reduce((acc: number, table: any) => {
          return acc + (table.recordCount || 0);
        }, 0)
      },
      recommendations: {
        invoices: 'Sistema de facturas usando orders + invoice_order_assignment',
        documents: 'Gestión de documentos con documents_with_access + received_documents',
        payments: 'Flujo de pagos integrado con providers + orders',
        chat: 'Sistema de chat con conversations + chat_contacts'
      }
    };

    console.log('✅ Exploración completa finalizada exitosamente');
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error general:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
