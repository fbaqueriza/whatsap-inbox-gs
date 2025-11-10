# 📚 DOCUMENTACIÓN COMPLETA DE KAPSO API

## 🎯 **INTRODUCCIÓN**

Kapso es una plataforma que permite enviar y recibir mensajes de WhatsApp de manera eficiente, con almacenamiento persistente, webhooks en tiempo real, y SDK de TypeScript. Esta documentación cubre todas las APIs y funcionalidades disponibles.

---

## 📋 **ÍNDICE DE DOCUMENTACIÓN**

### **1. INTRODUCCIÓN Y CONCEPTOS BÁSICOS**
- [Introducción a WhatsApp](https://docs.kapso.ai/docs/whatsapp/introduction)
- [API Introduction](https://docs.kapso.ai/api-reference/whatsapp-introduction)
- [Meta WhatsApp Proxy](https://docs.kapso.ai/api-reference/meta-proxy)

### **2. CONFIGURACIÓN INICIAL**
- [Connect WhatsApp](https://docs.kapso.ai/docs/how-to/whatsapp/connect-whatsapp)
- [Set up webhooks](https://docs.kapso.ai/docs/how-to/whatsapp/set-up-webhooks)
- [Use Kapso Sandbox](https://docs.kapso.ai/docs/how-to/whatsapp/use-sandbox-for-testing)
- [Use Meta Proxy](https://docs.kapso.ai/docs/how-to/whatsapp/use-meta-proxy)

### **3. GESTIÓN DE CONVERSACIONES**
- [Initiate conversations](https://docs.kapso.ai/docs/how-to/whatsapp/initiate-conversations)
- [List WhatsApp conversations](https://docs.kapso.ai/api-reference/whatsapp-conversations/list-whatsapp-conversations)
- [Get WhatsApp conversation details](https://docs.kapso.ai/api-reference/whatsapp-conversations/get-whatsapp-conversation-details)
- [Update WhatsApp conversation status](https://docs.kapso.ai/api-reference/whatsapp-conversations/update-whatsapp-conversation-status)
- [List agent executions for a WhatsApp conversation](https://docs.kapso.ai/api-reference/whatsapp-conversations/list-agent-executions-for-a-whatsapp-conversation)
- [Get agent execution association details](https://docs.kapso.ai/api-reference/whatsapp-conversations/get-agent-execution-association-details)

### **4. GESTIÓN DE MENSAJES**
- [Send messages](https://docs.kapso.ai/docs/how-to/whatsapp/send-messages)
- [Send free-form message](https://docs.kapso.ai/docs/how-to/whatsapp/send-free-form-message)
- [List messages in a WhatsApp conversation](https://docs.kapso.ai/api-reference/whatsapp-messages/list-messages-in-a-whatsapp-conversation)
- [Send a new WhatsApp message](https://docs.kapso.ai/api-reference/whatsapp-messages/send-a-new-whatsapp-message)
- [Send a WhatsApp message (standalone)](https://docs.kapso.ai/api-reference/whatsapp-messages/send-a-whatsapp-message-standalone)
- [Mark WhatsApp message as read](https://docs.kapso.ai/api-reference/whatsapp-messages/mark-whatsapp-message-as-read)
- [Delete WhatsApp message](https://docs.kapso.ai/api-reference/whatsapp-messages/delete-whatsapp-message)

### **5. TEMPLATES Y BROADCASTS**
- [Sending Templates](https://docs.kapso.ai/docs/integrations/whatsapp/sending-templates)
- [WhatsApp broadcasts](https://docs.kapso.ai/docs/integrations/whatsapp/broadcasts)

### **6. HERRAMIENTAS Y SDK**
- [TypeScript SDK Introduction](https://docs.kapso.ai/docs/whatsapp/typescript-sdk/introduction)

### **7. ASIGNACIONES DE CONVERSACIONES**
- [List conversation assignments](https://docs.kapso.ai/api-reference/conversation-assignments/list-conversation-assignments)
- [Create a conversation assignment](https://docs.kapso.ai/api-reference/conversation-assignments/create-a-conversation-assignment)
- [Update a conversation assignment](https://docs.kapso.ai/api-reference/conversation-assignments/update-a-conversation-assignment)

### **8. TEMPLATES DE WHATSAPP**
- [List WhatsApp templates](https://docs.kapso.ai/api-reference/whatsapp-templates/list-whatsapp-templates)
- [Create a new WhatsApp template](https://docs.kapso.ai/api-reference/whatsapp-templates/create-a-new-whatsapp-template)
- [Get WhatsApp template details](https://docs.kapso.ai/api-reference/whatsapp-templates/get-whatsapp-template-details)
- [Delete WhatsApp template](https://docs.kapso.ai/api-reference/whatsapp-templates/delete-whatsapp-template)
- [Update WhatsApp template](https://docs.kapso.ai/api-reference/whatsapp-templates/update-whatsapp-template)
- [Send a WhatsApp template message](https://docs.kapso.ai/api-reference/whatsapp-templates/send-a-whatsapp-template-message)
- [Submit a WhatsApp template for approval](https://docs.kapso.ai/api-reference/whatsapp-templates/submit-a-whatsapp-template-for-approval)
- [Edit a WhatsApp template on Meta](https://docs.kapso.ai/api-reference/whatsapp-templates/edit-a-whatsapp-template-on-meta)
- [Sync WhatsApp templates](https://docs.kapso.ai/api-reference/whatsapp-templates/sync-whatsapp-templates)
- [Get WhatsApp template sync status](https://docs.kapso.ai/api-reference/whatsapp-templates/get-whatsapp-template-sync-status)

### **9. CONTACTOS DE WHATSAPP**
- [List WhatsApp contacts](https://docs.kapso.ai/api-reference/whatsapp-contacts/list-whatsapp-contacts)
- [Create a WhatsApp contact](https://docs.kapso.ai/api-reference/whatsapp-contacts/create-a-whatsapp-contact)
- [Get a WhatsApp contact](https://docs.kapso.ai/api-reference/whatsapp-contacts/get-a-whatsapp-contact)
- [Update a WhatsApp contact](https://docs.kapso.ai/api-reference/whatsapp-contacts/update-a-whatsapp-contact)

### **10. NOTAS DE CONTACTOS**
- [List notes for a WhatsApp contact](https://docs.kapso.ai/api-reference/whatsapp-contact-notes/list-notes-for-a-whatsapp-contact)
- [Create a note for a WhatsApp contact](https://docs.kapso.ai/api-reference/whatsapp-contact-notes/create-a-note-for-a-whatsapp-contact)
- [Get a specific note](https://docs.kapso.ai/api-reference/whatsapp-contact-notes/get-a-specific-note)
- [Delete a note](https://docs.kapso.ai/api-reference/whatsapp-contact-notes/delete-a-note)
- [Update a note](https://docs.kapso.ai/api-reference/whatsapp-contact-notes/update-a-note)

### **11. CONFIGURACIONES DE WHATSAPP**
- [List WhatsApp configs](https://docs.kapso.ai/api-reference/whatsapp-configs/list-whatsapp-configs)
- [Get WhatsApp config details](https://docs.kapso.ai/api-reference/whatsapp-configs/get-whatsapp-config-details)
- [Delete WhatsApp config](https://docs.kapso.ai/api-reference/whatsapp-configs/delete-whatsapp-config)
- [Update WhatsApp config](https://docs.kapso.ai/api-reference/whatsapp-configs/update-whatsapp-config)
- [Get WhatsApp config health status](https://docs.kapso.ai/api-reference/whatsapp-configs/get-whatsapp-config-health-status)

### **12. LLAMADAS DE WHATSAPP**
- [List WhatsApp calls](https://docs.kapso.ai/api-reference/whatsapp-calls/list-whatsapp-calls)
- [Get WhatsApp call details](https://docs.kapso.ai/api-reference/whatsapp-calls/get-whatsapp-call-details)

### **13. PERMISOS DE LLAMADAS**
- [List call permissions for a WhatsApp contact](https://docs.kapso.ai/api-reference/whatsapp-contact-call-permissions/list-call-permissions-for-a-whatsapp-contact)
- [Get specific call permission](https://docs.kapso.ai/api-reference/whatsapp-contact-call-permissions/get-specific-call-permission)

---

## 🔧 **IMPLEMENTACIÓN CORRECTA**

### **1. AUTENTICACIÓN**
```javascript
const headers = {
  'X-API-Key': process.env.KAPSO_API_KEY,
  'Content-Type': 'application/json'
};
```

### **2. ENDPOINTS PRINCIPALES**

#### **Conversaciones**
- `GET /whatsapp_conversations` - Listar conversaciones
- `GET /whatsapp_conversations/{id}` - Detalles de conversación
- `PATCH /whatsapp_conversations/{id}` - Actualizar estado

#### **Mensajes**
- `GET /whatsapp_conversations/{id}/messages` - Listar mensajes
- `POST /whatsapp_conversations/{id}/messages` - Enviar mensaje
- `POST /whatsapp_messages` - Enviar mensaje standalone
- `PATCH /whatsapp_messages/{id}/read` - Marcar como leído
- `DELETE /whatsapp_messages/{id}` - Eliminar mensaje

### **3. WEBHOOKS**
Kapso envía webhooks para eventos en tiempo real:
- `whatsapp.message.received` - Mensaje recibido
- `whatsapp.message.sent` - Mensaje enviado
- `whatsapp.conversation.created` - Conversación creada
- `whatsapp.conversation.ended` - Conversación terminada
- `whatsapp.message.delivered` - Mensaje entregado
- `whatsapp.message.read` - Mensaje leído
- `whatsapp.message.failed` - Mensaje fallido

### **4. TIPOS DE MENSAJES SOPORTADOS**
- Texto
- Media (imagen, video, audio, documento, sticker)
- Ubicación
- Interactivos (botones, listas, productos)
- Templates
- Reacciones y confirmaciones de lectura

---

## 🚀 **VENTAJAS DE KAPSO**

- **Almacenamiento persistente** para conversaciones y mensajes
- **Sincronización opcional con Supabase** para analytics propios
- **SDK de TypeScript** con tipos, manejo de camel/snake case, y builders incluidos
- **Webhooks con verificación HMAC** para seguridad
- **Inbox y búsqueda** para debugging rápido
- **Onboarding multi-tenant** y provisión opcional de números US
- **Proxy de Meta** para habilitar almacenamiento, webhooks y analytics

---

## 📝 **NOTAS IMPORTANTES**

1. **No necesitas Supabase** para almacenar mensajes - Kapso maneja todo
2. **Los webhooks son la clave** para tiempo real
3. **Usa el SDK de TypeScript** para mejor experiencia de desarrollo
4. **Configura webhooks correctamente** para recibir eventos
5. **Maneja errores y reintentos** apropiadamente

---

*Documentación generada el: $(date)*
*Última actualización: $(date)*
