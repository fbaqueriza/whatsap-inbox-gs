# Configuración del Template evio_orden en Meta Business Manager

## 🎯 PROBLEMA ACTUAL

El template `evio_orden` está dando error `(#100) Invalid parameter - Parameter name is missing or empty` porque no está configurado correctamente en Meta Business Manager.

## ✅ CONFIGURACIÓN CORRECTA

### 1. Acceder a Meta Business Manager
- Ve a [Meta Business Manager](https://business.facebook.com/)
- Navega a **WhatsApp** > **Plantillas de mensajes**

### 2. Editar el template evio_orden
- Busca el template `evio_orden`
- Haz clic en **"Editar"**

### 3. Configurar variables dinámicas con índices numéricos

**Header:**
```
Nueva orden {{1}}
```

**Body:**
```
Buen día {{2}}! En cuanto me confirmes, paso el pedido de esta semana.
```

### 4. Estructura de variables
- **{{1}}** = Nombre del proveedor (provider_name)
- **{{2}}** = Nombre del contacto (contact_name)

## 🔧 CÓDIGO CORRESPONDIENTE

El código ya está configurado para enviar los parámetros en el orden correcto:

```typescript
// Variables enviadas
{
  provider_name: "L'igiene",  // Se mapea a {{1}}
  contact_name: "L'igiene"    // Se mapea a {{2}}
}

// Componentes enviados
[
  {
    type: 'header',
    parameters: [
      {
        type: 'text',
        text: variables['provider_name']  // {{1}}
      }
    ]
  },
  {
    type: 'body',
    parameters: [
      {
        type: 'text',
        text: variables['contact_name']   // {{2}}
      }
    ]
  }
]
```

## 📋 PASOS PARA CONFIGURAR

1. **Ir a Meta Business Manager**
2. **WhatsApp** > **Plantillas de mensajes**
3. **Buscar** `evio_orden`
4. **Editar** el template
5. **Header**: `Nueva orden {{1}}`
6. **Body**: `Buen día {{2}}! En cuanto me confirmes, paso el pedido de esta semana.`
7. **Guardar** cambios
8. **Enviar para revisión** de Meta

## ⚠️ IMPORTANTE

- Los índices deben ser **{{1}}** y **{{2}}** (no nombres descriptivos)
- El orden de los parámetros debe coincidir con el código
- Después de la configuración, esperar la aprobación de Meta

## 🎯 RESULTADO ESPERADO

Una vez configurado correctamente, el template se enviará sin errores y mostrará:

```
🛒 Nueva orden L'igiene

Buen día L'igiene! En cuanto me confirmes, paso el pedido de esta semana.
```

## 📞 SOPORTE

Si el problema persiste después de esta configuración, verificar:
1. Que el template esté aprobado por Meta
2. Que los índices {{1}} y {{2}} estén en el orden correcto
3. Que no haya espacios extra en las variables
