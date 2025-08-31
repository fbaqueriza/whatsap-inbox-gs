import { supabase } from './supabase/client';

interface MetaConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  openaiApiKey?: string;
}

export class MetaWhatsAppService {
  private config!: MetaConfig;
  private isEnabled: boolean = false;
  private isSimulationMode: boolean = false;
  private initialized: boolean = false;
  private baseUrl = 'https://graph.facebook.com/v18.0'; // Versión más estable

  constructor() {
    // Inicialización síncrona básica
    this.initializeBasic();
  }

  private initializeBasic() {
    const accessToken = process.env.WHATSAPP_API_KEY;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    // 🔧 MEJORA: Reducir logging excesivo
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [DEBUG] Variables de entorno cargadas');
    }

    // FORZAR MODO PRODUCCIÓN - SIEMPRE
    if (accessToken && phoneNumberId && businessAccountId) {
      this.config = {
        accessToken,
        phoneNumberId,
        businessAccountId,
        openaiApiKey: process.env.OPENAI_API_KEY
      };
      
      // FORZAR MODO PRODUCCIÓN - SIN EXCEPCIONES
      this.isEnabled = true;
      this.isSimulationMode = false;
      this.initialized = true;
      // Log solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Meta WhatsApp Service: MODO PRODUCCIÓN ACTIVADO');
    }
    } else {
      console.log('⚠️ Meta WhatsApp Service: Configuración incompleta, usando modo simulación');
      this.isEnabled = true;
      this.isSimulationMode = true;
      this.initialized = true;
    }
  }

  private async initializeIfConfigured() {
    if (this.initialized) return;

    const accessToken = process.env.WHATSAPP_API_KEY;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (accessToken && phoneNumberId && businessAccountId) {
      this.config = {
        accessToken,
        phoneNumberId,
        businessAccountId,
        openaiApiKey: process.env.OPENAI_API_KEY
      };
      
      // Usar modo producción si las credenciales están configuradas
      this.isEnabled = true;
      this.isSimulationMode = false;
      this.initialized = true;
      // console.log('Meta WhatsApp Service: Configuración válida, servicio habilitado en modo PRODUCCIÓN');
    } else {
      console.log('Meta WhatsApp Service: Configuración no encontrada, usando modo simulación');
      this.isEnabled = true;
      this.isSimulationMode = true;
      this.initialized = true;
    }
  }

  public isServiceEnabled(): boolean {
    return this.isEnabled;
  }

  public isSimulationModeEnabled(): boolean {
    return this.isSimulationMode;
  }

  public forceSimulationMode(enabled: boolean): void {
    this.isSimulationMode = enabled;
  }

  public forceProductionMode(): void {
    // Logs solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 FORZANDO MODO PRODUCCIÓN...');
      console.log('✅ MODO PRODUCCIÓN ACTIVADO');
    }
    this.isSimulationMode = false;
    this.isEnabled = true;
    this.initialized = true;
  }

  // Enviar mensaje simple
  async sendMessage(to: string, content: string): Promise<any> {
    // Asegurar que el servicio esté inicializado
    await this.initializeIfConfigured();

    if (!this.isServiceEnabled()) {
      console.log('Meta WhatsApp Service: Servicio deshabilitado');
      return null;
    }

    try {
      if (this.isSimulationMode) {
        // Modo simulación
        // Log solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
          console.log('📤 [SIMULACIÓN] Enviando mensaje WhatsApp:', {
            to,
            content,
            timestamp: new Date().toISOString()
          });
        }

        // Simular delay de envío
        await new Promise(resolve => setTimeout(resolve, 1000));

        const messageId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Guardar en base de datos
        await this.saveMessage({
          id: messageId,
          from: this.config?.phoneNumberId || '123456789',
          to,
          content,
          timestamp: new Date(),
          status: 'sent',
          isAutomated: false,
          isSimulated: true,
          messageType: 'sent' // Agregar explícitamente el tipo
        });

        // 🔧 MEJORA: Disparar evento para actualizar el chat
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('whatsappMessage', {
            detail: { messageId, to, content }
          }));
        }

        // Log solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ [SIMULACIÓN] Mensaje enviado exitosamente:', messageId);
        }
        
        return {
          id: messageId,
          status: 'sent',
          simulated: true
        };
      } else {
        // Modo real
        // 🔧 MEJORA: Reducir logging excesivo
        if (process.env.NODE_ENV === 'development') {
          console.log('📤 [REAL] Enviando mensaje WhatsApp a:', to);
        }

        // Normalizar número de teléfono
        let normalizedPhone = to.replace(/[\s\-\(\)]/g, '');
        if (!normalizedPhone.startsWith('+')) {
          normalizedPhone = `+${normalizedPhone}`;
        }

        const requestBody = {
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: 'text',
          text: {
            body: content
          }
        };

        // Logs de debug solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 [DEBUG] Request URL:', `${this.baseUrl}/${this.config.phoneNumberId}/messages`);
          console.log('🔍 [DEBUG] Request Body:', JSON.stringify(requestBody, null, 2));
          console.log('🔍 [DEBUG] Access Token (first 10 chars):', this.config.accessToken?.substring(0, 10) + '...');
        }

        const response = await fetch(`${this.baseUrl}/${this.config.phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          // Log de error solo en desarrollo
          if (process.env.NODE_ENV === 'development') {
            console.error('🔍 [DEBUG] Error Response:', errorText);
          }
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const result = await response.json();
        // Log solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
          // 🔧 MEJORA: Reducir logging excesivo
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ [REAL] Mensaje enviado exitosamente');
        }
        }

        // Guardar mensaje enviado en base de datos
        await this.saveMessage({
          id: result.messages?.[0]?.id || `msg_${Date.now()}`,
          from: this.config?.phoneNumberId || '123456789',
          to,
          content,
          timestamp: new Date(),
          status: 'sent',
          isAutomated: false,
          isSimulated: false,
          messageType: 'sent' // Agregar explícitamente el tipo
        });

        // 🔧 MEJORA: Disparar evento para actualizar el chat
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('whatsappMessage', {
            detail: { messageId: result.messages?.[0]?.id, to, content }
          }));
        }

        return result;
      }
         } catch (error) {
       console.error('❌ Error sending Meta WhatsApp message:', error);
       
       // NO USAR FALLBACK - Mantener en modo producción
       console.error('❌ Error en modo producción - NO se usará fallback a simulación');
       throw error; // Re-lanzar el error para que se maneje en el nivel superior
     }
  }

     // Enviar mensaje con plantilla
   async sendTemplateMessage(to: string, templateName: string, language: string = 'es_AR', components?: any[], retryCount: number = 0): Promise<any> {
    await this.initializeIfConfigured();

    // FORZAR MODO PRODUCCIÓN SOLO EN EL PRIMER INTENTO
    if (retryCount === 0) {
      this.forceProductionMode();
    }

    if (!this.isServiceEnabled()) {
      console.log('Meta WhatsApp Service: Servicio deshabilitado');
      return null;
    }

    // Validar template antes de enviar
    if (!this.isSimulationMode && retryCount === 0) {
      const templates = await this.getTemplates();
      const templateExists = templates.some(t => t.name === templateName);
      // Logs solo en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Validando template '${templateName}': ${templateExists ? 'EXISTE' : 'NO EXISTE'}`);
        console.log('📋 Templates disponibles:', templates.map(t => t.name));
      }
      
      if (!templateExists) {
        console.error(`❌ Template '${templateName}' no existe en WhatsApp Business Manager`);
        // Fallback a modo simulación si el template no existe
        this.isSimulationMode = true;
        console.log('🔄 Cambiando a modo simulación por template inexistente');
      } else {
        // Log solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Template '${templateName}' encontrado, continuando en modo producción`);
        }
      }
    }

    try {
      if (this.isSimulationMode) {
        // Log solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
          console.log('📤 [SIMULACIÓN] Enviando mensaje con plantilla:', {
            to,
            templateName,
            language
          });
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        const messageId = `sim_template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await this.saveMessage({
          id: messageId,
          from: this.config?.phoneNumberId || '123456789',
          to,
          content: `[TEMPLATE: ${templateName}]`,
          timestamp: new Date(),
          status: 'sent',
          isAutomated: true,
          isSimulated: true
        });

        return {
          id: messageId,
          status: 'sent',
          simulated: true
        };
      } else {
        let normalizedPhone = to.replace(/[\s\-\(\)]/g, '');
        if (!normalizedPhone.startsWith('+')) {
          normalizedPhone = `+${normalizedPhone}`;
        }

        const messageData: any = {
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: language
            }
          }
        };

        if (components) {
          messageData.template.components = components;
        }

        // Logs de debug solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 [DEBUG] Enviando template a Meta API...');
          console.log('🔍 [DEBUG] URL:', `${this.baseUrl}/${this.config.phoneNumberId}/messages`);
          console.log('🔍 [DEBUG] Template data:', JSON.stringify(messageData, null, 2));
        }
         
         const response = await fetch(`${this.baseUrl}/${this.config.phoneNumberId}/messages`, {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${this.config.accessToken}`,
             'Content-Type': 'application/json',
           },
           body: JSON.stringify(messageData),
         });

         if (!response.ok) {
           const errorText = await response.text();
           // Logs de error solo en desarrollo
           if (process.env.NODE_ENV === 'development') {
             console.error('❌ [DEBUG] Error Response:', errorText);
             console.error('❌ [DEBUG] Status:', response.status, response.statusText);
           }
           throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
         }

        const result = await response.json();
        // Log solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
          // 🔧 MEJORA: Reducir logging excesivo
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ [REAL] Template enviado exitosamente');
        }
        }

        await this.saveMessage({
          id: result.messages?.[0]?.id || `template_${Date.now()}`,
          from: this.config.phoneNumberId,
          to: normalizedPhone,
          content: `[TEMPLATE: ${templateName}]`,
          timestamp: new Date(),
          status: 'sent',
          isAutomated: true,
          isSimulated: false
        });

        return result;
      }
         } catch (error) {
       console.error('❌ Error sending template message:', error);
       
       // NO USAR FALLBACK - Mantener en modo producción
       console.error('❌ Error en modo producción - NO se usará fallback a simulación');
       throw error; // Re-lanzar el error para que se maneje en el nivel superior
     }
  }

  // Procesar mensaje entrante con IA automática
  async processIncomingMessage(messageData: any): Promise<void> {
    await this.initializeIfConfigured();

    if (!this.isServiceEnabled()) {
      return;
    }

    try {
      
      // Extraer contenido del mensaje
      let messageContent = '';
      if (messageData.text && messageData.text.body) {
        messageContent = messageData.text.body;
      } else if (messageData.content) {
        messageContent = messageData.content;
      } else if (messageData.type === 'image' && messageData.image) {
        messageContent = '[Imagen]';
      } else if (messageData.type === 'document' && messageData.document) {
        messageContent = `[Documento: ${messageData.document.filename}]`;
      } else {
        messageContent = '[Mensaje no soportado]';
      }

      // Normalizar número de teléfono - CON el + para consistencia con el frontend
      let normalizedFrom = messageData.from;
      if (normalizedFrom && !normalizedFrom.startsWith('+')) {
        normalizedFrom = `+${normalizedFrom}`;
      }

      // Verificar si este mensaje ya existe en la base de datos antes de guardarlo
      // Esto evita duplicados cuando Meta confirma mensajes enviados desde la plataforma
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (supabaseUrl && supabaseServiceKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Verificar si ya existe un mensaje con el mismo ID de Meta (más preciso que content)
        if (messageData.id) {
          const { data: existingMessage } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('message_sid', messageData.id)
            .single();
          
          if (existingMessage) {
            console.log('🔄 Mensaje duplicado detectado en webhook (por ID), evitando guardar:', messageContent);
            return; // Salir sin guardar
          }
        } else {
          // Fallback: verificar por content y contact_id en los últimos 10 segundos (más restrictivo)
          const tenSecondsAgo = new Date(Date.now() - 10 * 1000).toISOString();
          const { data: existingMessage } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('content', messageContent)
            .eq('contact_id', normalizedFrom)
            .gte('timestamp', tenSecondsAgo)
            .single();
          
          if (existingMessage) {
            console.log('🔄 Mensaje duplicado detectado en webhook (por contenido), evitando guardar:', messageContent);
            return; // Salir sin guardar
          }
        }
        
        // Guardar mensaje - Los mensajes de prueba se guardan como leídos
        await this.saveMessage({
          id: messageData.id || `sim_${Date.now()}`,
          from: normalizedFrom,
          to: messageData.to,
          content: messageContent,
          timestamp: new Date(messageData.timestamp || Date.now()),
          status: this.isSimulationMode ? 'read' : 'delivered',
          isAutomated: false,
          isSimulated: this.isSimulationMode
        });
      } else {
        // Si no hay configuración de Supabase, guardar normalmente
        await this.saveMessage({
          id: messageData.id || `sim_${Date.now()}`,
          from: normalizedFrom,
          to: messageData.to,
          content: messageContent,
          timestamp: new Date(messageData.timestamp || Date.now()),
          status: this.isSimulationMode ? 'read' : 'delivered',
          isAutomated: false,
          isSimulated: this.isSimulationMode
        });
      }

      // SSE removido - el frontend se actualiza con polling
      
      // Comentado: Respuesta automática desactivada
      // const analysis = await this.analyzeWithAI(messageData.text?.body || messageData.message);
      // const autoResponse = await this.generateAutoResponse(analysis, messageData.text?.body || messageData.message);
      // if (autoResponse) {
      //   await this.sendMessage(messageData.from, autoResponse);
      // }

    } catch (error) {
      // Error processing incoming message
    }
  }

  // Análisis automático con IA
  private async analyzeWithAI(message: string): Promise<any> {
    if (!this.config.openaiApiKey) {
      return {
        intent: 'general',
        sentiment: 'neutral',
        requiresHuman: false
      };
    }

    try {
      const analysis = {
        intent: this.detectIntent(message),
        sentiment: this.detectSentiment(message),
        entities: this.extractEntities(message),
        requiresHuman: this.requiresHumanIntervention(message)
      };

      return analysis;
    } catch (error) {
      console.error('Error analyzing with AI:', error);
      return null;
    }
  }

  // Generar respuesta automática
  private async generateAutoResponse(analysis: any, originalMessage: string): Promise<string | null> {
    if (analysis?.requiresHuman) {
      return 'Gracias por tu mensaje. Un agente humano te responderá pronto.';
    }

    // Respuestas automáticas basadas en intención
    switch (analysis?.intent) {
      case 'order':
        return '¡Perfecto! Procesando tu pedido. ¿Cuándo necesitas la entrega?';
      case 'inquiry':
        return 'Te ayudo con tu consulta. ¿Qué información necesitas?';
      case 'complaint':
        return 'Lamento el inconveniente. Un agente te contactará para resolverlo.';
      default:
        return 'Gracias por tu mensaje. ¿En qué puedo ayudarte?';
    }
  }

  // Detectar intención básica
  private detectIntent(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('pedido') || lowerMessage.includes('orden') || lowerMessage.includes('comprar')) {
      return 'order';
    }
    if (lowerMessage.includes('precio') || lowerMessage.includes('costo') || lowerMessage.includes('cuánto')) {
      return 'inquiry';
    }
    if (lowerMessage.includes('problema') || lowerMessage.includes('error') || lowerMessage.includes('queja')) {
      return 'complaint';
    }
    
    return 'general';
  }

  // Detectar sentimiento básico
  private detectSentiment(message: string): string {
    const positiveWords = ['gracias', 'excelente', 'perfecto', 'bueno', 'genial'];
    const negativeWords = ['malo', 'terrible', 'pésimo', 'enojado', 'molesto'];
    
    const lowerMessage = message.toLowerCase();
    
    if (positiveWords.some(word => lowerMessage.includes(word))) {
      return 'positive';
    }
    if (negativeWords.some(word => lowerMessage.includes(word))) {
      return 'negative';
    }
    
    return 'neutral';
  }

  // Extraer entidades básicas
  private extractEntities(message: string): any {
    const entities = {
      products: [] as string[],
      quantities: [] as string[],
      prices: [] as string[]
    };

    const words = message.toLowerCase().split(' ');
    
    const productKeywords = ['naranja', 'pomelo', 'mandarina', 'lima', 'carne', 'pollo'];
    words.forEach(word => {
      if (productKeywords.includes(word)) {
        entities.products.push(word);
      }
    });

    return entities;
  }

  // Determinar si requiere intervención humana
  private requiresHumanIntervention(message: string): boolean {
    const complexKeywords = ['problema', 'queja', 'error', 'urgente', 'importante'];
    const lowerMessage = message.toLowerCase();
    
    return complexKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  // Guardar mensaje en base de datos
  public async saveMessage(message: any): Promise<void> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.log('❌ Supabase no configurado para guardar mensaje');
        return;
      }

      // Usar solo las columnas más básicas y generar UUID válido
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      
      // Determinar el contact_id basado en el tipo de mensaje
      let contactId = 'unknown';
      
      // Para mensajes recibidos (del proveedor), usar el número de origen (from)
      // Para mensajes enviados (desde la plataforma), usar el número de destino (to)
      if (message.messageType === 'sent') {
        // Mensaje enviado desde la plataforma - usar el número de destino
        contactId = message.to || message.contact_id;
      } else {
        // Mensaje recibido del proveedor - usar el número de origen
        contactId = message.from || message.contact_id;
      }
      
      // Normalizar el contact_id
      if (contactId && contactId !== 'unknown') {
        contactId = contactId.replace(/[\s\-\(\)]/g, '');
        if (!contactId.startsWith('+')) {
          contactId = `+${contactId}`;
        }
      }
      
      // Solo usar número de prueba si realmente no hay un contact_id válido
      if (!contactId || contactId === 'unknown') {
        contactId = '+5491112345678'; // Número de prueba para mensajes del sistema
      }
      
      // Determinar el tipo de mensaje
      let messageType = message.messageType || 'received'; // Usar el tipo explícito si está disponible
      
      // Si no hay tipo explícito, determinar basado en la dirección
      if (!message.messageType) {
        if (message.from === this.config?.phoneNumberId || (message.to && !message.from)) {
          // Si el mensaje viene de nuestro número de teléfono o solo tiene 'to', es enviado
          messageType = 'sent';
        }
      }
      
      // Usar el user_id del mensaje si está disponible, sino usar null
      // El user_id debe ser un UUID válido o null, no un string
      const userId = message.user_id || null;

      const messageData = {
        id: generateUUID(), // Siempre generar UUID válido para el id
        content: message.content || message.text?.body || '',
        timestamp: message.timestamp || new Date().toISOString(),
        message_sid: message.id || `msg_${Date.now()}`, // Usar el ID original de Meta como message_sid (string)
        contact_id: contactId,
        message_type: messageType, // Usar el tipo correcto basado en la dirección
        user_id: userId,
        status: message.status || 'delivered'
      };

      // Log solo en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log('💾 Guardando mensaje con datos:', {
          id: messageData.id,
          timestamp: messageData.timestamp,
          content: messageData.content?.substring(0, 50),
          contact_id: messageData.contact_id
        });
      }

      // Crear cliente de Supabase con service role key
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Verificar si el mensaje ya existe para evitar duplicados usando message_sid
      // Solo verificar si message_sid no es null y es un string válido
      if (messageData.message_sid && typeof messageData.message_sid === 'string') {
        const { data: existingMessage } = await supabase
          .from('whatsapp_messages')
          .select('id')
          .eq('message_sid', messageData.message_sid)
          .single();

        if (existingMessage) {
          // Log solo en desarrollo
          if (process.env.NODE_ENV === 'development') {
            console.log('⚠️ Mensaje ya existe, evitando duplicado:', messageData.message_sid);
          }
          return;
        }
      }

      // Verificación adicional: evitar duplicados basados en content + contact_id + timestamp (ventana de 10 segundos)
      const { data: recentMessages } = await supabase
        .from('whatsapp_messages')
        .select('id, content, contact_id, timestamp')
        .eq('content', messageData.content)
        .eq('contact_id', messageData.contact_id)
        .eq('message_type', messageData.message_type)
        .gte('timestamp', new Date(Date.now() - 10000).toISOString()) // Últimos 10 segundos
        .limit(1);

      if (recentMessages && recentMessages.length > 0) {
        // Log solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️ Mensaje similar reciente detectado, evitando duplicado:', {
            content: messageData.content?.substring(0, 30),
            contact_id: messageData.contact_id
          });
        }
        return;
      }

      const { error } = await supabase
        .from('whatsapp_messages')
        .insert(messageData);
      
      if (error) {
        console.error('❌ Error guardando mensaje en base de datos:', error);
      }
    } catch (error) {
      // Error no crítico, continuar
    }
  }

  // Obtener estadísticas
  async getStatistics(): Promise<any> {
    await this.initializeIfConfigured();

    if (!this.isServiceEnabled()) return null;

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.log('Supabase no configurado, retornando estadísticas básicas');
        return {
          totalMessages: 0,
          automatedResponses: 0,
          humanInterventions: 0,
          simulatedMessages: 0,
          averageResponseTime: 0,
          mode: this.isSimulationModeEnabled() ? 'simulation' : 'production'
        };
      }

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) {
        console.log('Error getting statistics (no crítico):', error);
        return {
          totalMessages: 0,
          automatedResponses: 0,
          humanInterventions: 0,
          simulatedMessages: 0,
          averageResponseTime: 0,
          mode: this.isSimulationModeEnabled() ? 'simulation' : 'production'
        };
      }

      const stats = {
        totalMessages: data?.length || 0,
        automatedResponses: data?.filter(m => m.isAutomated).length || 0,
        humanInterventions: data?.filter(m => !m.isAutomated).length || 0,
        simulatedMessages: data?.filter(m => m.isSimulated).length || 0,
        averageResponseTime: this.calculateAverageResponseTime(data || []),
        mode: this.isSimulationModeEnabled() ? 'simulation' : 'production'
      };

      return stats;
    } catch (error) {
      console.log('Error getting statistics (no crítico):', error);
      return {
        totalMessages: 0,
        automatedResponses: 0,
        humanInterventions: 0,
        simulatedMessages: 0,
        averageResponseTime: 0,
        mode: this.isSimulationModeEnabled() ? 'simulation' : 'production'
      };
    }
  }

  private calculateAverageResponseTime(messages: any[]): number {
    // Implementar cálculo de tiempo de respuesta promedio
    return 0;
  }

  // Verificar estado del servicio
  async getServiceStatus(): Promise<any> {
    await this.initializeIfConfigured();

    return {
      enabled: this.isServiceEnabled(),
      simulationMode: this.isSimulationModeEnabled(),
      configured: !!(this.config?.accessToken && this.config?.phoneNumberId),
      phoneNumberId: this.config?.phoneNumberId,
      businessAccountId: this.config?.businessAccountId
    };
  }

  // Obtener plantillas disponibles
  async getTemplates(): Promise<any[]> {
    await this.initializeIfConfigured();

    if (!this.isServiceEnabled()) {
      console.log('Meta WhatsApp Service: Servicio deshabilitado');
      return [];
    }

    try {
      if (this.isSimulationMode) {
        // Modo simulación - devolver plantillas de ejemplo
        return [
          {
            name: 'envio_de_orden',
            language: 'es',
            category: 'UTILITY',
            components: [
              {
                type: 'HEADER',
                text: 'Nuevo pedido recibido'
              },
              {
                type: 'BODY',
                text: 'Hemos recibido un nuevo pedido. Por favor confirma la recepción.'
              }
            ]
          },
          {
            name: 'inicializador_de_conv',
            language: 'es',
            category: 'UTILITY',
            components: [
              {
                type: 'HEADER',
                text: 'Conversación iniciada'
              },
              {
                type: 'BODY',
                text: 'Hola, hemos iniciado una nueva conversación. ¿En qué podemos ayudarte?'
              }
            ]
          }
        ];
      }

      // Modo producción - obtener plantillas reales de Meta
      // Logs solo en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Consultando templates en Meta API...');
        console.log('🔍 URL:', `${this.baseUrl}/${this.config.businessAccountId}/message_templates`);
      }
      
      const response = await fetch(`${this.baseUrl}/${this.config.businessAccountId}/message_templates`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error obteniendo plantillas de Meta:', response.status, response.statusText);
        console.error('❌ Error details:', errorText);
        
        // Si es error 400, puede ser problema de versión de API
        if (response.status === 400) {
          console.log('⚠️ Error 400: Posible problema con versión de API o configuración');
        }
        
        return [];
      }

      const data = await response.json();
      // Log solo en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Templates obtenidos exitosamente:', data.data?.length || 0, 'templates');
      }
      return data.data || [];
    } catch (error) {
      console.error('❌ Error en getTemplates:', error);
      return [];
    }
  }
}

// Instancia global
export const metaWhatsAppService = new MetaWhatsAppService(); 