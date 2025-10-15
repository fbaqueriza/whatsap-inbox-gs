# Sistema de Perfil de Usuario

## Descripción
Sistema completo para que los usuarios de la plataforma puedan personalizar su perfil con:
- 📸 Foto de perfil
- 👤 Nombre de visualización
- 💬 Mensaje de estado
- 🎨 Emoji de estado

## Archivos Creados

### 1. Base de Datos
- **`scripts/migrate-user-profile.sql`**: Migración para agregar campos de perfil a la tabla `users`

### 2. API Endpoints
- **`src/app/api/user/profile/route.ts`**: 
  - `GET`: Obtener perfil del usuario
  - `PUT`: Actualizar perfil (nombre, estado, emoji)
- **`src/app/api/user/profile-picture/route.ts`**:
  - `POST`: Subir foto de perfil
  - `DELETE`: Eliminar foto de perfil

### 3. Componentes UI
- **`src/components/UserProfile.tsx`**: Componente para mostrar perfil en header/navegación
- **`src/components/UserProfileEditor.tsx`**: Modal para editar perfil completo

### 4. Hook Personalizado
- **`src/hooks/useUserProfile.ts`**: Hook para manejar operaciones de perfil

### 5. Integración
- **`src/components/Navigation.tsx`**: Actualizado para usar UserProfile

## Campos de Base de Datos

```sql
ALTER TABLE users 
ADD COLUMN display_name TEXT,
ADD COLUMN profile_picture_url TEXT,
ADD COLUMN status_message TEXT,
ADD COLUMN status_emoji TEXT,
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

## Uso

### 1. Ejecutar Migración
```sql
-- Ejecutar en Supabase SQL Editor
\i scripts/migrate-user-profile.sql
```

### 2. Usar el Hook
```typescript
import { useUserProfile } from '@/hooks/useUserProfile';

function MyComponent() {
  const { profile, loading, updateProfile, uploadProfilePicture } = useUserProfile();
  
  // Usar profile, loading, etc.
}
```

### 3. Usar el Componente
```tsx
import UserProfile from '@/components/UserProfile';

// En header/navegación
<UserProfile showStatus={true} showEmail={false} />

// En modal de edición
<UserProfileEditor onClose={() => setShow(false)} />
```

## Características

### ✅ Validaciones
- **Foto**: Solo JPEG, PNG, WebP (máximo 5MB)
- **Nombre**: Máximo 100 caracteres
- **Estado**: Máximo 200 caracteres
- **Emoji**: Máximo 10 caracteres

### ✅ Emojis Predefinidos
- 🟢 Disponible
- 🔴 Ocupado
- 🟡 Ausente
- 🔵 En reunión
- ⚪ Sin estado
- 🟣 Personalizado
- 🟠 En descanso
- ⚫ No molestar

### ✅ Storage
- Fotos se guardan en Supabase Storage
- Ruta: `profile-pictures/{user_id}_{timestamp}.{ext}`
- Eliminación automática al cambiar/eliminar foto

### ✅ Seguridad
- Autenticación requerida en todos los endpoints
- Validación de tipos de archivo
- Límites de tamaño
- RLS (Row Level Security) respetado

## Flujo de Usuario

1. **Ver Perfil**: El usuario ve su perfil en el header de navegación
2. **Editar**: Click en el perfil abre el modal de edición
3. **Cambiar Foto**: Upload de nueva imagen con preview
4. **Actualizar Info**: Cambiar nombre, estado, emoji
5. **Guardar**: Cambios se aplican inmediatamente
6. **Ver Cambios**: Perfil actualizado en toda la plataforma

## API Reference

### GET /api/user/profile
```typescript
Response: {
  success: boolean;
  profile: {
    id: string;
    email: string;
    displayName?: string;
    profilePictureUrl?: string;
    statusMessage?: string;
    statusEmoji?: string;
    createdAt: string;
    updatedAt?: string;
  }
}
```

### PUT /api/user/profile
```typescript
Body: {
  displayName?: string;
  statusMessage?: string;
  statusEmoji?: string;
}
```

### POST /api/user/profile-picture
```typescript
Body: FormData with 'file' field
Response: {
  success: boolean;
  profilePictureUrl: string;
}
```

### DELETE /api/user/profile-picture
```typescript
Response: {
  success: boolean;
  message: string;
}
```

## Próximos Pasos

1. **Ejecutar migración** en Supabase
2. **Probar funcionalidad** en desarrollo
3. **Personalizar emojis** según necesidades
4. **Agregar validaciones** adicionales si es necesario
5. **Implementar notificaciones** de cambios de estado

## Notas Técnicas

- **Storage**: Usa Supabase Storage con bucket 'public'
- **Autenticación**: Usa tokens de sesión de Supabase Auth
- **Validación**: Tanto en frontend como backend
- **Responsive**: Funciona en desktop y móvil
- **Accesibilidad**: Incluye labels y títulos apropiados
