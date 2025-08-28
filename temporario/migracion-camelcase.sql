-- Migración de snake_case a camelCase
-- Ejecutar en Supabase SQL Editor

-- Tabla orders
ALTER TABLE orders RENAME COLUMN provider_id TO providerId;
ALTER TABLE orders RENAME COLUMN total_amount TO totalAmount;
ALTER TABLE orders RENAME COLUMN order_date TO orderDate;
ALTER TABLE orders RENAME COLUMN due_date TO dueDate;
ALTER TABLE orders RENAME COLUMN invoice_number TO invoiceNumber;
ALTER TABLE orders RENAME COLUMN bank_info TO bankInfo;
ALTER TABLE orders RENAME COLUMN receipt_url TO receiptUrl;
ALTER TABLE orders RENAME COLUMN desired_delivery_date TO desiredDeliveryDate;
ALTER TABLE orders RENAME COLUMN payment_method TO paymentMethod;
ALTER TABLE orders RENAME COLUMN additional_files TO additionalFiles;
ALTER TABLE orders RENAME COLUMN created_at TO createdAt;
ALTER TABLE orders RENAME COLUMN updated_at TO updatedAt;
ALTER TABLE orders RENAME COLUMN user_id TO userId;

-- Tabla providers
ALTER TABLE providers RENAME COLUMN contact_name TO contactName;
ALTER TABLE providers RENAME COLUMN razon_social TO razonSocial;
ALTER TABLE providers RENAME COLUMN cuit_cuil TO cuitCuil;
ALTER TABLE providers RENAME COLUMN default_delivery_days TO defaultDeliveryDays;
ALTER TABLE providers RENAME COLUMN default_delivery_time TO defaultDeliveryTime;
ALTER TABLE providers RENAME COLUMN default_payment_method TO defaultPaymentMethod;
ALTER TABLE providers RENAME COLUMN created_at TO createdAt;
ALTER TABLE providers RENAME COLUMN updated_at TO updatedAt;
ALTER TABLE providers RENAME COLUMN user_id TO userId;

-- Tabla stock
ALTER TABLE stock RENAME COLUMN product_name TO productName;
ALTER TABLE stock RENAME COLUMN restock_frequency TO restockFrequency;
ALTER TABLE stock RENAME COLUMN associated_providers TO associatedProviders;
ALTER TABLE stock RENAME COLUMN preferred_provider TO preferredProvider;
ALTER TABLE stock RENAME COLUMN last_restock_date TO lastRestockDate;
ALTER TABLE stock RENAME COLUMN next_order TO nextOrder;
ALTER TABLE stock RENAME COLUMN created_at TO createdAt;
ALTER TABLE stock RENAME COLUMN updated_at TO updatedAt;
ALTER TABLE stock RENAME COLUMN user_id TO userId;

-- Tabla catalogs
ALTER TABLE catalogs RENAME COLUMN provider_id TO providerId;
ALTER TABLE catalogs RENAME COLUMN file_url TO fileUrl;
ALTER TABLE catalogs RENAME COLUMN file_name TO fileName;
ALTER TABLE catalogs RENAME COLUMN file_size TO fileSize;
ALTER TABLE catalogs RENAME COLUMN uploaded_at TO uploadedAt;
ALTER TABLE catalogs RENAME COLUMN created_at TO createdAt;
ALTER TABLE catalogs RENAME COLUMN updated_at TO updatedAt;

-- Tabla order_items
ALTER TABLE order_items RENAME COLUMN order_id TO orderId;
ALTER TABLE order_items RENAME COLUMN product_name TO productName;
ALTER TABLE order_items RENAME COLUMN created_at TO createdAt;
ALTER TABLE order_items RENAME COLUMN updated_at TO updatedAt;

-- Tabla order_files
ALTER TABLE order_files RENAME COLUMN order_id TO orderId;
ALTER TABLE order_files RENAME COLUMN file_url TO fileUrl;
ALTER TABLE order_files RENAME COLUMN file_name TO fileName;
ALTER TABLE order_files RENAME COLUMN file_size TO fileSize;
ALTER TABLE order_files RENAME COLUMN uploaded_at TO uploadedAt;
ALTER TABLE order_files RENAME COLUMN created_at TO createdAt;
ALTER TABLE order_files RENAME COLUMN updated_at TO updatedAt;

-- Tabla users
ALTER TABLE users RENAME COLUMN created_at TO createdAt;
ALTER TABLE users RENAME COLUMN updated_at TO updatedAt;

-- Verificar que los cambios se aplicaron correctamente
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('orders', 'providers', 'stock', 'catalogs', 'order_items', 'order_files', 'users')
ORDER BY table_name, column_name;
