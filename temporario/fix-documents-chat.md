# Solución Temporal: Documentos en Chat

## Problema
- ✅ Los documentos se reciben y se guardan en la carpeta del proveedor
- ❌ NO aparecen en el chat porque no se guardan como mensajes en `whatsapp_messages`
- ❌ El webhook no está funcionando correctamente

## Solución Temporal
Crear un endpoint que sincronice los documentos existentes con el chat, creando mensajes en `whatsapp_messages` para los documentos que ya están en la carpeta del proveedor.

## Implementación
1. Crear endpoint `/api/whatsapp/sync-documents-to-chat`
2. Buscar documentos en la carpeta del proveedor que no tengan mensaje correspondiente
3. Crear mensajes en `whatsapp_messages` para estos documentos
4. Esto permitirá que los documentos aparezcan en el chat

## Uso
- Llamar al endpoint después de enviar un documento
- O crear un botón "Sincronizar documentos" en la interfaz
- O ejecutar automáticamente cuando se detecte un nuevo documento

## Próximos Pasos
1. Implementar el endpoint de sincronización
2. Probar con documentos existentes
3. Configurar el webhook correctamente para futuros documentos
