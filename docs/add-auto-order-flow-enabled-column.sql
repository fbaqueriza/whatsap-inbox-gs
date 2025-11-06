-- Agregar columna auto_order_flow_enabled a la tabla providers
-- Este campo controla si el flujo automático de órdenes está habilitado para cada proveedor

-- Verificar si la columna ya existe antes de agregarla
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'providers' 
        AND column_name = 'auto_order_flow_enabled'
    ) THEN
        -- Agregar la columna con valor por defecto true
        ALTER TABLE providers 
        ADD COLUMN auto_order_flow_enabled BOOLEAN DEFAULT true NOT NULL;
        
        -- Agregar comentario a la columna
        COMMENT ON COLUMN providers.auto_order_flow_enabled IS 
        'Indica si el flujo automático de órdenes está habilitado para este proveedor. Si es true, el sistema procesará automáticamente los mensajes del proveedor para avanzar el estado de las órdenes.';
        
        RAISE NOTICE 'Columna auto_order_flow_enabled agregada exitosamente';
    ELSE
        RAISE NOTICE 'La columna auto_order_flow_enabled ya existe';
    END IF;
END $$;

