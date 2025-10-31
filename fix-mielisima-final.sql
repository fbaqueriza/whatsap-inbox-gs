-- ============================================
-- 🔧 SCRIPT SQL FINAL: CORREGIR LA MIELISIMA
-- ============================================
-- Ejecuta este script completo en Supabase SQL Editor

-- 1. Verificar estado actual de La Mielisima
SELECT 
    'ESTADO ACTUAL DE LA MIELISIMA' as status,
    p.id,
    p.name,
    p.contact_name,
    p.phone,
    p.user_id,
    u.email as user_email
FROM providers p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.name ILIKE '%mielisima%' OR p.contact_name ILIKE '%mielisima%';

-- 2. Buscar Francisco Baqueriza
SELECT 
    'USUARIO FRANCISCO BAQUERIZA' as status,
    id,
    email,
    created_at
FROM auth.users 
WHERE email = 'fbaqueriza@itba.edu.ar';

-- 3. ACTUALIZAR La Mielisima para que apunte a Francisco
UPDATE providers 
SET user_id = (
    SELECT id 
    FROM auth.users 
    WHERE email = 'fbaqueriza@itba.edu.ar'
)
WHERE name ILIKE '%mielisima%' OR contact_name ILIKE '%mielisima%';

-- 4. Verificar que la actualización fue exitosa
SELECT 
    'ESTADO DESPUÉS DE LA ACTUALIZACIÓN' as status,
    p.id,
    p.name,
    p.contact_name,
    p.phone,
    p.user_id,
    u.email as user_email
FROM providers p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.name ILIKE '%mielisima%' OR p.contact_name ILIKE '%mielisima%';

-- 5. Verificar todos los proveedores de Francisco
SELECT 
    'TODOS LOS PROVEEDORES DE FRANCISCO' as status,
    p.id,
    p.name,
    p.contact_name,
    p.phone,
    p.user_id
FROM providers p
JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'fbaqueriza@itba.edu.ar'
ORDER BY p.name;

-- 6. Verificar configuración WhatsApp de Francisco
SELECT 
    'CONFIGURACIÓN WHATSAPP DE FRANCISCO' as status,
    uwc.id,
    uwc.user_id,
    uwc.whatsapp_phone_number,
    uwc.kapso_config_id,
    uwc.is_active,
    uwc.is_sandbox
FROM user_whatsapp_config uwc
JOIN auth.users u ON uwc.user_id = u.id
WHERE u.email = 'fbaqueriza@itba.edu.ar'
AND uwc.is_active = true;

-- 7. Si no tiene configuración WhatsApp, crearla
INSERT INTO user_whatsapp_config (
    user_id,
    whatsapp_phone_number,
    kapso_config_id,
    is_active,
    is_sandbox,
    created_at,
    updated_at
)
SELECT 
    u.id,
    '+5491135562673', -- Número de La Mielisima
    'sandbox-config-' || u.id,
    true,
    true,
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

-- 8. Verificar configuración WhatsApp final
SELECT 
    'CONFIGURACIÓN WHATSAPP FINAL' as status,
    uwc.id,
    uwc.user_id,
    uwc.whatsapp_phone_number,
    uwc.kapso_config_id,
    uwc.is_active,
    uwc.is_sandbox
FROM user_whatsapp_config uwc
JOIN auth.users u ON uwc.user_id = u.id
WHERE u.email = 'fbaqueriza@itba.edu.ar'
AND uwc.is_active = true;

-- 9. Resumen final del sistema
SELECT 
    'RESUMEN FINAL DEL SISTEMA' as status,
    'Francisco Baqueriza' as usuario,
    COUNT(p.id) as total_proveedores,
    COUNT(CASE WHEN p.name ILIKE '%mielisima%' OR p.contact_name ILIKE '%mielisima%' THEN 1 END) as mielisima_encontrada,
    COUNT(uwc.id) as configuracion_whatsapp
FROM auth.users u
LEFT JOIN providers p ON p.user_id = u.id
LEFT JOIN user_whatsapp_config uwc ON uwc.user_id = u.id AND uwc.is_active = true
WHERE u.email = 'fbaqueriza@itba.edu.ar';

-- 10. Verificar que La Mielisima esté en la lista de proveedores de Francisco
SELECT 
    'LA MIELISIMA EN LISTA DE FRANCISCO' as status,
    p.id,
    p.name,
    p.contact_name,
    p.phone,
    p.user_id,
    u.email as user_email
FROM providers p
JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'fbaqueriza@itba.edu.ar'
AND (p.name ILIKE '%mielisima%' OR p.contact_name ILIKE '%mielisima%');
