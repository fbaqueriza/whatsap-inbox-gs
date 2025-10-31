require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function setupWorkflows() {
  try {
    console.log('🔧 [SetupWorkflows] Iniciando configuración de workflows...');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Crear tabla workflows usando el método directo
    console.log('📄 [SetupWorkflows] Creando tabla workflows...');
    
    // Primero verificar si la tabla existe
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'workflows');

    if (tablesError) {
      console.log('⚠️ [SetupWorkflows] No se pudo verificar si la tabla existe, continuando...');
    } else if (tables && tables.length > 0) {
      console.log('✅ [SetupWorkflows] La tabla workflows ya existe');
      return;
    }

    // Crear la tabla usando una consulta SQL directa
    const { error: createError } = await supabase
      .from('workflows')
      .select('id')
      .limit(1);

    if (createError && createError.code === 'PGRST116') {
      // La tabla no existe, necesitamos crearla
      console.log('📝 [SetupWorkflows] La tabla no existe, creándola...');
      
      // Usar el cliente de Supabase para ejecutar SQL directamente
      const { data, error } = await supabase
        .rpc('exec', {
          sql: `
            CREATE TABLE workflows (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
              name VARCHAR(255) NOT NULL,
              description TEXT,
              triggers TEXT[] DEFAULT '{}',
              actions TEXT[] DEFAULT '{}',
              status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
              config JSONB DEFAULT '{}',
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          `
        });

      if (error) {
        console.error('❌ [SetupWorkflows] Error creando tabla:', error);
        return;
      }

      console.log('✅ [SetupWorkflows] Tabla workflows creada exitosamente');
    } else if (createError) {
      console.error('❌ [SetupWorkflows] Error verificando tabla:', createError);
      return;
    } else {
      console.log('✅ [SetupWorkflows] La tabla workflows ya existe');
    }

    // Crear algunos workflows de ejemplo
    console.log('📝 [SetupWorkflows] Creando workflows de ejemplo...');
    
    const { data: users } = await supabase.auth.admin.listUsers();
    if (users && users.users.length > 0) {
      const userId = users.users[0].id;
      
      const exampleWorkflows = [
        {
          user_id: userId,
          name: 'Notificación de orden creada',
          description: 'Envía notificación automática cuando se crea una nueva orden',
          triggers: ['order_created'],
          actions: ['send_whatsapp_message', 'create_notification'],
          status: 'active'
        },
        {
          user_id: userId,
          name: 'Alerta de stock bajo',
          description: 'Notifica cuando el stock de un producto está bajo',
          triggers: ['stock_low'],
          actions: ['send_whatsapp_template', 'send_email'],
          status: 'draft'
        },
        {
          user_id: userId,
          name: 'Confirmación de pago',
          description: 'Confirma automáticamente cuando se recibe un pago',
          triggers: ['payment_received'],
          actions: ['update_order_status', 'send_whatsapp_message'],
          status: 'active'
        }
      ];

      for (const workflow of exampleWorkflows) {
        const { error: insertError } = await supabase
          .from('workflows')
          .insert(workflow);

        if (insertError) {
          console.error('❌ [SetupWorkflows] Error insertando workflow:', insertError);
        } else {
          console.log('✅ [SetupWorkflows] Workflow creado:', workflow.name);
        }
      }
    }

    console.log('✅ [SetupWorkflows] Configuración completada exitosamente');

  } catch (error) {
    console.error('❌ [SetupWorkflows] Error general:', error);
  }
}

setupWorkflows();
