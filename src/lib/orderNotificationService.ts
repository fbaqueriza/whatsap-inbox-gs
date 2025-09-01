import { Order, OrderItem, Provider } from '../types';

interface OrderNotificationData {
  order: Order;
  provider: Provider;
  items: OrderItem[];
}

interface NotificationResult {
  success: boolean;
  templateSent: boolean;
  pendingOrderSaved: boolean;
  errors: string[];
}

// Callbacks para notificar al frontend
type PendingOrderCallback = (providerPhone: string, orderId: string) => void;

export class OrderNotificationService {
  private static onPendingOrderDeletedCallbacks: PendingOrderCallback[] = [];

  /**
   * Registra un callback para cuando se elimina un pending order
   */
  static onPendingOrderDeleted(callback: PendingOrderCallback): void {
    this.onPendingOrderDeletedCallbacks.push(callback);
  }

  /**
   * Notifica a todos los callbacks registrados que se eliminó un pending order
   */
  private static notifyPendingOrderDeleted(providerPhone: string, orderId: string): void {
    console.log(`🔔 Notificando eliminación de pending order: ${providerPhone} (${orderId})`);
    this.onPendingOrderDeletedCallbacks.forEach(callback => {
      try {
        callback(providerPhone, orderId);
      } catch (error) {
        console.error('❌ Error en callback de eliminación:', error);
      }
    });
  }

  // Método singleton para obtener cliente Supabase
  private static async getSupabaseClient() {
    const { createClient } = await import('@supabase/supabase-js');
    
    // Determinar si estamos en el servidor o cliente
    const isServer = typeof window === 'undefined';
    
    // Usar una instancia singleton para evitar múltiples clientes
    const clientKey = isServer ? 'supabaseServiceClient' : 'supabaseClient';
    
    if (!(global as any)[clientKey]) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = isServer 
        ? process.env.SUPABASE_SERVICE_ROLE_KEY 
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error(`Variables de entorno faltantes: ${!supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : ''} ${!supabaseKey ? (isServer ? 'SUPABASE_SERVICE_ROLE_KEY' : 'NEXT_PUBLIC_SUPABASE_ANON_KEY') : ''}`);
      }
      
      (global as any)[clientKey] = createClient(supabaseUrl, supabaseKey);
    }
    return (global as any)[clientKey];
  }

  /**
   * Normaliza un número de teléfono al formato requerido +54XXXXXXXXXX
   */
  private static normalizePhoneNumber(phone: string): string | null {
    if (!phone) return null;
    
    // Remover espacios, guiones, paréntesis y otros caracteres
    let normalized = phone.replace(/[\s\-\(\)]/g, '');
    
    // Si ya empieza con +54, verificar que tenga el formato correcto
    if (normalized.startsWith('+54')) {
      if (normalized.length >= 12 && normalized.length <= 14) {
        return normalized;
      }
    }
    
    // Si empieza con 54 (sin +), agregar +
    if (normalized.startsWith('54')) {
      normalized = '+' + normalized;
      if (normalized.length >= 12 && normalized.length <= 14) {
        return normalized;
      }
    }
    
    // Si empieza con 9 (número argentino), agregar +54
    if (normalized.startsWith('9') && normalized.length === 10) {
      return '+54' + normalized;
    }
    
    // Si empieza con 11 (código de área), agregar +549
    if (normalized.startsWith('11') && normalized.length === 10) {
      return '+54' + normalized;
    }
    
    // Si tiene 10 dígitos y empieza con 15, agregar +54
    if (normalized.startsWith('15') && normalized.length === 10) {
      return '+54' + normalized;
    }
    
    // Si tiene 9 dígitos y empieza con 9, agregar +549
    if (normalized.startsWith('9') && normalized.length === 9) {
      return '+549' + normalized;
    }
    
    // Si tiene 8 dígitos y empieza con 9, agregar +549
    if (normalized.startsWith('9') && normalized.length === 8) {
      return '+549' + normalized;
    }
    
    console.warn('⚠️ No se pudo normalizar el número:', phone);
    return null;
  }

  /**
   * 🔧 FLUJO OPTIMIZADO: Envía notificación automática de nuevo pedido al proveedor
   * 1. Orden se crea como 'pending'
   * 2. Se envía template evio_orden con variables personalizadas
   * 3. Se guarda como 'pending_confirmation'
   * 4. Cuando el proveedor responde, se actualiza automáticamente
   */
  static async sendOrderNotification(order: Order, userId: string): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: false,
      templateSent: false,
      pendingOrderSaved: false,
      errors: []
    };

    try {
      // 🔧 MEJORA: Log detallado para debugging
      // 🔧 MEJORA: Reducir logging excesivo
      if (process.env.NODE_ENV === 'development') {
        console.log('📤 Enviando notificación para orden:', order.id);
      }
      
      // 🔧 MEJORA: Obtener información del proveedor usando singleton mejorado
      const supabase = await this.getSupabaseClient();

      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('*')
        .eq('id', order.providerId)
        .single();

      if (providerError || !provider) {
        const error = `No se encontró el proveedor: ${order.providerId}`;
        console.error('❌', error);
        result.errors.push(error);
        return result;
      }
      
             // 🔧 MEJORA: Reducir logging excesivo
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Proveedor:', provider.name);
        }
      
      // PASO 1: Normalizar número de teléfono
      const normalizedPhone = this.normalizePhoneNumber(provider.phone);
      if (!normalizedPhone) {
        const error = `No se pudo normalizar el número: ${provider.phone}`;
        console.error('❌', error);
        result.errors.push(error);
        return result;
      }
      
             // Log solo si hay cambio en la normalización
       if (provider.phone !== normalizedPhone) {
         // 🔧 MEJORA: Reducir logging excesivo
        if (process.env.NODE_ENV === 'development') {
          console.log('📱 Número normalizado:', provider.phone, '→', normalizedPhone);
        }
       }

      // 🔧 PASO 2: Enviar template evio_orden con variables personalizadas
      const baseUrl = this.buildBaseUrl();

      try {
              // 🔧 CORRECCIÓN: Preparar variables para el template evio_orden
      // Según Meta Business Manager, evio_orden usa nombres específicos:
      // 1. Header: "provider_name" (nombre del proveedor)
      // 2. Body: "contact_name" (nombre de contacto del proveedor)
      const templateVariables = {
        'provider_name': provider?.name || 'Proveedor',
        'contact_name': provider?.contact_name || provider?.name || 'Contacto'
      };
      
      // 🔧 MEJORA: Log detallado para verificar qué valor se usa para contact_name
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Variables preparadas para template:', templateVariables);
        console.log('🔧 Datos del proveedor:', {
          id: provider?.id,
          name: provider?.name,
          contact_name: provider?.contact_name,
          hasContactName: !!provider?.contact_name,
          contactNameType: typeof provider?.contact_name
        });
        if (provider?.contact_name) {
          console.log('✅ Usando contact_name del proveedor:', provider.contact_name);
        } else {
          console.log('⚠️ No hay contact_name configurado, usando name del proveedor:', provider?.name);
        }
      }
        
        const templateResult = await this.sendTemplateToMeta(normalizedPhone, templateVariables, userId);
        result.templateSent = templateResult.success;
        
        if (!templateResult.success) {
          const errorMessage = templateResult.error || 'Error desconocido';
          
          // 🔧 MEJORA: Manejo específico de errores de conexión
          if (errorMessage.includes('conexión') || errorMessage.includes('red')) {
            result.errors.push(`⚠️ ${errorMessage} - El pedido se guardará como pendiente`);
            console.warn('⚠️ Error de conexión detectado - El pedido se guardará como pendiente');
          } else if (errorMessage.includes('activación manual')) {
            result.errors.push(`⚠️ ${errorMessage}`);
            console.log('⚠️ Número requiere activación manual - guardando pedido pendiente');
          } else {
            result.errors.push(`Template: ${errorMessage}`);
          }
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log('📱 Template:', templateResult.success ? '✅ Enviado' : '❌ Falló');
        }
      } catch (error) {
        const errorMsg = this.formatErrorMessage(error);
        result.errors.push(`Template: ${errorMsg}`);
        
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Error enviando template:', errorMsg);
        }
      }

      // PASO 3: Guardar pedido pendiente de confirmación
      try {
        const saveResult = await this.savePendingOrderAtomic(order, provider, normalizedPhone, userId, baseUrl);
        result.pendingOrderSaved = saveResult.success;
        if (!saveResult.success) {
          result.errors.push(`Guardado: ${saveResult.error}`);
        }
        // 🔧 MEJORA: Reducir logging excesivo
        if (process.env.NODE_ENV === 'development') {
          console.log('💾 Pending order:', saveResult.success ? '✅ Guardado' : '❌ Falló');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        result.errors.push(`Guardado: ${errorMsg}`);
        console.error('❌ Error guardando pedido:', error);
      }

      // DETERMINAR ÉXITO GENERAL
      // 🔧 MEJORA: Considerar éxito si se guardó el pedido pendiente, incluso si el template falló
      result.success = result.templateSent || result.pendingOrderSaved;
      
             // Log solo si hay errores o éxito completo
       if (result.errors.length > 0) {
         console.log('❌ Errores en notificación:', result.errors.length);
         // 🔧 MEJORA: Log específico para errores de activación
         const activationErrors = result.errors.filter(e => e.includes('activación manual'));
         if (activationErrors.length > 0) {
           console.log('⚠️ Errores de activación manual detectados:', activationErrors.length);
         }
       } else if (result.success) {
         console.log('✅ Notificación completada');
       }

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      result.errors.push(errorMsg);
      console.error('❌ Error general en sendOrderNotification:', error);
      return result;
    }
  }

  /**
   * Envía template a Meta WhatsApp API
   */
  /**
   * Envía template a Meta WhatsApp API con manejo robusto de errores
   */
  private static async sendTemplateToMeta(
    phone: string, 
    templateVariables: Record<string, string>, 
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 🔧 CORRECCIÓN: Detectar URL base automáticamente
      const baseUrl = this.detectBaseUrl();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📱 Enviando template evio_orden a Meta API...');
      }
      
      const response = await fetch(`${baseUrl}/api/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: phone,
          message: 'evio_orden',
          templateVariables: templateVariables,
          userId: userId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        const errorMessage = errorData.error || `HTTP ${response.status}`;
        
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Error enviando template:', errorMessage);
        }
        
        return { success: false, error: errorMessage };
      }

      const result = await response.json();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Template enviado exitosamente');
      }
      
      return { success: true };

    } catch (error) {
      const errorMessage = this.formatErrorMessage(error);
      
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error en sendTemplateToMeta:', errorMessage);
      }
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Detecta automáticamente la URL base correcta
   */
  private static detectBaseUrl(): string {
    // 🔧 MEJORA: Detección inteligente de URL base
    if (typeof window !== 'undefined') {
      // Cliente: usar la URL actual
      return window.location.origin;
    }
    
    // Servidor: usar variables de entorno o detectar puerto
    const envUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (envUrl) {
      return envUrl;
    }
    
    // 🔧 CORRECCIÓN: Usar puerto 3001 en desarrollo
    const port = process.env.PORT || '3001';
    return `http://localhost:${port}`;
  }

  /**
   * Formatea mensajes de error de forma consistente
   */
  private static formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // 🔧 MEJORA: Manejo específico de errores de red
      if (error.message.includes('ECONNREFUSED')) {
        return 'Error de conexión: No se pudo conectar al servidor';
      }
      if (error.message.includes('fetch failed')) {
        return 'Error de red: Fallo en la comunicación con el servidor';
      }
      return error.message;
    }
    return 'Error desconocido';
  }

  /**
   * Genera instrucciones claras para activar un número bloqueado
   */
  private static generateActivationInstructions(phone: string, provider?: Provider, order?: Order): string {
    const providerName = provider?.name || 'Proveedor';
    const orderNumber = order?.orderNumber || order?.id || 'N/A';
    
        return `Para activar el número ${phone} (${providerName}):

1. El proveedor debe enviar un mensaje a nuestro WhatsApp Business: +5491141780300
2. El mensaje debe contener: "Hola, soy ${providerName}"
3. Una vez activado, podremos enviar notificaciones automáticas
4. Pedido ${orderNumber} esperando confirmación manual

NOTA: Este error ocurre cuando han pasado más de 24 horas desde la última respuesta del proveedor. Es necesario que el proveedor inicie una nueva conversación.`;
  }

  /**
   * Guarda pedido que requiere activación manual
   */
  private static async saveManualActivationOrder(
    order: Order, 
    provider: Provider, 
    phone: string, 
    userId: string
  ): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();
      
      const { error } = await supabase
        .from('pending_orders')
        .insert([{
          order_id: order?.id,
          provider_id: provider?.id,
          provider_phone: phone,
          user_id: userId,
          status: 'manual_activation_required',
          notes: `Número ${phone} requiere activación manual en WhatsApp`,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('❌ Error guardando pedido de activación manual:', error);
      } else {
        console.log('✅ Pedido guardado como "requiere activación manual"');
      }
    } catch (error) {
      console.error('❌ Error en saveManualActivationOrder:', error);
    }
  }

     /**
    * Guarda pedido pendiente de confirmación de forma atómica
    */
   private static async savePendingOrderAtomic(
     order: Order,
     provider: Provider, 
     normalizedPhone: string, 
     userId: string,
     baseUrl: string
   ): Promise<{ success: boolean; error?: string }> {
     try {
       // Validar datos antes de enviar
       if (!order.id || !provider.id || !normalizedPhone || !userId) {
         const missingData = [];
         if (!order.id) missingData.push('orderId');
         if (!provider.id) missingData.push('providerId');
         if (!normalizedPhone) missingData.push('providerPhone');
         if (!userId) missingData.push('userId');
         
         console.error('❌ Datos faltantes para guardar pedido pendiente:', missingData);
         return { success: false, error: `Datos faltantes: ${missingData.join(', ')}` };
       }
       
       const response = await fetch(`${baseUrl}/api/whatsapp/save-pending-order`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           orderId: order.id,
           providerId: provider.id,
           providerPhone: normalizedPhone,
           userId: userId
         }),
       });

       const result = await response.json();
       
       if (!response.ok) {
         console.error('❌ Error guardando pedido pendiente:', result);
         return { success: false, error: result.error || 'Error guardando pedido' };
       }

       console.log('✅ Pedido pendiente guardado exitosamente');
       return { success: true };

     } catch (error) {
       const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
       console.error('❌ Error guardando pedido pendiente:', error);
       return { success: false, error: errorMsg };
     }
   }

  /**
   * Verifica si un mensaje es una confirmación
   * 🔧 MEJORA: Cualquier mensaje se considera confirmación
   */
  private static isConfirmationMessage(message: string): boolean {
    // 🔧 SIMPLIFICACIÓN: Cualquier mensaje válido se considera confirmación
    if (!message || typeof message !== 'string') {
      return false;
    }
    
    // Solo verificar que no esté vacío después de limpiar espacios
    const trimmedMessage = message.trim();
    return trimmedMessage.length > 0;
  }

  /**
   * Procesa la respuesta de un proveedor a un pedido
   */
  static async processProviderResponse(providerPhone: string, response: string): Promise<boolean> {
    const startTime = Date.now();
    const requestId = `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`🔄 [${requestId}] Procesando respuesta del proveedor:`, { 
        providerPhone, 
        response: response.substring(0, 50) + (response.length > 50 ? '...' : ''),
        timestamp: new Date().toISOString()
      });

      // Buscar pedido pendiente
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // 🔧 CORRECCIÓN: Buscar pedidos pendientes con cualquier estado de pending
      const { data: pendingOrders, error: pendingError } = await supabase
        .from('pending_orders')
        .select('*')
        .eq('provider_phone', providerPhone)
        .or('status.eq.pending,status.eq.pending_confirmation')
        .order('created_at', { ascending: false })
        .limit(1);

      if (pendingError) {
        console.error(`❌ [${requestId}] Error buscando pedidos pendientes:`, pendingError);
        return false;
      }

      if (!pendingOrders || pendingOrders.length === 0) {
        console.log(`⚠️ [${requestId}] No se encontraron pedidos pendientes para:`, providerPhone);
        return false;
      }

      const pendingOrder = pendingOrders[0];
      console.log(`📋 [${requestId}] Pedido pendiente encontrado:`, {
        id: pendingOrder.id,
        order_id: pendingOrder.order_id,
        status: pendingOrder.status,
        created_at: pendingOrder.created_at
      });

      // Buscar orden completa
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', pendingOrder.order_id)
        .single();

      if (orderError || !orders) {
        console.error(`❌ [${requestId}] Error buscando orden:`, orderError);
        return false;
      }

      const orderData = orders;
      console.log(`📦 [${requestId}] Orden encontrada:`, {
        id: orderData.id,
        order_number: orderData.order_number,
        status: orderData.status,
        user_id: orderData.user_id
      });

      // Actualizar estado de la orden
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', orderData.id);

      if (updateError) {
        console.error(`❌ [${requestId}] Error actualizando estado de orden:`, updateError);
        return false;
      }

      console.log(`✅ [${requestId}] Estado de orden actualizado a confirmado`);

      // Enviar detalles del pedido
      const orderDetails = this.generateOrderDetailsMessage(orderData);
      console.log(`📤 [${requestId}] Enviando detalles del pedido:`, orderDetails.substring(0, 100) + '...');

      const sendResult = await this.sendOrderDetails(providerPhone, orderDetails, orderData.user_id);
      
      if (sendResult.success) {
        console.log(`✅ [${requestId}] Detalles del pedido enviados exitosamente`);
      } else {
        console.error(`❌ [${requestId}] Error enviando detalles del pedido:`, sendResult.error);
      }

      // Eliminar pedido pendiente
      const { error: deleteError } = await supabase
        .from('pending_orders')
        .delete()
        .eq('id', pendingOrder.id);

      if (deleteError) {
        console.error(`❌ [${requestId}] Error eliminando pedido pendiente:`, deleteError);
      } else {
        console.log(`🗑️ [${requestId}] Pedido pendiente eliminado`);
      }

      const duration = Date.now() - startTime;
      
      // Retornar el resultado real del envío de detalles
      if (sendResult.success) {
        console.log(`✅ [${requestId}] Orden confirmada, detalles enviados y pedido pendiente eliminado en ${duration}ms`);
        return true;
      } else {
        console.error(`❌ [${requestId}] Orden confirmada, pero falló el envío de detalles en ${duration}ms. Pedido pendiente eliminado.`);
        return false; // Reflejar el fallo del envío de detalles
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [${requestId}] Error procesando respuesta del proveedor en ${duration}ms:`, error);
      return false;
    }
  }

  /**
   * Verifica si hay un pedido pendiente para un proveedor específico
   */
  static async checkPendingOrder(providerPhone: string): Promise<any> {
    try {
      console.log(`🔍 Buscando pedido pendiente para: ${providerPhone}`);
      
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Normalizar el número de teléfono
      const normalizedPhone = this.normalizePhoneNumber(providerPhone);
      if (!normalizedPhone) {
        console.error('❌ No se pudo normalizar el número de teléfono:', providerPhone);
        return null;
      }
      
      console.log('✅ Buscando con número normalizado:', providerPhone, '->', normalizedPhone);
      
      // Buscar directamente con el número normalizado
      const { data, error } = await supabase
        .from('pending_orders')
        .select('*')
        .eq('provider_phone', normalizedPhone)
        .eq('status', 'pending_confirmation')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      console.log(`🔍 Resultado de búsqueda para ${providerPhone}:`, { 
        data: data ? {
          orderId: data.order_id,
          providerPhone: data.provider_phone,
          status: data.status,
          createdAt: data.created_at
        } : null, 
        error 
      });

      if (error) {
        console.log(`ℹ️ No se encontró pedido pendiente para ${providerPhone}:`, error.message);
        return null;
      }

      if (!data) {
        console.log(`ℹ️ No hay pedidos pendientes para: ${providerPhone}`);
        return null;
      }

      console.log(`✅ Pedido pendiente encontrado para ${providerPhone}:`, {
        orderId: data.order_id,
        providerPhone: data.provider_phone,
        status: data.status,
        createdAt: data.created_at
      });

      return data;

    } catch (error) {
      console.error('❌ Error verificando pedido pendiente:', error);
      return null;
    }
  }

     /**
    * Genera mensaje con detalles del pedido
    */
   static generateOrderDetailsMessage(orderData: any): string {
     try {
       // Validación robusta de datos
       if (!orderData) {
         console.error('❌ orderData es undefined en generateOrderDetailsMessage');
         return '📋 Detalles del pedido confirmado.';
       }

       const items = Array.isArray(orderData.items) ? orderData.items : [];
       const totalItems = items.length;
       const orderNumber = orderData.order_number || orderData.id || 'N/A';
       
       // Validación específica del proveedor
       let providerName = 'Proveedor';
       if (orderData.providers && typeof orderData.providers === 'object') {
         providerName = orderData.providers.name || 'Proveedor';
       }
       
       // 🔧 MEJORA: Formatear fecha de entrega
       let deliveryDate = 'No especificada';
       if (orderData.delivery_date) {
         try {
           const date = new Date(orderData.delivery_date);
           deliveryDate = date.toLocaleDateString('es-AR', {
             weekday: 'long',
             year: 'numeric',
             month: 'long',
             day: 'numeric'
           });
         } catch (error) {
           console.warn('⚠️ Error formateando fecha de entrega:', error);
         }
       }
       
       // �� MEJORA: Obtener método de pago
       const paymentMethod = orderData.payment_method || 'No especificado';
       
       // 🔧 MEJORA: Obtener notas
       const notes = orderData.notes || orderData.notes || '';
       
       let message = `📋 *DETALLES DEL PEDIDO*\n\n`;
       message += `*Orden:* ${orderNumber}\n`;
       message += `*Proveedor:* ${providerName}\n`;
       message += `*Total de items:* ${totalItems}\n`;
       message += `*Fecha de entrega:* ${deliveryDate}\n`;
       message += `*Método de pago:* ${paymentMethod}\n`;
       
       // 🔧 MEJORA: Agregar notas solo si existen
       if (notes && notes.trim()) {
         message += `*Notas:* ${notes}\n`;
       }
       
       message += `\n`;
       
       if (items.length > 0) {
         message += `*Items del pedido:*\n`;
         items.forEach((item: any, index: number) => {
           if (item && typeof item === 'object') {
             const quantity = item.quantity || 1;
             const unit = item.unit || 'un';
             const name = item.productName || item.name || item.product_name || 'Producto';
             const price = item.price || item.total || '';
             
             if (price) {
               message += `${index + 1}. ${name} - ${quantity} ${unit} - $${price}\n`;
             } else {
               message += `${index + 1}. ${name} - ${quantity} ${unit}\n`;
             }
           }
         });
       }
       
       // 🔧 MEJORA: Agregar total si está disponible
       if (orderData.total_amount) {
         message += `\n*Total:* $${orderData.total_amount} ${orderData.currency || 'ARS'}`;
       }
       
       return message;
     } catch (error) {
       console.error('❌ Error generando mensaje de detalles:', error);
       return '📋 Detalles del pedido confirmado.';
     }
   }

         /**
     * Envía los detalles del pedido al proveedor
     */
    static async sendOrderDetails(providerPhone: string, message: string, userId?: string): Promise<{ success: boolean; error?: string }> {
     const startTime = Date.now();
     const requestId = `details_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
     
     try {
       console.log(`📤 [${requestId}] Enviando detalles del pedido a: ${providerPhone}`);
       console.log(`📝 [${requestId}] Longitud del mensaje: ${message.length} caracteres`);
       
       // 🔧 CORRECCIÓN: Construir URL de forma robusta con protocolo
       const baseUrl = this.buildBaseUrl();
       console.log(`🌐 [${requestId}] URL base: ${baseUrl}`);
       
       const endpointUrl = `${baseUrl}/api/whatsapp/send`;
       console.log(`📡 [${requestId}] Endpoint: ${endpointUrl}`);
       
       const requestBody = {
         to: providerPhone,
         message: message,
         userId: userId
       };
       
       console.log(`📤 [${requestId}] Enviando request:`, {
         to: requestBody.to,
         messageLength: requestBody.message.length,
         userId: requestBody.userId
       });
       
       const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

       console.log(`📥 [${requestId}] Response status: ${response.status} ${response.statusText}`);
       
       if (!response.ok) {
         const errorText = await response.text();
         console.error(`❌ [${requestId}] Error HTTP ${response.status}:`, errorText);
         return { success: false, error: `HTTP ${response.status}: ${errorText}` };
       }

       const result = await response.json();
       console.log(`📥 [${requestId}] Response JSON:`, result);
       
       if (!result.success) {
         console.error(`❌ [${requestId}] API returned success: false:`, result.error);
         return { success: false, error: result.error || 'API returned success: false' };
       }

       const duration = Date.now() - startTime;
       console.log(`✅ [${requestId}] Detalles enviados exitosamente en ${duration}ms`);
       return { success: true };
       
     } catch (error) {
       const duration = Date.now() - startTime;
       const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
       console.error(`❌ [${requestId}] Error enviando detalles del pedido en ${duration}ms:`, error);
       return { success: false, error: errorMsg };
     }
   }

  /**
   * Elimina un pedido pendiente específico
   */
  static async deletePendingOrder(orderId: string): Promise<boolean> {
    try {
      console.log(`🗑️ Eliminando pedido pendiente: ${orderId}`);
      
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Obtener información del pedido antes de eliminarlo
      const { data: pendingOrder, error: fetchError } = await supabase
        .from('pending_orders')
        .select('provider_phone')
        .eq('order_id', orderId)
        .single();

      if (fetchError) {
        console.error('❌ Error obteniendo pedido pendiente:', fetchError);
        return false;
      }

      // Eliminar el pedido
      const { error: deleteError } = await supabase
        .from('pending_orders')
        .delete()
        .eq('order_id', orderId);

      if (deleteError) {
        console.error('❌ Error eliminando pedido pendiente:', deleteError);
        return false;
      }

      // Notificar a los callbacks
      if (pendingOrder?.provider_phone) {
        this.notifyPendingOrderDeleted(pendingOrder.provider_phone, orderId);
      }

      console.log(`✅ Pedido pendiente eliminado: ${orderId}`);
      return true;

    } catch (error) {
      console.error('❌ Error eliminando pedido pendiente:', error);
      return false;
    }
  }

  /**
   * Envía actualización de estado de orden (DEPRECATED - usar processProviderResponse)
   */
  static async sendOrderStatusUpdate(
    order: Order, 
    provider: Provider, 
    status: string
  ): Promise<boolean> {
    console.warn('⚠️ sendOrderStatusUpdate está deprecado. Usar processProviderResponse en su lugar.');
    return false;
  }

  /**
   * 🔧 MEJORA: Construye URL base de forma robusta y consistente
   * Maneja todos los casos: desarrollo, producción, Vercel, etc.
   * PRIORIDAD: NEXT_PUBLIC_APP_URL > NEXT_PUBLIC_VERCEL_URL > VERCEL_URL > fallback
   */
  private static buildBaseUrl(): string {
    let baseUrl = '';
    
    // Cliente (navegador)
    if (typeof window !== 'undefined') {
      baseUrl = window.location.origin;
      console.log(`[buildBaseUrl] Client-side URL: ${baseUrl}`);
      return baseUrl;
    }
    
    // 🔧 CORRECCIÓN: Priorizar NEXT_PUBLIC_APP_URL (URL de producción)
    if (process.env.NEXT_PUBLIC_APP_URL) {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL;
      console.log(`[buildBaseUrl] NEXT_PUBLIC_APP_URL: ${baseUrl}`);
      return baseUrl;
    }
    
    // Servidor - Variables de entorno públicas (para alias o custom domains)
    if (process.env.NEXT_PUBLIC_VERCEL_URL) {
      const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
      // Asegurar que tenga protocolo https://
      if (vercelUrl.startsWith('http://') || vercelUrl.startsWith('https://')) {
        baseUrl = vercelUrl;
      } else {
        baseUrl = `https://${vercelUrl}`;
      }
      console.log(`[buildBaseUrl] NEXT_PUBLIC_VERCEL_URL: ${baseUrl}`);
      return baseUrl;
    }
    
    // Servidor - Vercel (URL única del deployment) - ÚLTIMA OPCIÓN
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
      console.log(`[buildBaseUrl] VERCEL_URL (fallback): ${baseUrl}`);
      return baseUrl;
    }
    
    // Fallback de producción
    baseUrl = 'https://gastronomy-saas.vercel.app';
    console.warn(`[buildBaseUrl] Fallback URL: ${baseUrl}`);
    return baseUrl;
  }
}
