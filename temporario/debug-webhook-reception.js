require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function debugWebhookReception() {
    console.log('🔍 Analizando recepción de webhooks...');
    
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    try {
        // Obtener documentos reales (no simulados) más recientes
        const { data: realDocuments, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .not('whatsapp_message_id', 'like', '%test_%')
            .not('whatsapp_message_id', 'like', '%mock_%')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (docsError) {
            console.error('❌ Error obteniendo documentos:', docsError);
            return;
        }
        
        if (!realDocuments || realDocuments.length === 0) {
            console.log('ℹ️ No hay documentos reales para analizar');
            return;
        }
        
        console.log(`📄 Analizando ${realDocuments.length} documentos reales:`);
        
        for (const doc of realDocuments) {
            console.log(`\n📎 Documento: ${doc.filename}`);
            console.log(`   WhatsApp Message ID: ${doc.whatsapp_message_id}`);
            console.log(`   Creado: ${doc.created_at}`);
            console.log(`   Provider Phone: ${doc.provider_phone}`);
            console.log(`   Provider ID: ${doc.provider_id}`);
            
            // Verificar si tiene mensaje en el chat
            const { data: message, error: msgError } = await supabase
                .from('whatsapp_messages')
                .select('id, created_at')
                .eq('message_sid', doc.whatsapp_message_id)
                .single();
            
            if (msgError && msgError.code !== 'PGRST116') {
                console.log(`   ❌ Error verificando mensaje: ${msgError.message}`);
            } else if (message) {
                console.log(`   ✅ Mensaje en chat: ${message.id} (${message.created_at})`);
            } else {
                console.log(`   ❌ NO TIENE MENSAJE EN CHAT`);
                
                // Analizar el timestamp del documento vs ahora
                const docTime = new Date(doc.created_at);
                const now = new Date();
                const diffMinutes = Math.floor((now - docTime) / (1000 * 60));
                
                console.log(`   🕐 Tiempo transcurrido: ${diffMinutes} minutos`);
                
                if (diffMinutes < 10) {
                    console.log(`   🚨 DOCUMENTO RECIENTE SIN MENSAJE - Webhook falló`);
                } else {
                    console.log(`   ℹ️ Documento antiguo, posible fallo histórico`);
                }
            }
        }
        
        // Analizar patrones de timestamps
        console.log(`\n📊 Análisis de patrones:`);
        
        const recentDocs = realDocuments.filter(doc => {
            const docTime = new Date(doc.created_at);
            const now = new Date();
            const diffMinutes = Math.floor((now - docTime) / (1000 * 60));
            return diffMinutes < 30; // Últimos 30 minutos
        });
        
        const docsWithMessages = await Promise.all(
            recentDocs.map(async (doc) => {
                const { data: message } = await supabase
                    .from('whatsapp_messages')
                    .select('id')
                    .eq('message_sid', doc.whatsapp_message_id)
                    .single();
                return { doc, hasMessage: !!message };
            })
        );
        
        const docsWithoutMessages = docsWithMessages.filter(item => !item.hasMessage);
        
        console.log(`   📄 Documentos recientes (30 min): ${recentDocs.length}`);
        console.log(`   ✅ Con mensaje en chat: ${docsWithMessages.length - docsWithoutMessages.length}`);
        console.log(`   ❌ Sin mensaje en chat: ${docsWithoutMessages.length}`);
        
        if (docsWithoutMessages.length > 0) {
            console.log(`\n🚨 PROBLEMA CONFIRMADO:`);
            console.log(`   ${docsWithoutMessages.length} documentos recientes NO tienen mensaje en chat`);
            console.log(`   Esto indica que el webhook está fallando al crear mensajes`);
            
            // Analizar si es un problema de provider_phone
            const docsWithoutProviderPhone = docsWithoutMessages.filter(item => !item.doc.provider_phone);
            console.log(`   📞 Documentos sin provider_phone: ${docsWithoutProviderPhone.length}`);
            
            if (docsWithoutProviderPhone.length > 0) {
                console.log(`   🔍 CAUSA PROBABLE: provider_phone es null/undefined`);
                console.log(`   📝 Esto explicaría el error "null value in column contact_id"`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error en análisis:', error);
    }
}

debugWebhookReception();
