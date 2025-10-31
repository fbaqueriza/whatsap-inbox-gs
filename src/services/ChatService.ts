/**
 * 🎯 SOLUCIÓN DE RAÍZ - CHAT SYSTEM ARCHITECTURE
 * 
 * PROBLEMAS IDENTIFICADOS:
 * 1. Múltiples sistemas de chat superpuestos (ChatContext, WebSocketChatContext, etc.)
 * 2. Lógica compleja de deduplicación en múltiples lugares
 * 3. Logs excesivos en producción
 * 4. Falta de separación clara de responsabilidades
 * 5. Estado inconsistente entre componentes
 * 
 * SOLUCIÓN ELEGANTE:
 * 1. Un solo sistema de chat unificado
 * 2. Patrón Repository para datos
 * 3. Event-driven architecture
 * 4. Logging inteligente por niveles
 * 5. Estado inmutable y predecible
 */

// ============================================
// 1. TYPES & INTERFACES - Definiciones claras
// ============================================

export interface ChatMessage {
  readonly id: string;
  readonly content: string;
  readonly timestamp: Date;
  readonly type: 'sent' | 'received';
  readonly contactId: string;
  readonly status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  readonly metadata?: {
    isDocument?: boolean;
    mediaUrl?: string;
    filename?: string;
    mediaType?: string;
  };
}

export interface ChatContact {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly lastMessage?: string;
  readonly lastMessageTime?: Date;
  readonly unreadCount: number;
  readonly isOnline: boolean;
}

export interface ChatState {
  readonly messages: Map<string, ChatMessage[]>;
  readonly contacts: Map<string, ChatContact>;
  readonly selectedContactId?: string;
  readonly isConnected: boolean;
  readonly isLoading: boolean;
}

// ============================================
// 2. REPOSITORY PATTERN - Acceso a datos
// ============================================

export interface ChatRepository {
  getMessages(contactId: string): Promise<ChatMessage[]>;
  getContacts(): Promise<ChatContact[]>;
  sendMessage(contactId: string, content: string): Promise<ChatMessage>;
  markAsRead(contactId: string): Promise<void>;
  subscribeToUpdates(callback: (message: ChatMessage) => void): () => void;
}

// ============================================
// 3. EVENT SYSTEM - Comunicación desacoplada
// ============================================

export type ChatEvent = 
  | { type: 'MESSAGE_RECEIVED'; payload: ChatMessage }
  | { type: 'MESSAGE_SENT'; payload: ChatMessage }
  | { type: 'CONTACT_SELECTED'; payload: string }
  | { type: 'CONNECTION_CHANGED'; payload: boolean }
  | { type: 'MESSAGES_LOADED'; payload: { contactId: string; messages: ChatMessage[] } };

export interface ChatEventBus {
  emit(event: ChatEvent): void;
  subscribe(eventType: ChatEvent['type'], callback: (payload: any) => void): () => void;
}

// ============================================
// 4. LOGGING SYSTEM - Inteligente por niveles
// ============================================

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface Logger {
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

class ChatLogger implements Logger {
  private level: LogLevel;

  constructor(level: LogLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.WARN) {
    this.level = level;
  }

  error(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[CHAT ERROR] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[CHAT WARN] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.INFO) {
      console.info(`[CHAT INFO] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(`[CHAT DEBUG] ${message}`, ...args);
    }
  }
}

// ============================================
// 5. STATE MANAGEMENT - Inmutable y predecible
// ============================================

export class ChatStateManager {
  private state: ChatState;
  private listeners: Set<(state: ChatState) => void> = new Set();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.state = {
      messages: new Map(),
      contacts: new Map(),
      isConnected: false,
      isLoading: false
    };
  }

  getState(): ChatState {
    return this.state;
  }

  subscribe(listener: (state: ChatState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  addMessage(message: ChatMessage): void {
    this.logger.debug('Adding message', { id: message.id, contactId: message.contactId });
    
    const contactMessages = this.state.messages.get(message.contactId) || [];
    
    // Verificar duplicados de forma elegante
    const exists = contactMessages.some(m => m.id === message.id);
    if (exists) {
      this.logger.debug('Message already exists, skipping', { id: message.id });
      return;
    }

    const newMessages = [...contactMessages, message].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    this.state = {
      ...this.state,
      messages: new Map(this.state.messages).set(message.contactId, newMessages)
    };

    this.notify();
  }

  selectContact(contactId: string): void {
    this.logger.debug('Selecting contact', { contactId });
    
    this.state = {
      ...this.state,
      selectedContactId: contactId
    };

    this.notify();
  }

  setConnectionStatus(connected: boolean): void {
    this.logger.debug('Connection status changed', { connected });
    
    this.state = {
      ...this.state,
      isConnected: connected
    };

    this.notify();
  }

  setLoading(loading: boolean): void {
    this.state = {
      ...this.state,
      isLoading: loading
    };

    this.notify();
  }
}

// ============================================
// 6. MAIN CHAT SERVICE - Orquestador principal
// ============================================

export class ChatService {
  private repository: ChatRepository;
  private stateManager: ChatStateManager;
  private eventBus: ChatEventBus;
  private logger: Logger;
  private unsubscribe?: () => void;

  constructor(
    repository: ChatRepository,
    eventBus: ChatEventBus,
    logger: Logger = new ChatLogger()
  ) {
    this.repository = repository;
    this.eventBus = eventBus;
    this.logger = logger;
    this.stateManager = new ChatStateManager(logger);
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventBus.subscribe('MESSAGE_RECEIVED', (message: ChatMessage) => {
      this.stateManager.addMessage(message);
    });

    this.eventBus.subscribe('CONNECTION_CHANGED', (connected: boolean) => {
      this.stateManager.setConnectionStatus(connected);
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing chat service');
    
    try {
      this.stateManager.setLoading(true);
      
      // Cargar contactos
      const contacts = await this.repository.getContacts();
      this.logger.debug('Loaded contacts', { count: contacts.length });
      
      // Suscribirse a actualizaciones en tiempo real
      this.unsubscribe = this.repository.subscribeToUpdates((message) => {
        this.eventBus.emit({ type: 'MESSAGE_RECEIVED', payload: message });
      });
      
      this.stateManager.setConnectionStatus(true);
      this.logger.info('Chat service initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize chat service', error);
      this.stateManager.setConnectionStatus(false);
    } finally {
      this.stateManager.setLoading(false);
    }
  }

  async selectContact(contactId: string): Promise<void> {
    this.logger.info('Selecting contact', { contactId });
    
    this.stateManager.selectContact(contactId);
    
    try {
      this.stateManager.setLoading(true);
      const messages = await this.repository.getMessages(contactId);
      
      // Agregar mensajes al estado
      messages.forEach(message => {
        this.stateManager.addMessage(message);
      });
      
      // Marcar como leído
      await this.repository.markAsRead(contactId);
      
    } catch (error) {
      this.logger.error('Failed to load messages for contact', { contactId, error });
    } finally {
      this.stateManager.setLoading(false);
    }
  }

  async sendMessage(contactId: string, content: string): Promise<void> {
    this.logger.info('Sending message', { contactId, contentLength: content.length });
    
    try {
      const message = await this.repository.sendMessage(contactId, content);
      this.eventBus.emit({ type: 'MESSAGE_SENT', payload: message });
    } catch (error) {
      this.logger.error('Failed to send message', { contactId, error });
      throw error;
    }
  }

  getState(): ChatState {
    return this.stateManager.getState();
  }

  subscribe(listener: (state: ChatState) => void): () => void {
    return this.stateManager.subscribe(listener);
  }

  destroy(): void {
    this.logger.info('Destroying chat service');
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// ============================================
// 7. REACT HOOK - Interfaz limpia para componentes
// ============================================

// Este hook se implementa en el contexto React separado
// para mantener la separación de responsabilidades

// ============================================
// 8. IMPLEMENTACIONES ESPECÍFICAS (ejemplos)
// ============================================

class SupabaseChatRepository implements ChatRepository {
  async getMessages(contactId: string): Promise<ChatMessage[]> {
    // Implementación específica para Supabase
    // Sin logs excesivos, solo errores críticos
    return [];
  }

  async getContacts(): Promise<ChatContact[]> {
    // Implementación específica para Supabase
    return [];
  }

  async sendMessage(contactId: string, content: string): Promise<ChatMessage> {
    // Implementación específica para Supabase
    throw new Error('Not implemented');
  }

  async markAsRead(contactId: string): Promise<void> {
    // Implementación específica para Supabase
  }

  subscribeToUpdates(callback: (message: ChatMessage) => void): () => void {
    // Implementación específica para Supabase Realtime
    return () => {};
  }
}

class EventBus implements ChatEventBus {
  private listeners: Map<string, Set<(payload: any) => void>> = new Map();

  emit(event: ChatEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event.payload));
    }
  }

  subscribe(eventType: ChatEvent['type'], callback: (payload: any) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(callback);
    
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }
}

export default ChatService;
