# Configuración de Templates para bimbinilo.ba@gmail.com

## 📋 Situación Actual

Los templates `inicializador_de_conv` y `evio_orden` están aprobados para el usuario baqufra@gmail.com pero no para bimbinilo.ba@gmail.com.

## 🔍 Problema Detectado

La API de Kapso devuelve el error:
```
"Configs must share a WhatsApp Business Account"
```

Esto indica que el Business Account ID de bimbinilo (`1111665601092656`) no está correctamente asociado en el sistema de Kapso, o que los templates deben crearse directamente desde Meta Business Manager.

## ✅ Solución Recomendada: Crear Templates Manualmente

### Opción 1: Meta Business Manager (Más Simple)

1. **Acceder a Meta Business Manager**
   - Ir a: https://business.facebook.com/
   - Navegar a **WhatsApp** > **Plantillas de mensajes**

2. **Crear Template: inicializador_de_conv**
   - Nombre: `inicializador_de_conv`
   - Idioma: Español (es)
   - Categoría: UTILITY
   - Cuerpo:
     ```
     👋 ¡Hola! Iniciando conversación para coordinar pedidos.
     
     Este es un mensaje automático para reiniciar nuestra conversación. A partir de ahora puedes enviarme mensajes libremente para coordinar pedidos y consultas.
     
     ¡Gracias por tu colaboración!
     ```

3. **Crear Template: evio_orden**
   - Nombre: `evio_orden`
   - Idioma: Español (es)
   - Categoría: UTILITY
   - Header (Texto): `Nueva orden {{1}}`
   - Cuerpo:
     ```
     Buen día {{1}}! En cuanto me confirmes, paso el pedido de esta semana.
     ```
   - Nota: Las variables `{{1}}` se reemplazarán con `provider_name` y `contact_name` respectivamente

4. **Enviar para Aprobación**
   - Meta revisará y aprobará los templates (puede tardar algunas horas)

### Opción 2: Usar Endpoint API (Requiere Access Token)

He creado un endpoint API que puedes usar:

1. **Obtener Access Token de Meta**
   - Ir a https://business.facebook.com/
   - WhatsApp > Configuración > API
   - O desde Meta Developer Console
   - Copiar el access token permanente

2. **Llamar al Endpoint**
   ```bash
   curl -X POST http://localhost:3001/api/whatsapp/create-templates-meta \
     -H "Authorization: Bearer TU_TOKEN_DE_SESION" \
     -H "Content-Type: application/json" \
     -d '{
       "access_token": "TU_ACCESS_TOKEN_DE_META",
       "business_account_id": "1111665601092656"
     }'
   ```

   O desde el frontend:
   ```typescript
   const response = await fetch('/api/whatsapp/create-templates-meta', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${session.access_token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       access_token: 'TU_ACCESS_TOKEN_DE_META',
       business_account_id: '1111665601092656'
     })
   });
   ```

## 📊 Información de la Configuración

- **Usuario**: bimbinilo.ba@gmail.com
- **User ID**: 7a7d5cc0-7896-4a84-a90d-5b4bf7c27f53
- **Config ID**: 18cbbde7-9eb8-47b4-9471-3e976361d022
- **Kapso Config ID**: b8332213-d827-4f13-bc32-3d77255c713a
- **Business Account ID**: 1111665601092656
- **Phone Number ID**: 881388505052950
- **Estado**: ✅ Activa (is_active: true)

## 🔄 Sincronización con Kapso

Una vez que los templates estén aprobados en Meta, Kapso debería sincronizarlos automáticamente. Si no, puedes:

1. Verificar en Kapso que los templates aparezcan en la lista
2. Verificar que estén asociados a la configuración correcta
3. Si es necesario, contactar soporte de Kapso para asociar manualmente

## ✅ Verificación

Después de crear los templates, verificar que:
1. Aparecen en Meta Business Manager como "Aprobados"
2. Aparecen en la lista de templates de Kapso
3. Están asociados a la configuración de bimbinilo (kapso_config_id: b8332213-d827-4f13-bc32-3d77255c713a)

