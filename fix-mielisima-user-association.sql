-- ============================================
-- 🔧 SCRIPT SQL: CORREGIR ASOCIACIÓN DE LA MIELISIMA
-- ============================================
-- Este script corrige la asociación de La Mielisima
-- del usuario incorrecto al usuario correcto (Francisco Baqueriza)

-- 1. Verificar el estado actual
SELECT 
    'ESTADO ACTUAL' as status,
    p.id,
    p.name,
    p.contact_name,
    p.phone,
    p.user_id,
    u.email as user_email
FROM providers p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.name ILIKE '%mielisima%' OR p.contact_name ILIKE '%mielisima%';

-- 2. Buscar el ID del usuario Francisco Baqueriza
SELECT 
    'USUARIO FRANCISCO' as status,
    id,
    email,
    created_at
FROM auth.users 
WHERE email = 'fbaqueriza@itba.edu.ar';

-- 3. Actualizar La Mielisima para que apunte al usuario correcto
-- NOTA: Reemplaza 'USER_ID_FRANCISCO' con el ID real de Francisco
UPDATE providers 
SET user_id = (
    SELECT id 
    FROM auth.users 
    WHERE email = 'fbaqueriza@itba.edu.ar'
)
WHERE name ILIKE '%mielisima%' OR contact_name ILIKE '%mielisima%';

-- 4. Verificar que la actualización fue exitosa
SELECT 
    'ESTADO DESPUÉS DE LA CORRECCIÓN' as status,
    p.id,
    p.name,
    p.contact_name,
    p.phone,
    p.user_id,
    u.email as user_email
FROM providers p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.name ILIKE '%mielisima%' OR p.contact_name ILIKE '%mielisima%';

-- 5. Verificar que Francisco tiene proveedores asociados
SELECT 
    'PROVEEDORES DE FRANCISCO' as status,
    COUNT(*) as total_providers
FROM providers p
JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'fbaqueriza@itba.edu.ar';

-- 6. Crear configuración WhatsApp para Francisco si no existe
INSERT INTO user_whatsapp_config (
    user_id,
    phone_number,
    kapso_config_id,
    is_active,
    is_sandbox,
    created_at,
    updated_at
)
SELECT 
    u.id,
    '+5491135562673', -- Número de La Mielisima
    'default_config',
    true,
    false,
    NOW(),
    NOW()
FROM auth.users u
WHERE u.email = 'fbaqueriza@itba.edu.ar'
AND NOT EXISTS (
    SELECT 1 
    FROM user_whatsapp_config uwc 
    WHERE uwc.user_id = u.id 
    AND uwc.is_active = true
);

-- 7. Verificar configuración WhatsApp final
SELECT 
    'CONFIGURACIÓN WHATSAPP FINAL' as status,
    uwc.user_id,
    u.email,
    uwc.phone_number,
    uwc.is_active,
    uwc.is_sandbox
FROM user_whatsapp_config uwc
JOIN auth.users u ON uwc.user_id = u.id
WHERE u.email = 'fbaqueriza@itba.edu.ar'
AND uwc.is_active = true;

-- 8. Resumen final del sistema
SELECT 
    'RESUMEN FINAL' as status,
    'Francisco Baqueriza' as usuario,
    COUNT(p.id) as total_proveedores,
    COUNT(CASE WHEN p.name ILIKE '%mielisima%' OR p.contact_name ILIKE '%mielisima%' THEN 1 END) as mielisima_encontrada,
    COUNT(uwc.id) as configuracion_whatsapp
FROM auth.users u
LEFT JOIN providers p ON p.user_id = u.id
LEFT JOIN user_whatsapp_config uwc ON uwc.user_id = u.id AND uwc.is_active = true
WHERE u.email = 'fbaqueriza@itba.edu.ar';
