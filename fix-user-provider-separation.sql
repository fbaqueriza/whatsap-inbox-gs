-- CORRECCIÓN: Separar usuarios de proveedores en la base de datos
-- Francisco Baqueriza = USUARIO
-- La Mielisima = PROVEEDOR de Francisco

-- 1. Verificar que Francisco Baqueriza esté en la tabla de usuarios (auth.users)
-- 2. Verificar que La Mielisima esté en la tabla de proveedores (providers)
-- 3. Asegurar que La Mielisima tenga user_id = Francisco Baqueriza

-- Verificar usuarios existentes
SELECT id, email, created_at FROM auth.users WHERE email LIKE '%francisco%' OR email LIKE '%baqueriza%';

-- Verificar proveedores de Francisco
SELECT p.id, p.name, p.contact_name, p.phone, p.user_id, u.email as user_email
FROM providers p
JOIN auth.users u ON p.user_id = u.id
WHERE u.email LIKE '%francisco%' OR u.email LIKE '%baqueriza%';

-- Buscar "La Mielisima" específicamente
SELECT p.id, p.name, p.contact_name, p.phone, p.user_id, u.email as user_email
FROM providers p
JOIN auth.users u ON p.user_id = u.id
WHERE p.name ILIKE '%mielisima%' OR p.contact_name ILIKE '%mielisima%';

-- Verificar configuración de WhatsApp del usuario Francisco
SELECT uwc.*, u.email as user_email
FROM user_whatsapp_config uwc
JOIN auth.users u ON uwc.user_id = u.id
WHERE u.email LIKE '%francisco%' OR u.email LIKE '%baqueriza%';
