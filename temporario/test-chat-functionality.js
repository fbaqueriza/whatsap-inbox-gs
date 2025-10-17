const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testChatFunctionality() {
  console.log('🧪 Testing chat functionality...');
  
  try {
    // Test 1: Check if Kapso messages exist
    console.log('\n📊 Test 1: Checking Kapso messages...');
    const { data: messages, error: messagesError } = await supabase
      .from('kapso_messages')
      .select('*')
      .eq('user_id', '39a01409-56ed-4ae6-884a-148ad5edb1e1')
      .order('timestamp', { ascending: false })
      .limit(5);
    
    if (messagesError) {
      console.error('❌ Error fetching messages:', messagesError);
    } else {
      console.log(`✅ Found ${messages.length} recent messages`);
      messages.forEach(msg => {
        console.log(`  - ${msg.content} (${msg.timestamp})`);
      });
    }
    
    // Test 2: Check if Kapso conversations exist
    console.log('\n📊 Test 2: Checking Kapso conversations...');
    const { data: conversations, error: conversationsError } = await supabase
      .from('kapso_conversations')
      .select('*')
      .eq('user_id', '39a01409-56ed-4ae6-884a-148ad5edb1e1')
      .order('last_message_at', { ascending: false })
      .limit(5);
    
    if (conversationsError) {
      console.error('❌ Error fetching conversations:', conversationsError);
    } else {
      console.log(`✅ Found ${conversations.length} recent conversations`);
      conversations.forEach(conv => {
        console.log(`  - ${conv.contact_name || conv.phone_number} (${conv.last_message_at})`);
      });
    }
    
    // Test 3: Check if API endpoint works
    console.log('\n📊 Test 3: Testing API endpoint...');
    try {
      const response = await fetch('http://localhost:3001/api/kapso/data?userId=39a01409-56ed-4ae6-884a-148ad5edb1e1');
      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ API endpoint working');
        console.log(`  - Conversations: ${result.data?.conversations?.length || 0}`);
        console.log(`  - Messages: ${result.data?.messages?.length || 0}`);
        console.log(`  - Contacts: ${result.data?.contacts?.length || 0}`);
      } else {
        console.error('❌ API endpoint error:', result.error);
      }
    } catch (apiError) {
      console.error('❌ API endpoint failed:', apiError.message);
    }
    
    console.log('\n✅ Chat functionality test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testChatFunctionality();
