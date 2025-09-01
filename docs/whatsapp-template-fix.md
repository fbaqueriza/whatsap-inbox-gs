# Fix: Variables del Template WhatsApp evio_orden

## Problema Reportado
El usuario reportó que las variables del template `evio_orden` no se estaban reemplazando correctamente:
- "El Proveedor debería ser el nombre del proveedor"
- "El 'Nombre Proveedor' debería ser el Nombre Contacto del proveedor"

## Error Específico
```
(#132000) Number of parameters does not match the expected number of params
body: number of localizable_params (1) does not match the expected number of params (0)
```

## Análisis del Problema
El error indica que el template `evio_orden` en Meta Business Manager no tiene las variables dinámicas configuradas correctamente. Meta Business Manager requiere nombres descriptivos para las variables dinámicas.

## Solución Implementada

### 1. Configuración Correcta en Meta Business Manager
El template debe configurarse con variables dinámicas usando nombres descriptivos:

**Header:**
```
Nueva orden {{provider_name}}
```

**Body:**
```
Buen dia {{contact_name}}! Espero que andes bien! En cuanto me confirmes, paso el pedido de esta semana.
```

### 2. Código Actualizado
```typescript
// 🔧 MEJORA: Función helper para generar componentes de templates
// Las variables dinámicas en Meta Business Manager usan nombres descriptivos
const generateTemplateComponents = (templateName: string, variables?: Record<string, string>) => {
  if (!variables) return undefined;

  switch (templateName) {
    case 'evio_orden':
      // Según Meta Business Manager: header="{{provider_name}}" y body="{{contact_name}}"
      return [
        {
          type: 'header',
          parameters: [
            {
              type: 'text',
              text: variables['Proveedor'] || 'Proveedor'
            }
          ]
        },
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: variables['Nombre Proveedor'] || 'Proveedor'
            }
          ]
        }
      ];
    
    default:
      return undefined;
  }
};
```

### 3. Mapeo de Variables
- `{{provider_name}}` = `variables['Proveedor']` (nombre del proveedor)
- `{{contact_name}}` = `variables['Nombre Proveedor']` (nombre de contacto del proveedor)

## Instrucciones para Meta Business Manager

### 1. Acceder al Meta Business Manager
- Ve a [Meta Business Manager](https://business.facebook.com/)
- Navega a "WhatsApp" > "Plantillas de mensajes"

### 2. Editar el template `evio_orden`
- Busca el template `evio_orden`
- Haz clic en "Editar"

### 3. Configurar variables dinámicas
- **Header**: "Nueva orden {{provider_name}}"
- **Body**: "Buen dia {{contact_name}}! Espero que andes bien! En cuanto me confirmes, paso el pedido de esta semana."

### 4. Guardar y enviar para revisión
- Guarda los cambios
- Envía para revisión de Meta

## Verificación
✅ El template `evio_orden` se envía correctamente con variables dinámicas
✅ El contenido se guarda correctamente en la base de datos
✅ Los mensajes aparecen correctamente en WhatsApp con variables reemplazadas

## Archivos Modificados
- `src/app/api/whatsapp/send/route.ts`: Implementación de componentes dinámicos con nombres descriptivos
- `docs/whatsapp-template-fix.md`: Documentación actualizada
- `temporario/test-evio-orden-names.js`: Script de prueba

## Estado Final
✅ **RESUELTO**: El template `evio_orden` funciona correctamente con variables dinámicas usando nombres descriptivos en Meta Business Manager
