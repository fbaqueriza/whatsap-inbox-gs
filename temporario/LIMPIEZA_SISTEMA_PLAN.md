# 🧹 PLAN DE LIMPIEZA Y OPTIMIZACIÓN DEL SISTEMA

## 📊 ESTADO ACTUAL

### Archivos Temporarios: 88 archivos
- **Scripts PowerShell:** 25 archivos
- **Documentos Markdown:** 37 archivos  
- **Archivos SQL:** 20 archivos
- **Otros:** 6 archivos

### Problemas Identificados
1. **Archivos temporarios excesivos** (88 archivos)
2. **Endpoints de prueba duplicados** en `/api`
3. **Estructura desordenada** en componentes
4. **Código redundante** en hooks y servicios

## 🎯 PLAN DE ACCIÓN

### FASE 1: LIMPIEZA DE ARCHIVOS TEMPORARIOS
- [ ] Conservar solo archivos esenciales (máximo 10)
- [ ] Eliminar scripts de prueba obsoletos
- [ ] Consolidar documentación en archivos principales

### FASE 2: OPTIMIZACIÓN DE ENDPOINTS
- [ ] Eliminar endpoints de prueba duplicados
- [ ] Consolidar endpoints relacionados
- [ ] Optimizar estructura de API

### FASE 3: REORGANIZACIÓN DE COMPONENTES
- [ ] Estandarizar nombres de componentes
- [ ] Eliminar código redundante
- [ ] Optimizar imports y dependencias

### FASE 4: VERIFICACIÓN DE FUNCIONALIDADES
- [ ] Chat WhatsApp
- [ ] Flujo de estados de órdenes
- [ ] Actualizaciones Realtime
- [ ] Página de pedidos

## 📋 ARCHIVOS A CONSERVAR
1. `CORRECCION_FINAL_SUPABASE_ERROR.md`
2. `env_temp.txt`
3. `restart-server.ps1`
4. `verificar-configuracion.ps1`
5. `diagnostico-completo.ps1`

## 🗑️ ARCHIVOS A ELIMINAR
- Scripts de prueba obsoletos
- Documentos duplicados
- SQL de migración completada
- Archivos de debug antiguos
