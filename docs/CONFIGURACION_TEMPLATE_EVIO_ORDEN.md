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

### 3. Configurar variables dinámicas con nombres específicos

**Header:**
```
Nueva orden {{provider_name}}
```

**Body:**
```
Buen día {{contact_name}}! En cuanto me confirmes, paso el pedido de esta semana.
```

### 4. Estructura de variables
- **{{provider_name}}** = Nombre del proveedor
- **{{contact_name}}** = Nombre del contacto

## 🔧 CÓDIGO CORRESPONDIENTE

El código ya está configurado para enviar los parámetros en el orden correcto:

```typescript
// Variables enviadas
{
  provider_name: "L'igiene",  // Se mapea a {{provider_name}}
  contact_name: "L'igiene"    // Se mapea a {{contact_name}}
}

// Componentes enviados
[
  {
    type: 'header',
    parameters: [
      {
        type: 'text',
        parameter_name: 'provider_name',  // Campo requerido según documentación de Meta
        text: variables['provider_name']  // {{provider_name}}
      }
    ]
  },
  {
    type: 'body',
    parameters: [
      {
        type: 'text',
        parameter_name: 'contact_name',   // Campo requerido según documentación de Meta
        text: variables['contact_name']   // {{contact_name}}
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
5. **Header**: `Nueva orden {{provider_name}}`
6. **Body**: `Buen día {{contact_name}}! En cuanto me confirmes, paso el pedido de esta semana.`
7. **Guardar** cambios
8. **Enviar para revisión** de Meta

## ⚠️ IMPORTANTE

- Los nombres de variables deben ser **{{provider_name}}** y **{{contact_name}}** (nombres específicos)
- El campo `parameter_name` es **OBLIGATORIO** según la documentación oficial de Meta
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
2. Que los nombres de variables {{provider_name}} y {{contact_name}} estén correctos
3. Que el campo `parameter_name` esté incluido en todos los parámetros
4. Que no haya espacios extra en las variables
