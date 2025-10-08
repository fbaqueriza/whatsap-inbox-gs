// Script para verificar detalles de mensajes
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkMessagesDetails() {
    console.log('🔍 Verificando detalles de mensajes...\n');

    try {
        // 1. Obtener documentos con whatsapp_message_id
        const { data: docs } = await supabase
            .from('documents')
            .select('id, filename, whatsapp_message_id')
            .not('whatsapp_message_id', 'is', null)
            .limit(5);

        console.log('📎 Documentos con message_id:');
        docs.forEach(doc => {
            console.log(`   - ${doc.filename}: ${doc.whatsapp_message_id}`);
        });

        // 2. Verificar si estos mensajes existen
        if (docs && docs.length > 0) {
            const messageIds = docs.map(doc => doc.whatsapp_message_id);
            console.log('\n📱 Verificando mensajes con estos IDs...');

            const { data: messages } = await supabase
                .from('whatsapp_messages')
                .select('id, content, media_url, contact_id, message_type')
                .in('id', messageIds);

            console.log(`✅ Mensajes encontrados: ${messages ? messages.length : 0}`);
            if (messages) {
                messages.forEach(msg => {
                    console.log(`   - ID: ${msg.id}`);
                    console.log(`     Content: ${msg.content}`);
                    console.log(`     Media URL: ${msg.media_url ? 'SÍ' : 'NO'}`);
                    console.log(`     Contact: ${msg.contact_id}`);
                    console.log(`     Type: ${msg.message_type}`);
                });
            }
        }

        // 3. Verificar mensajes con media_url
        const { data: allMediaMessages } = await supabase
            .from('whatsapp_messages')
            .select('id, content, media_url, contact_id, created_at, message_type')
            .not('media_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(10);

        console.log(`\n📱 Todos los mensajes con media_url: ${allMediaMessages ? allMediaMessages.length : 0}`);
        if (allMediaMessages) {
            allMediaMessages.forEach(msg => {
                console.log(`   - ${msg.content} (${msg.contact_id}) - ${msg.created_at}`);
                console.log(`     Media URL: ${msg.media_url}`);
            });
        }

        // 4. Verificar mensajes recientes del proveedor
        console.log('\n📨 Mensajes recientes del proveedor +5491135562673:');
        const { data: recentMessages } = await supabase
            .from('whatsapp_messages')
            .select('id, content, message_type, created_at, media_url')
            .eq('contact_id', '+5491135562673')
            .order('created_at', { ascending: false })
            .limit(10);

        if (recentMessages) {
            recentMessages.forEach((msg, index) => {
                console.log(`   ${index + 1}. [${msg.message_type}] ${msg.content.substring(0, 50)}...`);
                console.log(`      Media URL: ${msg.media_url ? 'SÍ' : 'NO'}`);
                console.log(`      Created: ${msg.created_at}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkMessagesDetails();
