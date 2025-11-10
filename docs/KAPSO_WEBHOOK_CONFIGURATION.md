# Configuración del Webhook de Kapso

## Variables de Entorno Requeridas

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```bash
# Configuración de Kapso
KAPSO_API_KEY=your_kapso_api_key_here
KAPSO_WEBHOOK_SECRET=2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb

# Configuración de WhatsApp
WHATSAPP_VERIFY_TOKEN=your_whatsapp_verify_token_here
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here

# Configuración de Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Configuración de la aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

## Configuración del Webhook en Kapso

1. **URL del Webhook**: `https://tu-dominio.com/api/kapso/supabase-events`
2. **Método**: POST
3. **Secreto**: `2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb`
4. **Eventos a suscribir**:
   - Mensajes de WhatsApp
   - Documentos
   - Estados de mensajes

## Configuración del Número de Sandbox

Para usar el número de sandbox de Kapso:

1. Configura el webhook con la URL correcta
2. Usa el secreto proporcionado
3. Asegúrate de que el webhook esté configurado para recibir documentos

## Verificación del Webhook

El webhook valida automáticamente:
- La firma del webhook usando el secreto
- La estructura del mensaje
- La duplicación de mensajes

## Logs de Debugging

El webhook incluye logs detallados para debugging:
- `📥 [requestId] ===== KAPSO SUPABASE EVENT RECIBIDO =====`
- `📱 [requestId] Procesando webhook de WhatsApp desde Kapso`
- `📨 [requestId] Procesando X mensajes reales`
- `🔍 [requestId] Mensaje tipo: document, tiene documento: true`

## Solución de Problemas

### Documentos no se reciben
1. Verifica que el webhook esté configurado correctamente en Kapso
2. Revisa los logs para ver si llegan los webhooks
3. Verifica que el secreto sea correcto
4. Asegúrate de que el número de sandbox esté configurado

### Mensajes no aparecen en tiempo real
1. Verifica la conexión a Supabase
2. Revisa los logs de broadcast
3. Verifica que el frontend esté escuchando el canal correcto

## Estructura del Webhook

El webhook espera recibir mensajes en formato de WhatsApp Business API:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "1123051623072203",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "5491141780300",
              "phone_number_id": "670680919470999"
            },
            "messages": [
              {
                "from": "5491135562673",
                "id": "wamid.xxx",
                "timestamp": "1761142289",
                "type": "document",
                "document": {
                  "filename": "factura.pdf",
                  "mime_type": "application/pdf",
                  "sha256": "xxx",
                  "id": "xxx",
                  "url": "https://..."
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```
