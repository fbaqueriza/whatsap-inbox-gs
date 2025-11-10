const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'bimbinilo.ba@gmail.com');
  if (!user) {
    console.error('Usuario no encontrado');
    return;
  }

  const { data: config } = await supabase
    .from('user_whatsapp_config')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!config) {
    console.error('Configuración activa no encontrada');
    return;
  }

  const businessAccountId = config.waba_id || '1111665601092656';
  const KAPSO_API_URL = https://api.kapso.ai/meta/whatsapp/v23.0//message_templates;
  const kapsoApiKey = process.env.KAPSO_API_KEY;

  if (!kapsoApiKey) {
    console.error('KAPSO_API_KEY no configurada');
    return;
  }

  const headers = {
    'X-API-Key': kapsoApiKey,
    'Content-Type': 'application/json'
  };

  console.log(' Buscando templates evio_orden existentes...');
  const listResponse = await fetch(KAPSO_API_URL, { headers });
  const listData = await listResponse.json();

  const existing = (listData.data || []).filter(t => t.name === 'evio_orden');
  console.log(   Encontrados: );

  for (const template of existing) {
    console.log( Eliminando ID  (estado ));
    const deleteResp = await fetch(${KAPSO_API_URL}/, {
      method: 'DELETE',
      headers
    });

    if (deleteResp.ok) {
      console.log('    Eliminado');
    } else {
      const errorText = await deleteResp.text();
      console.log('    Error eliminando:', errorText);
    }
  }

  console.log(' Esperando 120 segundos para que Meta procese la eliminación...');
  await delay(120000);

  const templatePayload = {
    name: 'evio_orden',
    language: 'es_AR',
    category: 'MARKETING',
    parameter_format: 'NAMED',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Nueva orden {{company_name}}',
        example: {
          header_text_named_params: [
            { param_name: 'company_name', example: 'L\'igiene' }
          ]
        }
      },
      {
        type: 'BODY',
        text: 'Buen día {{contact_name}}! A continuación, paso el pedido de esta semana.',
        example: {
          body_text_named_params: [
            { param_name: 'contact_name', example: 'L\'igiene' }
          ]
        }
      }
    ]
  };

  console.log(' Creando template evio_orden con formato correcto...');
  const createResp = await fetch(KAPSO_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(templatePayload)
  });

  const text = await createResp.text();
  if (createResp.ok) {
    console.log(' Template creado:', text);
  } else {
    console.error(' Error creando template:', text);
  }
}

run().catch(err => {
  console.error('Error inesperado:', err);
});
