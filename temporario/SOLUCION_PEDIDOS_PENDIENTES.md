# Solución para Pedidos Pendientes de Confirmación

## Problema Identificado

1. **Pedidos de otros usuarios visibles**: Los pedidos pendientes se muestran a todos los usuarios sin filtrado por `user_id`
2. **Flujo manual**: Los usuarios pueden enviar detalles manualmente con un botón, cuando debería ser automático
3. **Falta de campo `user_id`**: La tabla `pending_orders` no tiene el campo `user_id` para filtrar por usuario

## Solución Implementada

### 1. Cambios Temporales (Sin `user_id`)

**Archivos modificados:**
- `src/app/api/whatsapp/save-pending-order/route.ts` - Removido `userId` temporalmente
- `src/app/api/whatsapp/get-all-pending-orders/route.ts` - Removido filtro por `userId`
- `src/components/PendingOrderList.tsx` - Removido parámetro `userId` y botón manual
- `src/lib/orderNotificationService.ts` - Removido `userId` del payload
- `src/app/orders/page.tsx` - Removido `userId` del componente

### 2. Script SQL para Agregar `user_id`

**Archivo:** `add_user_id_to_pending_orders.sql`

```sql
-- Agregar el campo user_id a la tabla pending_orders
ALTER TABLE pending_orders 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Crear índice para mejorar rendimiento
CREATE INDEX idx_pending_orders_user_id ON pending_orders(user_id);

-- Agregar comentario
COMMENT ON COLUMN pending_orders.user_id IS 'ID del usuario que creó el pedido pendiente';
```

### 3. Pasos para Implementar la Solución Completa

#### Paso 1: Ejecutar el Script SQL
1. Ir a Supabase Dashboard
2. Abrir SQL Editor
3. Ejecutar el contenido de `add_user_id_to_pending_orders.sql`

#### Paso 2: Actualizar el Código (Después de ejecutar SQL)

**1. Actualizar `src/app/api/whatsapp/save-pending-order/route.ts`:**
```typescript
const { orderId, providerId, providerPhone, orderData, userId } = await request.json();

// Agregar validación
if (!orderId || !providerId || !providerPhone || !orderData || !userId) {
  return NextResponse.json(
    { success: false, error: 'Datos incompletos' },
    { status: 400 }
  );
}

// En el insert agregar user_id
.insert({
  order_id: orderId,
  provider_id: providerId,
  provider_phone: providerPhone,
  user_id: userId, // AGREGAR ESTA LÍNEA
  order_data: orderData,
  status: 'pending_confirmation',
  created_at: new Date().toISOString()
})
```

**2. Actualizar `src/app/api/whatsapp/get-all-pending-orders/route.ts`:**
```typescript
export async function GET(request: NextRequest) {
  try {
    // Obtener el user_id del query parameter
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId requerido' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('status', 'pending_confirmation')
      .eq('user_id', userId) // AGREGAR ESTE FILTRO
      .order('created_at', { ascending: false });
```

**3. Actualizar `src/lib/orderNotificationService.ts`:**
```typescript
body: JSON.stringify({
  orderId: order.id,
  providerId: provider.id,
  providerPhone: provider.phone,
  userId: order.user_id, // AGREGAR ESTA LÍNEA
  orderData: {
    order,
    provider,
    items
  }
}),
```

**4. Actualizar `src/components/PendingOrderList.tsx`:**
```typescript
interface PendingOrderListProps {
  userId: string;
}

export default function PendingOrderList({ userId }: PendingOrderListProps) {
  // ... resto del código ...
  
  const loadPendingOrders = async () => {
    try {
      const response = await fetch(`/api/whatsapp/get-all-pending-orders?userId=${userId}`, {
        // ... resto del código ...
      });
    }
  };
}
```

**5. Actualizar `src/app/orders/page.tsx`:**
```typescript
{/* Pedidos Pendientes de Confirmación */}
<PendingOrderList userId={user.id} />
```

### 4. Beneficios de la Solución

✅ **Filtrado por usuario**: Cada usuario solo ve sus propios pedidos pendientes
✅ **Flujo automático**: Los detalles se envían automáticamente cuando el proveedor responde
✅ **Sin botón manual**: Eliminado el botón de envío manual de detalles
✅ **Mejor seguridad**: Validación de permisos por usuario
✅ **Rendimiento optimizado**: Índice en `user_id` para consultas rápidas

### 5. Verificación

Después de implementar:
1. Crear un pedido como Usuario A
2. Verificar que solo Usuario A ve el pedido pendiente
3. Verificar que Usuario B no ve el pedido de Usuario A
4. Verificar que el flujo automático funciona cuando el proveedor responde

## Nota Importante

**NO hacer commit hasta que se ejecute el script SQL y se actualice el código con el filtrado por `user_id`**. Los cambios actuales son temporales para que el sistema funcione mientras se implementa la solución completa.
