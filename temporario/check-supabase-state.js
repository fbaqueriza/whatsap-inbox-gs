// Verificar estado de Supabase usando las credenciales del .env
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan credenciales de Supabase en el .env');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSupabaseState() {
    console.log('🔍 Verificando estado de Supabase...\n');

    try {
        // 1. Verificar conversaciones
        console.log('📞 CONVERSACIONES:');
        const { data: conversations, error: convError } = await supabase
            .from('conversations')
            .select('*')
            .order('last_message_at', { ascending: false })
            .limit(5);

        if (convError) {
            console.error('❌ Error al obtener conversaciones:', convError);
        } else {
            console.log(`✅ Total conversaciones: ${conversations.length}`);
            conversations.forEach(conv => {
                console.log(`   - ${conv.phone_number} (${conv.contact_name}) - ${conv.last_message_at}`);
            });
        }

        // 2. Verificar mensajes recientes
        console.log('\n📨 MENSAJES RECIENTES:');
        const { data: messages, error: msgError } = await supabase
            .from('whatsapp_messages')
            .select('id, content, message_type, contact_id, user_id, timestamp')
            .eq('contact_id', '+5491135562673')
            .order('timestamp', { ascending: false })
            .limit(5);

        if (msgError) {
            console.error('❌ Error al obtener mensajes:', msgError);
        } else {
            console.log(`✅ Total mensajes para +5491135562673: ${messages.length}`);
            messages.forEach(msg => {
                console.log(`   - ${msg.message_type}: ${msg.content.substring(0, 50)}... (${msg.timestamp})`);
            });
        }

        // 3. Verificar órdenes recientes
        console.log('\n📦 ÓRDENES RECIENTES:');
        const { data: orders, error: orderError } = await supabase
            .from('orders')
            .select('id, order_number, status, created_at, updated_at, provider_id')
            .eq('user_id', 'b5a237e6-c9f9-4561-af07-a1408825ab50')
            .order('created_at', { ascending: false })
            .limit(5);

        if (orderError) {
            console.error('❌ Error al obtener órdenes:', orderError);
        } else {
            console.log(`✅ Total órdenes: ${orders.length}`);
            orders.forEach(order => {
                console.log(`   - ${order.order_number}: ${order.status} (${order.created_at})`);
            });
        }

        // 4. Verificar proveedores
        console.log('\n🏪 PROVEEDORES:');
        const { data: providers, error: provError } = await supabase
            .from('providers')
            .select('id, name, phone, user_id')
            .eq('phone', '+5491135562673');

        if (provError) {
            console.error('❌ Error al obtener proveedores:', provError);
        } else {
            console.log(`✅ Proveedores encontrados: ${providers.length}`);
            providers.forEach(prov => {
                console.log(`   - ${prov.name} (${prov.phone}) - User: ${prov.user_id}`);
            });
        }

    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

checkSupabaseState();
