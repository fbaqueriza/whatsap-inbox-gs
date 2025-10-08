require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function monitorWebhookLogs() {
    console.log('🔍 Monitoreando logs del webhook...');
    
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    try {
        // Obtener documentos más recientes (últimos 10)
        const { data: documents, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (docsError) {
            console.error('❌ Error obteniendo documentos:', docsError);
            return;
        }
        
        if (!documents || documents.length === 0) {
            console.log('ℹ️ No hay documentos para analizar');
            return;
        }
        
        console.log(`📄 Analizando ${documents.length} documentos recientes:`);
        
        for (const doc of documents) {
            console.log(`\n📎 Documento: ${doc.filename}`);
            console.log(`   ID: ${doc.id}`);
            console.log(`   WhatsApp Message ID: ${doc.whatsapp_message_id}`);
            console.log(`   Creado: ${doc.created_at}`);
            console.log(`   Tipo: ${doc.file_type}`);
            console.log(`   Tamaño: ${doc.file_size} bytes`);
            
            // Verificar si tiene mensaje en el chat
            const { data: message, error: msgError } = await supabase
                .from('whatsapp_messages')
                .select('id, content, created_at')
                .eq('message_sid', doc.whatsapp_message_id)
                .single();
            
            if (msgError && msgError.code !== 'PGRST116') {
                console.log(`   ❌ Error verificando mensaje: ${msgError.message}`);
            } else if (message) {
                console.log(`   ✅ Mensaje en chat: ${message.id}`);
                console.log(`   📝 Contenido: ${message.content}`);
                console.log(`   🕐 Creado: ${message.created_at}`);
            } else {
                console.log(`   ❌ NO TIENE MENSAJE EN CHAT`);
                
                // Verificar si el WhatsApp ID es real o simulado
                const isSimulated = doc.whatsapp_message_id.includes('test_') || 
                                  doc.whatsapp_message_id.includes('mock_');
                
                if (isSimulated) {
                    console.log(`   🧪 Es un documento simulado`);
                } else {
                    console.log(`   📱 Es un documento REAL de WhatsApp`);
                    console.log(`   🚨 PROBLEMA: Documento real sin mensaje en chat`);
                }
            }
        }
        
        // Analizar patrones
        const realDocs = documents.filter(doc => 
            !doc.whatsapp_message_id.includes('test_') && 
            !doc.whatsapp_message_id.includes('mock_')
        );
        
        const simulatedDocs = documents.filter(doc => 
            doc.whatsapp_message_id.includes('test_') || 
            doc.whatsapp_message_id.includes('mock_')
        );
        
        console.log(`\n📊 Resumen:`);
        console.log(`   📱 Documentos reales: ${realDocs.length}`);
        console.log(`   🧪 Documentos simulados: ${simulatedDocs.length}`);
        
        if (realDocs.length > 0) {
            console.log(`\n🚨 PROBLEMA DETECTADO:`);
            console.log(`   Hay ${realDocs.length} documentos reales de WhatsApp`);
            console.log(`   que se están creando en la base de datos`);
            console.log(`   pero NO están apareciendo en el chat.`);
            console.log(`\n💡 Esto indica que:`);
            console.log(`   1. WhatsApp SÍ está enviando los documentos`);
            console.log(`   2. El webhook SÍ los está procesando`);
            console.log(`   3. Pero falla al crear los mensajes en el chat`);
        }
        
    } catch (error) {
        console.error('❌ Error en monitoreo:', error);
    }
}

monitorWebhookLogs();
