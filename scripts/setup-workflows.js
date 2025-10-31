require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function setupWorkflows() {
  try {
    console.log('🔧 [SetupWorkflows] Iniciando configuración de workflows...');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Crear tabla workflows
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS workflows (
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
    `;

    console.log('📄 [SetupWorkflows] Creando tabla workflows...');
    const { error: tableError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (tableError) {
      console.error('❌ [SetupWorkflows] Error creando tabla:', tableError);
      return;
    }

    // Crear índices
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
      CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
      CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at);
    `;

    console.log('📊 [SetupWorkflows] Creando índices...');
    const { error: indexError } = await supabase.rpc('exec_sql', { sql: createIndexesSQL });
    
    if (indexError) {
      console.error('❌ [SetupWorkflows] Error creando índices:', indexError);
    }

    // Habilitar RLS
    const enableRLSSQL = `
      ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
    `;

    console.log('🔒 [SetupWorkflows] Habilitando RLS...');
    const { error: rlsError } = await supabase.rpc('exec_sql', { sql: enableRLSSQL });
    
    if (rlsError) {
      console.error('❌ [SetupWorkflows] Error habilitando RLS:', rlsError);
    }

    // Crear política RLS
    const createPolicySQL = `
      CREATE POLICY IF NOT EXISTS "Users can only see their own workflows" ON workflows
        FOR ALL USING (auth.uid() = user_id);
    `;

    console.log('🛡️ [SetupWorkflows] Creando política RLS...');
    const { error: policyError } = await supabase.rpc('exec_sql', { sql: createPolicySQL });
    
    if (policyError) {
      console.error('❌ [SetupWorkflows] Error creando política:', policyError);
    }

    // Crear función de trigger
    const createTriggerFunctionSQL = `
      CREATE OR REPLACE FUNCTION update_workflows_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;

    console.log('⚡ [SetupWorkflows] Creando función de trigger...');
    const { error: functionError } = await supabase.rpc('exec_sql', { sql: createTriggerFunctionSQL });
    
    if (functionError) {
      console.error('❌ [SetupWorkflows] Error creando función:', functionError);
    }

    // Crear trigger
    const createTriggerSQL = `
      DROP TRIGGER IF EXISTS update_workflows_updated_at_trigger ON workflows;
      CREATE TRIGGER update_workflows_updated_at_trigger
        BEFORE UPDATE ON workflows
        FOR EACH ROW
        EXECUTE FUNCTION update_workflows_updated_at();
    `;

    console.log('🔄 [SetupWorkflows] Creando trigger...');
    const { error: triggerError } = await supabase.rpc('exec_sql', { sql: createTriggerSQL });
    
    if (triggerError) {
      console.error('❌ [SetupWorkflows] Error creando trigger:', triggerError);
    }

    console.log('✅ [SetupWorkflows] Configuración de workflows completada exitosamente');

  } catch (error) {
    console.error('❌ [SetupWorkflows] Error general:', error);
  }
}

setupWorkflows();
