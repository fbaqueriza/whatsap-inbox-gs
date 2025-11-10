-- Migración para agregar campos de perfil de usuario
-- Ejecutar en Supabase SQL Editor

-- Agregar campos de perfil a la tabla users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
ADD COLUMN IF NOT EXISTS status_message TEXT,
ADD COLUMN IF NOT EXISTS status_emoji TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Crear índice para búsquedas por display_name
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name);

-- Comentarios para documentar los campos
COMMENT ON COLUMN users.display_name IS 'Nombre de visualización del usuario en la plataforma';
COMMENT ON COLUMN users.profile_picture_url IS 'URL de la foto de perfil del usuario';
COMMENT ON COLUMN users.status_message IS 'Mensaje de estado del usuario (ej: "Disponible para pedidos")';
COMMENT ON COLUMN users.status_emoji IS 'Emoji de estado del usuario (ej: "🟢", "🔴", "🟡")';
COMMENT ON COLUMN users.updated_at IS 'Timestamp de última actualización del perfil';
