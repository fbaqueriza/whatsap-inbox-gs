-- ========================================
-- LIMPIEZA DE TABLAS REDUNDANTES DE KAPSO
-- ========================================
-- Este script elimina solo las tablas redundantes de Kapso
-- Mantiene intactas todas las tablas importantes del sistema

-- 1. Eliminar tablas redundantes de Kapso
DROP TABLE IF EXISTS kapso_messages CASCADE;
DROP TABLE IF EXISTS kapso_conversations CASCADE;
DROP TABLE IF EXISTS kapso_contacts CASCADE;

-- 2. Eliminar funciones relacionadas con sincronización de Kapso (si existen)
DROP FUNCTION IF EXISTS sync_kapso_data CASCADE;

-- 3. Verificar que las tablas importantes siguen existiendo
-- (Estas consultas fallarán si las tablas no existen, lo cual es bueno para verificar)

-- Verificar whatsapp_messages (chat actual)
SELECT 'whatsapp_messages' as tabla, COUNT(*) as registros FROM whatsapp_messages;

-- Verificar documents (facturas y OCR)
SELECT 'documents' as tabla, COUNT(*) as registros FROM documents;

-- Verificar orders (flujo de órdenes)
SELECT 'orders' as tabla, COUNT(*) as registros FROM orders;

-- Verificar providers (proveedores)
SELECT 'providers' as tabla, COUNT(*) as registros FROM providers;

-- 4. Mostrar resumen
SELECT 
  'Limpieza completada' as estado,
  'Tablas redundantes eliminadas: kapso_messages, kapso_conversations, kapso_contacts' as eliminadas,
  'Tablas importantes mantenidas: whatsapp_messages, documents, orders, providers' as mantenidas;
