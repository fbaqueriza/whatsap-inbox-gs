// Llenar tabla conversations directamente usando las credenciales
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan credenciales de Supabase en el .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function populateConversations() {
    console.log('🔧 Llenando tabla conversations...\n');

    try {
        // 1. Obtener contactos únicos de mensajes
        console.log('📞 Obteniendo contactos únicos de mensajes...');
        const { data: uniqueContacts, error: contactsError } = await supabase
            .from('whatsapp_messages')
            .select('contact_id')
            .not('contact_id', 'is', null)
            .order('timestamp', { ascending: false });

        if (contactsError) {
            console.error('❌ Error al obtener contactos:', contactsError);
            return;
        }

        // Agrupar por contact_id y obtener el último mensaje
        const contactMap = new Map();
        uniqueContacts.forEach(msg => {
            if (!contactMap.has(msg.contact_id)) {
                contactMap.set(msg.contact_id, msg);
            }
        });

        console.log(`✅ Encontrados ${contactMap.size} contactos únicos`);

        // 2. Para cada contacto, obtener información del proveedor y último mensaje
        for (const [contactId, contactData] of contactMap) {
            console.log(`\n🔍 Procesando contacto: ${contactId}`);

            // Obtener información del proveedor
            const { data: provider, error: providerError } = await supabase
                .from('providers')
                .select('name')
                .eq('phone', contactId)
                .single();

            const contactName = provider?.name || 'Contacto';

            // Obtener último mensaje
            const { data: lastMessage, error: lastMsgError } = await supabase
                .from('whatsapp_messages')
                .select('timestamp')
                .eq('contact_id', contactId)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();

            const lastMessageAt = lastMessage?.timestamp || new Date().toISOString();

            // 3. Insertar o actualizar conversación
            const { data: conversation, error: insertError } = await supabase
                .from('conversations')
                .upsert({
                    phone_number: contactId,
                    contact_name: contactName,
                    last_message_at: lastMessageAt,
                    unread_count: 0,
                    is_active: true
                }, {
                    onConflict: 'phone_number'
                })
                .select();

            if (insertError) {
                console.error(`❌ Error al insertar conversación para ${contactId}:`, insertError);
            } else {
                console.log(`✅ Conversación creada/actualizada para ${contactId} (${contactName})`);
            }
        }

        // 4. Verificar resultado final
        console.log('\n📊 Verificando resultado final...');
        const { data: finalConversations, error: finalError } = await supabase
            .from('conversations')
            .select('*')
            .order('last_message_at', { ascending: false });

        if (finalError) {
            console.error('❌ Error al verificar resultado:', finalError);
        } else {
            console.log(`✅ Total conversaciones creadas: ${finalConversations.length}`);
            finalConversations.forEach(conv => {
                console.log(`   - ${conv.phone_number} (${conv.contact_name}) - ${conv.last_message_at}`);
            });
        }

    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

populateConversations();
