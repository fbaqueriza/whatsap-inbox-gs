const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  try {
    const idArg = process.argv[2];
    if (idArg) {
      const { data, error } = await supabase
        .from('processed_invoices')
        .select('id, status, created_at, supplier_id, header_json, ocr_text')
        .eq('id', idArg)
        .single();
      if (error) throw error;
      console.log('📄 processed_invoices row:', JSON.stringify(data, null, 2));
      const { data: items } = await supabase
        .from('processed_invoice_items')
        .select('line_number, description, unit, quantity, unit_price_net, total_net')
        .eq('invoice_id', idArg)
        .order('line_number');
      console.log('🧾 items:', items?.length || 0);
      if (items?.length) console.log(JSON.stringify(items.slice(0, 10), null, 2));
      return;
    }

    const { data: rows, error } = await supabase
      .from('processed_invoices')
      .select('id, status, created_at, supplier_id')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    console.log('📋 Últimas processed_invoices:', rows);
  } catch (e) {
    console.error('❌ Error consultando facturas procesadas:', e.message || e);
    process.exit(1);
  }
}

run();


