// Script para sincronizar documentos nuevos automáticamente
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function syncNewDocuments() {
    console.log('🔄 Sincronizando documentos nuevos...\n');

    try {
        // Llamar al endpoint de sincronización automática
        const response = await fetch('http://localhost:3001/api/whatsapp/auto-sync-documents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const result = await response.json();
        
        if (result.success) {
            if (result.synced > 0) {
                console.log(`✅ Sincronizados ${result.synced} documentos nuevos`);
                
                if (result.details && result.details.length > 0) {
                    console.log('❌ Errores encontrados:');
                    result.details.forEach((error, index) => {
                        console.log(`   ${index + 1}. ${error.document}: ${error.error}`);
                    });
                }
            } else {
                console.log('✅ No hay documentos nuevos para sincronizar');
            }
        } else {
            console.error('❌ Error en sincronización:', result.error);
        }

    } catch (error) {
        console.error('❌ Error ejecutando sincronización:', error);
    }
}

// Ejecutar sincronización
syncNewDocuments();
