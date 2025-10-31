'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase/client';
import { WhatsAppMessage, Contact } from '../types/whatsapp';
import { PhoneNumberService } from '../lib/phoneNumberService';
import { useRealtimeService } from '../services/realtimeService';
import { logger } from '../lib/logger';
import { normalizePhoneNumber } from '../lib/phoneNormalization';

// Tipos
interface ChatWhatsAppMessage extends WhatsAppMessage {
  contact_id: string;
  contact_name?: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

interface ChatContextType {
  messages: ChatWhatsAppMessage[];
  messagesByContact: { [contactId: string]: ChatWhatsAppMessage[] };
  sortedContacts: Contact[];
  selectedContact: Contact | null;
  unreadCounts: { [contactId: string]: number };
  totalUnreadCount: number;
  isConnected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  isChatOpen: boolean;
  isUserAuthenticated: boolean;
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (contactId: string, content: string) => Promise<void>;
  markAsRead: (contactId: string) => Promise<void>;
  selectContact: (contact: Contact) => void;
  loadMessages: () => Promise<void>;
  forceReconnectSSE: () => void;
  addMessage: (contactId: string, message: ChatWhatsAppMessage) => void;
}

// Contexto
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Hook personalizado
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// Función centralizada de normalización - usar la función correcta
export const normalizeContactIdentifier = (contactId: string): string => {
  return normalizePhoneNumber(contactId).normalized;
};

// Provider
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatWhatsAppMessage[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [userProviders, setUserProviders] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [userProviderPhones, setUserProviderPhones] = useState<string[]>([]);
  const [lastMessageCount, setLastMessageCount] = useState<number>(0);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState<boolean>(false);
  const [authStateLogged, setAuthStateLogged] = useState<boolean>(false);

  // Hook del servicio global de Realtime
  const { addMessageListener, isConnected: realtimeConnected } = useRealtimeService();

  // Solicitar permisos de notificaciones al cargar
  useEffect(() => {
    if (typeof window !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Verificar estado de autenticación
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authenticated = !!session?.user;
        setIsUserAuthenticated(authenticated);
        
        if (authenticated) {
          if (process.env.NODE_ENV === 'development') {
            logger.userAction('ChatContext', 'Usuario autenticado', session.user.id);
          }
        }
      } catch (error) {
        logger.error('ChatContext', 'Error verificando autenticación', error);
        setIsUserAuthenticated(false);
      }
    };

    checkAuthStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const authenticated = !!session?.user;
      setIsUserAuthenticated(authenticated);
      
      // Solo loggear cambios de estado, no cada evento
      if (authenticated && !authStateLogged) {
        if (process.env.NODE_ENV === 'development') {
          logger.userAction('ChatContext', 'Sesión iniciada', session.user.id);
        }
        setAuthStateLogged(true);
      } else if (!authenticated && authStateLogged) {
        if (process.env.NODE_ENV === 'development') {
          logger.userAction('ChatContext', 'Sesión cerrada');
        }
        setAuthStateLogged(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Cargar proveedores del usuario
  const loadUserProviders = useCallback(async () => {
    if (!isUserAuthenticated) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: providers, error } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        logger.error('ChatContext', 'Error cargando proveedores', error);
        return;
      }

      setUserProviders(providers || []);
      
      const phones = (providers || [])
        .map(p => p.phone)
        .filter(Boolean)
        .map(phone => normalizeContactIdentifier(phone));
      
      setUserProviderPhones(phones);
      if (process.env.NODE_ENV === 'development') {
        logger.dataProcessed('ChatContext', 'proveedores', providers?.length || 0);
      }
    } catch (error) {
      logger.error('ChatContext', 'Error en loadUserProviders', error);
    }
  }, [isUserAuthenticated]);

  // Cargar proveedores cuando el usuario se autentica
  useEffect(() => {
    if (isUserAuthenticated) {
      loadUserProviders();
    }
  }, [isUserAuthenticated, loadUserProviders]);

  // Ref para evitar cargas duplicadas
  const loadMessagesRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Cargar mensajes
  const loadMessages = useCallback(async () => {
    if (loadMessagesRef.current || !isUserAuthenticated) return;
    
    loadMessagesRef.current = true;
    if (process.env.NODE_ENV === 'development') {
      logger.info('ChatContext', 'Iniciando carga de mensajes');
    }

    try {
      // Obtener token de autenticación
      const session = await supabase.auth.getSession();
      if (!session.data.session?.access_token) {
        logger.error('ChatContext', 'No hay token de autenticación disponible');
        return;
      }

      const response = await fetch('/api/kapso/chat?action=conversations', {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        logger.error('ChatContext', 'Error en API de conversaciones', response.status);
        return;
      }

      const data = await response.json();
      const conversations = data.conversations || [];
      
      if (process.env.NODE_ENV === 'development') {
        logger.dataProcessed('ChatContext', 'conversaciones', conversations.length);
      }

      if (conversations.length === 0) {
        setMessages([]);
        return;
      }

      // Procesar conversaciones y cargar mensajes
      const kapsoMessages: ChatWhatsAppMessage[] = [];
      const limitedConversations = conversations.slice(0, 10); // Limitar a 10 conversaciones
      const processedPhones = new Set<string>(); // Para evitar duplicados

      for (let i = 0; i < limitedConversations.length; i++) {
        const conv = limitedConversations[i];
        const phoneNumber = conv.phone_number || conv.phone;
        
        if (!phoneNumber) continue;

        // Normalizar el número de teléfono para evitar contactos duplicados
        const normalizedPhone = normalizePhoneNumber(phoneNumber).normalized;
        
        // Si ya procesamos este número normalizado, saltarlo
        if (processedPhones.has(normalizedPhone)) {
          console.log(`🔄 [ChatContext] Saltando contacto duplicado: ${phoneNumber} -> ${normalizedPhone}`);
          continue;
        }
        
        processedPhones.add(normalizedPhone);

        try {
          const messagesResponse = await fetch(`/api/kapso/chat?action=messages&phoneNumber=${encodeURIComponent(phoneNumber)}`, {
            headers: {
              'Authorization': `Bearer ${session.data.session.access_token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            const convMessages = messagesData.messages || [];
            
            const mappedMessages = convMessages.map((msg: any) => ({
              id: msg.id,
              content: msg.content,
              contact_id: normalizedPhone, // Usar número normalizado como ID único
              contact_name: conv.contact_name || normalizedPhone,
              timestamp: new Date(msg.created_at),
              type: msg.message_type || 'text',
              direction: msg.direction,
              status: msg.status || 'delivered'
            }));
            
            kapsoMessages.push(...mappedMessages);
          } else {
            logger.warn('ChatContext', `Error obteniendo mensajes para ${phoneNumber}`, messagesResponse.status);
          }
        } catch (error) {
          logger.error('ChatContext', `Error procesando conversación ${phoneNumber}`, error);
        }
        
        // Delay entre llamadas para evitar agotamiento de sesión
        if (i < limitedConversations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (process.env.NODE_ENV === 'development') {
        logger.dataProcessed('ChatContext', 'mensajes de Kapso', kapsoMessages.length);
      }
      
      // Deduplicar mensajes por ID
      const uniqueMessages = kapsoMessages.filter((msg, index, self) => 
        index === self.findIndex(m => m.id === msg.id)
      );
      
      setMessages(uniqueMessages);
      
      // Auto-seleccionar primera conversación si no hay selección
      if (!selectedContact && limitedConversations.length > 0) {
        const firstConversation = limitedConversations[0];
        const phoneNumber = firstConversation.phone_number || firstConversation.phone;
        if (phoneNumber) {
          const normalizedPhone = normalizePhoneNumber(phoneNumber).normalized;
          setSelectedContact({
            id: normalizedPhone,
            phone: normalizedPhone,
            name: firstConversation.contact_name || normalizedPhone
          });
        }
      }
      
    } catch (error) {
      logger.error('ChatContext', 'Error cargando mensajes', error);
    } finally {
      loadMessagesRef.current = false;
    }
  }, [isUserAuthenticated, selectedContact]);

  // Cargar mensajes cuando el usuario se autentica
  useEffect(() => {
    if (isUserAuthenticated && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      loadMessages();
    }
  }, [isUserAuthenticated, loadMessages]);

  // Resetear flag de inicialización cuando cambia la autenticación
  useEffect(() => {
    if (!isUserAuthenticated) {
      hasInitializedRef.current = false;
    }
  }, [isUserAuthenticated]);

  // Procesar mensajes por contacto
  const messagesByContact = useMemo(() => {
    const grouped: { [contactId: string]: ChatWhatsAppMessage[] } = {};
    
    messages.forEach(message => {
      const contactId = message.contact_id;
      if (!grouped[contactId]) {
        grouped[contactId] = [];
      }
      grouped[contactId].push(message);
    });
    
    // Ordenar mensajes por timestamp
    Object.keys(grouped).forEach(contactId => {
      grouped[contactId].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });
    
    return grouped;
  }, [messages]);

  // Generar lista de contactos ordenada
  const sortedContacts = useMemo(() => {
    const contacts: Contact[] = [];
    
    Object.keys(messagesByContact).forEach(contactId => {
      const contactMessages = messagesByContact[contactId];
      if (contactMessages.length > 0) {
        const lastMessage = contactMessages[contactMessages.length - 1];
        contacts.push({
          id: contactId,
          phone: contactId,
          name: lastMessage.contact_name || contactId,
          lastMessage: lastMessage.content,
          lastMessageTime: lastMessage.timestamp,
          unreadCount: contactMessages.filter(m => m.direction === 'inbound' && m.status !== 'read').length
        });
      }
    });
    
    // Ordenar por última actividad
    return contacts.sort((a, b) => {
      const timeA = new Date(a.lastMessageTime || 0).getTime();
      const timeB = new Date(b.lastMessageTime || 0).getTime();
      return timeB - timeA;
    });
  }, [messagesByContact]);

  // Calcular contadores de no leídos
  const unreadCounts = useMemo(() => {
    const counts: { [contactId: string]: number } = {};
    
    Object.keys(messagesByContact).forEach(contactId => {
      const unread = messagesByContact[contactId].filter(
        m => m.direction === 'inbound' && m.status !== 'read'
      ).length;
      counts[contactId] = unread;
    });
    
    return counts;
  }, [messagesByContact]);

  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

  // Enviar mensaje
  const sendMessage = useCallback(async (contactId: string, content: string) => {
    if (!content.trim()) return;

    try {
      // Normalizar el número antes de enviar
      const normalizedContactId = normalizePhoneNumber(contactId).normalized;
      
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: normalizedContactId,
          message: content
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('ChatContext', 'Error enviando mensaje', errorData);
        throw new Error(errorData.error || 'Error enviando mensaje');
      }

      // Agregar mensaje localmente
      const newMessage: ChatWhatsAppMessage = {
        id: `temp-${Date.now()}`,
        content: content.trim(),
        contact_id: normalizedContactId,
        contact_name: selectedContact?.name,
        timestamp: new Date(),
        type: 'sent',
        direction: 'outbound',
        status: 'sent'
      };

      setMessages(prev => [...prev, newMessage]);
      logger.userAction('ChatContext', 'Mensaje enviado', contactId);
    } catch (error) {
      logger.error('ChatContext', 'Error en sendMessage', error);
      throw error;
    }
  }, [selectedContact]);

  // Marcar como leído
  const markAsRead = useCallback(async (contactId: string) => {
    try {
      console.log('📖 [ChatContext] Marcando mensajes como leídos para:', contactId);
      
      // Obtener el token de autenticación
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token;
      
      if (!accessToken) {
        console.error('❌ [ChatContext] No hay token de acceso para markAsRead');
        return;
      }
      
      const response = await fetch('/api/whatsapp/mark-as-read', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ contactId })
      });

      if (!response.ok) {
        console.error('❌ [ChatContext] Error en markAsRead API:', response.status);
        return;
      }

      // Actualizar estado local
      setMessages(prev => {
        const updated = prev.map(msg => 
          msg.contact_id === contactId && msg.direction === 'inbound' 
            ? { ...msg, status: 'read' as const }
            : msg
        );
        console.log('📖 [ChatContext] Mensajes actualizados localmente:', updated.filter(m => m.contact_id === contactId).length);
        return updated;
      });
      
      console.log('✅ [ChatContext] Mensajes marcados como leídos exitosamente');
      logger.userAction('ChatContext', 'Mensajes marcados como leídos', contactId);
    } catch (error) {
      console.error('❌ [ChatContext] Error marcando como leído:', error);
      logger.error('ChatContext', 'Error marcando como leído', error);
    }
  }, []);

  // Seleccionar contacto
  const selectContact = useCallback((contact: Contact) => {
    setSelectedContact(contact);
    
    // ✅ CORRECCIÓN RAÍZ: Marcar automáticamente como leído al seleccionar contacto
    if (contact.id) {
      console.log('🔍 [ChatContext] Marcando mensajes como leídos para contacto:', contact.id);
      markAsRead(contact.id);
    }
    
    logger.userAction('ChatContext', 'Contacto seleccionado', contact.id);
  }, [markAsRead]);

  // Abrir chat
  const openChat = useCallback(() => {
    setIsChatOpen(true);
    logger.userAction('ChatContext', 'Chat abierto');
  }, []);

  // Cerrar chat
  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    logger.userAction('ChatContext', 'Chat cerrado');
  }, []);

  // Reconectar SSE
  const forceReconnectSSE = useCallback(() => {
    logger.info('ChatContext', 'Forzando reconexión SSE');
    // Implementar lógica de reconexión si es necesaria
  }, []);

  // Agregar mensaje
  const addMessage = useCallback((contactId: string, message: ChatWhatsAppMessage) => {
    setMessages(prev => {
      // Evitar duplicados
      const exists = prev.some(m => m.id === message.id);
      if (exists) return prev;
      
      return [...prev, message];
    });
  }, []);

  // Actualizar estado de conexión
  useEffect(() => {
    setIsConnected(realtimeConnected);
    setConnectionStatus(realtimeConnected ? 'connected' : 'disconnected');
  }, [realtimeConnected]);

  // 🔧 NUEVO: Escuchar mensajes en tiempo real
  useEffect(() => {
    if (!isUserAuthenticated) {
      console.log('🔐 [ChatContext] Usuario no autenticado, saltando suscripción a tiempo real');
      return;
    }

    console.log('🔧 [ChatContext] Configurando listener de tiempo real...');

    const unsubscribe = addMessageListener((realtimeMessage: any) => {
      console.log('📨 [ChatContext] Mensaje recibido en tiempo real:', realtimeMessage);

      // ✅ CORRECCIÓN RAÍZ: Convertir mensaje de tiempo real a formato de chat
      const chatMessage: ChatWhatsAppMessage = {
        id: realtimeMessage.id || `realtime-${Date.now()}`,
        content: realtimeMessage.content || '',
        contact_id: realtimeMessage.contact_id || '',
        contact_name: realtimeMessage.contact_name || realtimeMessage.contact_id || '',
        timestamp: new Date(realtimeMessage.timestamp || Date.now()),
        // ✅ CORRECCIÓN: Usar message_type si existe, sino type
        type: (realtimeMessage.message_type || realtimeMessage.type || 'text') as 'sent' | 'received',
        // ✅ CORRECCIÓN: Determinar direction basado en message_type
        direction: (realtimeMessage.message_type === 'received' || realtimeMessage.type === 'received') ? 'inbound' : 'outbound',
        status: realtimeMessage.status || 'delivered'
      };

      console.log('📨 [ChatContext] Mensaje convertido:', chatMessage);

      // Agregar mensaje al estado
      setMessages(prev => {
        // Evitar duplicados por ID
        const exists = prev.some(m => m.id === chatMessage.id);
        if (exists) {
          console.log('🔄 [ChatContext] Mensaje ya existe, ignorando:', chatMessage.id);
          return prev;
        }
        
        console.log('✅ [ChatContext] Agregando nuevo mensaje al estado:', chatMessage.id);
        return [...prev, chatMessage];
      });

      // Mostrar notificación si el chat no está abierto
      if (!isChatOpen && Notification.permission === 'granted') {
        new Notification(`Nuevo mensaje de ${chatMessage.contact_name}`, {
          body: chatMessage.content,
          icon: '/favicon.ico',
          tag: `message-${chatMessage.id}`,  // ✅ Usar tag único para evitar duplicados
          requireInteraction: false
        });
      }
    });

    console.log('✅ [ChatContext] Listener de tiempo real configurado');

    return unsubscribe;
  }, [isUserAuthenticated, addMessageListener, isChatOpen]);

  const value: ChatContextType = {
    messages,
    messagesByContact,
    sortedContacts,
    selectedContact,
    unreadCounts,
    totalUnreadCount,
    isConnected,
    connectionStatus,
    isChatOpen,
    isUserAuthenticated,
    openChat,
    closeChat,
    sendMessage,
    markAsRead,
    selectContact,
    loadMessages,
    forceReconnectSSE,
    addMessage
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
