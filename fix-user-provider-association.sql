-- CORRECCIÓN: Asociar La Mielisima al usuario correcto
-- Francisco Baqueriza (fbaqueriza@itba.edu.ar) debe tener La Mielisima como proveedor

-- 1. Verificar usuarios existentes
SELECT id, email, created_at FROM auth.users 
WHERE email = 'fbaqueriza@itba.edu.ar' OR email = 'test@kapso.com'
ORDER BY created_at DESC;

-- 2. Verificar proveedores existentes
SELECT p.id, p.name, p.contact_name, p.phone, p.user_id, u.email as user_email
FROM providers p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.name ILIKE '%mielisima%' OR p.contact_name ILIKE '%mielisima%';

-- 3. Si Francisco (fbaqueriza@itba.edu.ar) existe, asociar La Mielisima a él
-- Si no existe, crear el usuario o usar el existente (test@kapso.com)

-- OPCIÓN A: Si Francisco existe con fbaqueriza@itba.edu.ar
-- UPDATE providers 
-- SET user_id = (SELECT id FROM auth.users WHERE email = 'fbaqueriza@itba.edu.ar')
-- WHERE name ILIKE '%mielisima%' OR contact_name ILIKE '%mielisima%';

-- OPCIÓN B: Si Francisco no existe, usar el usuario test@kapso.com
UPDATE providers 
SET user_id = (SELECT id FROM auth.users WHERE email = 'test@kapso.com')
WHERE name ILIKE '%mielisima%' OR contact_name ILIKE '%mielisima%';

-- 4. Verificar la asociación después del update
SELECT p.id, p.name, p.contact_name, p.phone, p.user_id, u.email as user_email
FROM providers p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.name ILIKE '%mielisima%' OR p.contact_name ILIKE '%mielisima%';

-- 5. Verificar configuración WhatsApp del usuario
SELECT uwc.*, u.email as user_email
FROM user_whatsapp_config uwc
LEFT JOIN auth.users u ON uwc.user_id = u.id
WHERE u.email = 'test@kapso.com' OR u.email = 'fbaqueriza@itba.edu.ar';
