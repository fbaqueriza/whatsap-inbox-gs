require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkDocumentsSchema() {
    console.log('🔍 Verificando estructura de la tabla documents...');
    
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    try {
        // Intentar obtener la estructura de la tabla
        const { data: columns, error } = await supabase
            .rpc('get_table_columns', { table_name: 'documents' });
        
        if (error) {
            console.log('⚠️ No se pudo obtener estructura directamente, probando con consulta...');
            
            // Intentar una consulta que nos muestre las columnas disponibles
            const { data: sample, error: sampleError } = await supabase
                .from('documents')
                .select('*')
                .limit(1);
            
            if (sampleError) {
                console.error('❌ Error en consulta de muestra:', sampleError);
                return;
            }
            
            if (sample && sample.length > 0) {
                console.log('📋 Columnas disponibles en tabla documents:');
                Object.keys(sample[0]).forEach(key => {
                    console.log(`   - ${key}: ${typeof sample[0][key]}`);
                });
            } else {
                console.log('ℹ️ No hay documentos en la tabla para analizar estructura');
            }
        } else {
            console.log('📋 Estructura de tabla documents:', columns);
        }
        
        // Verificar si existe la columna provider_phone específicamente
        console.log('\n🔍 Verificando columna provider_phone específicamente...');
        const { data: testQuery, error: testError } = await supabase
            .from('documents')
            .select('provider_phone')
            .limit(1);
        
        if (testError) {
            console.log(`❌ Columna provider_phone NO existe: ${testError.message}`);
            
            // Verificar qué columnas relacionadas con teléfono existen
            console.log('\n🔍 Buscando columnas relacionadas con teléfono...');
            const { data: allDocs, error: allError } = await supabase
                .from('documents')
                .select('*')
                .limit(1);
            
            if (!allError && allDocs && allDocs.length > 0) {
                const phoneRelatedColumns = Object.keys(allDocs[0]).filter(key => 
                    key.toLowerCase().includes('phone') || 
                    key.toLowerCase().includes('sender') ||
                    key.toLowerCase().includes('contact')
                );
                
                console.log('📞 Columnas relacionadas con teléfono/sender encontradas:');
                phoneRelatedColumns.forEach(col => {
                    console.log(`   - ${col}: ${allDocs[0][col]}`);
                });
            }
        } else {
            console.log('✅ Columna provider_phone SÍ existe');
        }
        
    } catch (error) {
        console.error('❌ Error verificando esquema:', error);
    }
}

checkDocumentsSchema();
