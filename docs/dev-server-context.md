# 🔧 Contexto del Servidor de Desarrollo

Este documento mantiene el contexto de los servidores de desarrollo y sus logs clave.

## 📊 Servidores Activos

### Puerto 3001 - Servidor Principal (Next.js)
- **Ubicación**: Raíz del proyecto (`gastronomy-saas`)
- **Comando**: `npm run dev`
- **Propósito**: API principal, autenticación, configuración de WhatsApp

### Puerto 4000 - Servidor del Inbox (Submodule)
- **Ubicación**: `temp/whatsapp-cloud-inbox`
- **Comando**: `npm run dev`
- **Propósito**: Interfaz del inbox de WhatsApp (iframe)

## 🔍 Logs Clave para Monitorear

### 1. `[Config Bypass]` - Servidor Principal (Puerto 3001)

**Endpoint**: `/api/whatsapp/config-bypass`

**Flujo**:
1. 🔄 Obteniendo configuración WhatsApp...
2. 🔍 Usuario autenticado: {userId}
3. ✅ Configuración encontrada: {config}
4. 🔍 phone_number_id en BD: {value | NO ENCONTRADO}
5. 🔍 Obteniendo phone_number_id de Kapso usando kapso_config_id: {id}
6. 📡 Respuesta de Kapso: {response}
7. ✅ phone_number_id obtenido de Kapso: {value | NO ENCONTRADO}
8. 💾 phone_number_id guardado en BD (si se obtuvo exitosamente)
9. ❌ Errores si algo falla

**Problemas Comunes**:
- `phone_number_id` es `NULL` en BD y la llamada a Kapso falla
- `kapso_config_id` no está presente
- La respuesta de Kapso no contiene `phone_number_id`

### 2. `[Conversations-{requestId}]` - Servidor del Inbox (Puerto 4000)

**Endpoint**: `/api/conversations`

**Flujo**:
1. 🔄 Iniciando request...
2. 🔍 Token obtenido: {Sí | No} (header: {bool}, url: {bool})
3. 🔍 Obteniendo phone_number_id de config-bypass...
4. 📡 Respuesta de config-bypass: {status} {statusText}
5. ✅ phone_number_id obtenido: {Sí | No}
6. 📋 Obteniendo conversaciones de Kapso con phoneNumberId: {id}
7. ✅ Conversaciones obtenidas: {count}
8. ❌ Errores (401, 404, 500, 504)

**Problemas Comunes**:
- 401: Token de autenticación faltante o inválido
- 404: `phone_number_id` no disponible
- 500: Error en servidor principal
- 504: Timeout conectándose con servidor principal

## 🔄 Flujo Completo

```
Cliente (Navegador)
    ↓
Kapso Inbox (localhost:4000)
    ↓ GET /api/conversations?authToken=...
    ↓
Servidor Inbox (Puerto 4000)
    ↓ GET http://localhost:3001/api/whatsapp/config-bypass
    ↓ Authorization: Bearer {token}
    ↓
Servidor Principal (Puerto 3001)
    ↓
    1. Autenticar usuario
    2. Buscar config en BD (user_whatsapp_config)
    3. Si phone_number_id es NULL:
       - Llamar a Kapso API: GET /whatsapp_configs/{kapso_config_id}
       - Extraer phone_number_id
       - Guardar en BD
    4. Devolver phone_number_id
    ↓
Servidor Inbox
    ↓ Usar phone_number_id para llamar a Kapso
    ↓ GET https://api.kapso.ai/meta/whatsapp/conversations?phoneNumberId=...
    ↓
Devolver conversaciones al cliente
```

## ⚠️ Problemas a Diagnosticar

1. **phone_number_id es NULL en BD**
   - Verificar si `kapso_config_id` está presente
   - Verificar si la llamada a Kapso API funciona
   - Verificar si la respuesta de Kapso contiene `phone_number_id`

2. **404 desde config-bypass**
   - Usuario no autenticado
   - Sin configuración activa
   - `phone_number_id` no disponible en BD ni en Kapso

3. **504 Gateway Timeout**
   - Servidor principal no responde
   - Timeout en la llamada a config-bypass (15 segundos)

4. **Conversaciones no cargan**
   - Verificar logs de `[Conversations-{id}]`
   - Verificar logs de `[Config Bypass]`
   - Verificar que `phone_number_id` se está obteniendo correctamente

## 📝 Comandos Útiles

```powershell
# Verificar que los servidores están activos
Test-NetConnection localhost -Port 3001
Test-NetConnection localhost -Port 4000

# Ver procesos Node.js
Get-Process -Name node | Select-Object Id, ProcessName, WorkingSet
```

## 🔧 Mantener Contexto

Cuando el usuario mencione `@Cursor (Dev Server)`, debo:
1. Mantener en mente que los servidores están corriendo
2. Revisar automáticamente los logs relevantes al diagnosticar problemas
3. Verificar el flujo completo: Cliente → Inbox → Principal → Kapso
4. Buscar patrones de errores en los logs mencionados arriba
