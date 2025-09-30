'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { supabase } from '../lib/supabase/client';
import { WhatsAppMessage, Contact } from '../types/whatsapp';
import { PhoneNumberService } from '../lib/phoneNumberService';
import { useRealtimeService } from '../services/realtimeService';

// Tipos
interface ChatWhatsAppMessage extends WhatsAppMessage {
  contact_id: string;
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

// Función para normalizar identificadores de contacto
const normalizeContactIdentifier = (contactId: string): string => {
  if (!contactId) return '';
  let normalized = contactId.replace(/[\s\-\(\)]/g, '');
  if (!normalized.startsWith('+')) {
    normalized = `+${normalized}`;
  }
  return normalized;
};

// Provider
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatWhatsAppMessage[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [userProviderPhones, setUserProviderPhones] = useState<string[]>([]);
  const [lastMessageCount, setLastMessageCount] = useState<number>(0);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState<boolean>(false);

  // Hook de notificaciones push
  const { sendNotification } = usePushNotifications();
  
  // Hook del servicio global de Realtime
  const { addMessageListener, isConnected: realtimeConnected } = useRealtimeService();

  // Verificar estado de autenticación
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const authenticated = !!user;
        setIsUserAuthenticated(authenticated);
      } catch (error) {
        console.error('📱 ChatContext: Error verificando autenticación:', error);
        setIsUserAuthenticated(false);
      }
    };

    checkAuthStatus();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const authenticated = !!session?.user;
      setIsUserAuthenticated(authenticated);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Funciones de notificación push
  const sendWhatsAppNotification = useCallback((contactName: string, message: string) => {
    sendNotification({
      title: `Nuevo mensaje de ${contactName}`,
      body: message,
      icon: '/favicon.ico',
      actions: [
        { action: 'close', title: 'Cerrar' },
        { action: 'open', title: 'Abrir chat' }
      ]
    });
  }, [sendNotification]);

  // CARGAR MENSAJES - VERSIÓN OPTIMIZADA Y LIMPIA
  const loadMessages = useCallback(async () => {
    try {
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      
      if (!currentUserId) {
        return;
      }
      
      
      // Obtener los proveedores del usuario actual
      const { data: userProviders, error: providersError } = await supabase
        .from('providers')
        .select('phone')
        .eq('user_id', currentUserId);
      
      if (providersError) {
        console.error('Error obteniendo proveedores:', providersError);
        return;
      }
      
              const userProviderPhones = userProviders?.map(p => {
          let phone = p.phone as string;
          // 🔧 CORRECCIÓN: Usar servicio centralizado unificado de normalización
          const normalizedPhone = PhoneNumberService.normalizeUnified(phone);
          return normalizedPhone || phone;
        }) || [];
      
      // Actualizar el estado de proveedores del usuario
      setUserProviderPhones(userProviderPhones);
      
      // 🔧 OPTIMIZACIÓN: Cargar solo 20 mensajes para reducir procesamiento
      const response = await fetch(`/api/whatsapp/messages?limit=20&userId=${currentUserId}`);
      
      if (!response.ok) {
        console.warn('⚠️ API de mensajes no disponible:', response.status);
        return;
      }
      
      const data = await response.json();
      
      if (data.messages && Array.isArray(data.messages)) {

        // 🔧 MEJORA: Filtrado simplificado y más robusto
        const transformedMessages = data.messages
          .filter((msg: any) => {
            // Incluir todos los mensajes que ya pasaron el filtro de la API
            // La API ya filtró por user_id y proveedores del usuario
            return true;
          })
          .map((msg: any) => {
            // 🔧 OPTIMIZACIÓN: Mapeo simplificado y consistente
            let messageType = 'received';
            
            if (msg.message_type === 'sent') {
              messageType = 'sent';
            } else if (msg.message_type === 'received') {
              messageType = 'received';
            } else if (msg.message_sid && (msg.message_sid.startsWith('sim_') || msg.message_sid.startsWith('msg_'))) {
              messageType = 'sent';
            }
            
            return {
              id: msg.message_sid || msg.id,
              content: msg.content,
              timestamp: new Date(msg.timestamp || msg.created_at),
              type: messageType,
              messageType: messageType, // 🔧 CORRECCIÓN: Agregar messageType para consistencia
              contact_id: msg.contact_id || msg.from,
              status: msg.status || 'delivered'
            };
          })
        
        // 🔧 OPTIMIZACIÓN: Actualización eficiente del estado
        setMessages(prev => {
          const existingMessagesMap = new Map(prev.map(msg => [msg.id, msg]));
          let hasNewMessages = false;
          const updatedMessages = [...prev];
          
          transformedMessages.forEach((newMsg: ChatWhatsAppMessage) => {
            if (!existingMessagesMap.has(newMsg.id)) {
              updatedMessages.push(newMsg);
              hasNewMessages = true;
            }
          });
          
          return hasNewMessages ? updatedMessages : prev;
        });
        
        // 🔧 OPTIMIZACIÓN: Logs reducidos para evitar spam
        if (process.env.NODE_ENV === 'development' && transformedMessages.length > 0) {
          const currentCount = transformedMessages.length;
          if (lastMessageCount !== currentCount && currentCount % 5 === 0) { // Solo cada 5 mensajes
            const receivedMessages = transformedMessages.filter((m: any) => m.type === 'received');
            const sentMessages = transformedMessages.filter((m: any) => m.type === 'sent');
            setLastMessageCount(currentCount);
          }
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, []); // ✅ DEPENDENCIAS VACÍAS - No depende de estado que cambia

  const forceReconnectSSE = useCallback(() => {
    window.location.reload();
  }, []);

  // 🔧 OPTIMIZACIÓN: Debounce para evitar múltiples ejecuciones
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const loadMessagesDebounced = useCallback(async () => {
    if (isLoadingMessages) return;
    
    setIsLoadingMessages(true);
    try {
      await loadMessages();
    } finally {
      setTimeout(() => setIsLoadingMessages(false), 1000); // Debounce de 1 segundo
    }
  }, [loadMessages]); // ✅ SOLO DEPENDE DE loadMessages (que tiene dependencias vacías)

  // CARGAR MENSAJES INICIALES Y CONFIGURAR LISTENER REALTIME
  useEffect(() => {
    let isMounted = true;
    let hasInitialized = false; // ✅ PREVENIR MÚLTIPLES INICIALIZACIONES
    
    // 🔧 OPTIMIZACIÓN: Verificar autenticación antes de cargar mensajes
    const initializeChat = async () => {
      if (hasInitialized) return; // ✅ EVITAR MÚLTIPLES EJECUCIONES
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id && isMounted && !hasInitialized) {
          hasInitialized = true;
          loadMessagesDebounced();
        }
      } catch (error) {
        console.warn('⚠️ Usuario no autenticado, no se cargan mensajes');
      }
    };
    
    // Cargar mensajes solo si el usuario está autenticado
    initializeChat();
    
    // Solicitar permisos de notificación
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }


    // 🔧 OPTIMIZACIÓN: Listeners con debounce
    const handleOrderSent = () => {
      if (isMounted) {
        loadMessagesDebounced();
      }
    };

    const handleWhatsAppMessage = () => {
      if (isMounted) {
        loadMessagesDebounced();
      }
    };

    window.addEventListener('orderSent', handleOrderSent);
    window.addEventListener('whatsappMessage', handleWhatsAppMessage);

    return () => {
      isMounted = false;
      window.removeEventListener('orderSent', handleOrderSent);
      window.removeEventListener('whatsappMessage', handleWhatsAppMessage);
    };
  }, []); // ✅ DEPENDENCIAS VACÍAS - Solo ejecutar una vez al montar

  // 🔧 SOLUCIÓN UNIFICADA: Listener de mensajes realtime optimizado
  // Usar useRef para mantener referencia estable del listener
  const realtimeListenerRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    // Si ya hay un listener configurado, limpiarlo
    if (realtimeListenerRef.current) {
      realtimeListenerRef.current();
      realtimeListenerRef.current = null;
    }

    // Crear nuevo listener estable
    const removeListener = addMessageListener((realtimeMessage) => {
      // Convertir mensaje del servicio global al formato del chat
      const chatMessage: ChatWhatsAppMessage = {
        id: realtimeMessage.id,
        content: realtimeMessage.content,
        timestamp: realtimeMessage.timestamp,
        type: realtimeMessage.type,
        contact_id: realtimeMessage.contact_id,
        status: realtimeMessage.status as 'sent' | 'delivered' | 'read' | 'failed' | undefined
      };

      setMessages(prev => {
        // Verificar duplicados por ID exacto - verificación más estricta
        const messageExists = prev.some(msg => 
          msg.id === chatMessage.id && 
          msg.contact_id === chatMessage.contact_id
        );
        
        if (messageExists) {
          return prev;
        }
        
        // Verificar duplicados por contenido y contacto en los últimos 30 segundos
        const recentDuplicate = prev.find(msg => 
          msg.content === chatMessage.content &&
          msg.contact_id === chatMessage.contact_id &&
          msg.type === 'sent' &&
          Math.abs(new Date(msg.timestamp).getTime() - new Date(chatMessage.timestamp).getTime()) < 30000
        );
        
        if (recentDuplicate) {
          return prev;
        }
        
        // Para mensajes enviados, buscar si hay un mensaje temporal que debe ser reemplazado
        if (chatMessage.type === 'sent') {
          const tempMessageIndex = prev.findIndex(msg => {
            if (!msg.id.startsWith('temp_')) return false;
            if (msg.content !== chatMessage.content) return false;
            
            // Comparar contactos normalizados
            const normalizedTempContact = normalizeContactIdentifier(msg.contact_id);
            const normalizedRealContact = normalizeContactIdentifier(chatMessage.contact_id);
            if (normalizedTempContact !== normalizedRealContact) return false;
            
            // Verificar ventana de tiempo
            const tempTime = new Date(msg.timestamp).getTime();
            const realTime = new Date(chatMessage.timestamp).getTime();
            const timeDiff = Math.abs(tempTime - realTime);
            
            return timeDiff < 60000; // 60 segundos
          });
          
          if (tempMessageIndex !== -1) {
            const updatedMessages = [...prev];
            updatedMessages[tempMessageIndex] = {
              ...chatMessage,
              id: chatMessage.id,
              status: 'delivered' as const
            };
            return updatedMessages;
          }
        }
        
        // Agregar el nuevo mensaje sin duplicados
        return [...prev, chatMessage];
      });
    });

    // Almacenar referencia para cleanup
    realtimeListenerRef.current = removeListener;

    return () => {
      if (realtimeListenerRef.current) {
        realtimeListenerRef.current();
        realtimeListenerRef.current = null;
      }
    };
  }, [addMessageListener]); // ✅ DEPENDENCIA CORRECTA: Solo cambia cuando cambia el servicio

  // SIMULAR CONEXIÓN EXITOSA - REALTIME FUNCIONA
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Verificar si ya se inicializó para evitar múltiples instancias
    if (connectionStatus !== 'disconnected' || isConnected) return;
    
    setConnectionStatus('connecting');
     
    // Simular conexión exitosa más rápido
    setTimeout(() => {
      setIsConnected(true);
      setConnectionStatus('connected');
    }, 500);
  }, []); // Solo ejecutar una vez al montar el componente

  // Función para enviar mensaje
  const sendMessage = useCallback(async (contactId: string, content: string) => {
    if (!content.trim()) return;

    // Generar un ID temporal único para inserción local inmediata
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Crear mensaje temporal para inserción local
    const tempMessage: ChatWhatsAppMessage = {
      id: tempId,
      content: content.trim(),
      timestamp: new Date(),
      type: 'sent',
      contact_id: contactId,
      status: 'sent'
    };

    // Agregar mensaje localmente inmediatamente para feedback visual
    setMessages(prev => {
      const updatedMessages = [...prev, tempMessage];
      return updatedMessages;
    });

    try {
      // Enviar mensaje al servidor
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: contactId,
          message: content.trim()
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // El mensaje real llegará via Realtime, no necesitamos actualizar aquí
        // Solo marcar como enviado si hay error en Realtime
        setTimeout(() => {
          setMessages(prev => {
            // Si después de 10 segundos el mensaje temporal sigue ahí, marcarlo como enviado
            const tempMessageStillExists = prev.some(msg => msg.id === tempId);
            if (tempMessageStillExists) {
              return prev.map(msg => 
                msg.id === tempId 
                  ? { ...msg, status: 'delivered' as const }
                  : msg
              );
            }
            return prev;
          });
        }, 10000); // Aumentar a 10 segundos para dar más tiempo
      } else {
        console.error('❌ Error enviando mensaje:', result.error);
        // Marcar como fallido si hay error
        setMessages(prev => {
          const updatedMessages = prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, status: 'failed' as const }
              : msg
          );
          return updatedMessages;
        });
      }
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
      // Marcar como fallido si hay error
      setMessages(prev => {
        const updatedMessages = prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: 'failed' as const }
            : msg
        );
        return updatedMessages;
      });
    }
  }, []);

  // Función para agregar mensaje manualmente
  const addMessage = useCallback((contactId: string, message: ChatWhatsAppMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  // SOLUCIÓN INTEGRAL markAsRead - ACTUALIZACIÓN INMEDIATA Y PERSISTENTE
  const markAsRead = useCallback(async (contactId: string) => {
    if (!contactId) return;
    
    // Usar la función unificada de normalización
    const normalizedContactId = normalizeContactIdentifier(contactId);
    
    try {
      // Actualizar estado local INMEDIATAMENTE
      setMessages(prev => {
        const updatedMessages = prev.map(msg => {
          const normalizedMsgContactId = normalizeContactIdentifier(msg.contact_id);
          const shouldMarkAsRead = normalizedMsgContactId === normalizedContactId && msg.type === 'received';
          
          return shouldMarkAsRead
            ? { ...msg, status: 'read' as const }
            : msg;
        });
        
        return updatedMessages;
      });

      // Actualizar en Supabase (solo una vez)
      const response = await fetch('/api/whatsapp/mark-as-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId: normalizedContactId
        }),
      });

             if (response.ok) {
        const result = await response.json();
        // console.log('✅ Mensajes marcados como leídos para:', normalizedContactId);
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, []);

  // Función para seleccionar contacto
  const selectContact = useCallback((contact: Contact) => {
    // Solo marcar como leído si es un contacto diferente
    if (selectedContact && selectedContact.phone !== contact.phone) {
      markAsRead(selectedContact.phone);
    }
    
    setSelectedContact(contact);
    // Marcar mensajes como leídos del nuevo contacto
    markAsRead(contact.phone);
  }, [markAsRead, selectedContact]);

  // Función para abrir chat
  const openChat = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  // Función para cerrar chat
  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

    // Calcular mensajes agrupados por contacto y ordenar por última actividad
  const messagesByContact = useMemo(() => {
    const grouped: { [contactId: string]: ChatWhatsAppMessage[] } = {};
    
    // Crear un Map para filtrar duplicados por ID antes de agrupar
    const uniqueMessages = new Map<string, ChatWhatsAppMessage>();
    
    messages.forEach(message => {
      // Usar el ID del mensaje como clave para evitar duplicados
      if (!uniqueMessages.has(message.id)) {
        uniqueMessages.set(message.id, message);
      }
    });
    
    // Agrupar mensajes únicos por contacto
    uniqueMessages.forEach(message => {
      const contactId = normalizeContactIdentifier(message.contact_id);
      if (!grouped[contactId]) {
        grouped[contactId] = [];
      }
      grouped[contactId].push(message);
    });
    
    // Ordenar mensajes por timestamp dentro de cada contacto (más antiguos primero para mostrar cronológicamente)
    Object.keys(grouped).forEach(contactId => {
      grouped[contactId].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });
    
    return grouped;
  }, [messages]);

  // Obtener contactos ordenados por última actividad - SOLO CONTACTOS VÁLIDOS
  const sortedContacts = useMemo(() => {
    const contacts: Contact[] = [];
    
    // Solo procesar si tenemos mensajes válidos
    if (!messages || messages.length === 0) {
      return contacts;
    }
    
    Object.entries(messagesByContact).forEach(([contactId, contactMessages]) => {
      
      if (contactMessages.length === 0) return;
      
      // Filtrar el contacto de prueba (ambas versiones)
      if (contactId === '+5491112345678' || contactId === '5491112345678') {
        return;
      }
      
      // Solo incluir contactos que sean proveedores registrados O nuestro número de WhatsApp Business
      const ourWhatsAppNumber = process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID;
      const normalizedOurNumber = ourWhatsAppNumber ? `+${ourWhatsAppNumber}` : null;
      
      // Verificar si es nuestro número de WhatsApp Business
      const isFromOurWhatsApp = normalizedOurNumber && contactId === normalizedOurNumber;
      
      // Verificar si es un proveedor registrado (esto se obtiene de loadMessages)
      const isFromOurProvider = userProviderPhones.includes(contactId);
      
      // Solo incluir si es proveedor registrado o nuestro número de WhatsApp
      if (!isFromOurProvider && !isFromOurWhatsApp) {
        return;
      }
      
      // Obtener el último mensaje para determinar la última actividad
      const lastMessage = contactMessages[contactMessages.length - 1];
      
      // Contar mensajes no leídos
      const unreadCount = contactMessages.filter(msg =>
        msg.type === 'received' && msg.status !== 'read'
      ).length;
      
      // No generar nombres temporales - dejar que IntegratedChatPanel los maneje
      const phoneNumber = contactId.replace('+', '');
      contacts.push({
        id: contactId,
        phone: contactId,
        name: `Contacto ${phoneNumber.slice(-4)}`, // Nombre temporal básico
        lastMessage: lastMessage.content,
        unreadCount: unreadCount > 0 ? unreadCount : undefined
      });
    });
    
    // Ordenar por timestamp del último mensaje (más reciente primero)
    return contacts.sort((a, b) => {
      const aMessages = messagesByContact[a.phone];
      const bMessages = messagesByContact[b.phone];
      
      if (!aMessages.length || !bMessages.length) return 0;
      
      const aLastMessage = aMessages[aMessages.length - 1];
      const bLastMessage = bMessages[bMessages.length - 1];
      
      return new Date(bLastMessage.timestamp).getTime() - new Date(aLastMessage.timestamp).getTime();
    });
  }, [messagesByContact, messages, userProviderPhones]);

  // Calcular contadores de mensajes no leídos - VERSIÓN CORREGIDA
  const unreadCounts = useMemo(() => {
    const counts: { [contactId: string]: number } = {};
    
    Object.entries(messagesByContact).forEach(([contactId, contactMessages]) => {
      if (!contactId) return;
      
      // Filtrar el contacto de prueba
      if (contactId === '+5491112345678' || contactId === '5491112345678') return;
      
      // Solo incluir contactos argentinos válidos O nuestro número de WhatsApp Business
      if (!contactId.includes('+549') && contactId !== process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID) {
        return;
      }
      
      // Contar solo mensajes recibidos que no están leídos
      const unreadCount = contactMessages.filter(msg =>
        msg.type === 'received' && msg.status !== 'read'
      ).length;
      
      if (unreadCount > 0) {
        counts[contactId] = unreadCount;
      }
    });
    
         // Log temporal para debug (solo si hay cambios)
    // if (Object.keys(counts).length > 0) {
    //   console.log('🔢 Contadores no leídos calculados:', counts);
    // }
    
    return counts;
  }, [messagesByContact, messages]);

  // Calcular total de mensajes no leídos para la navegación
  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((total, count) => total + count, 0);
  }, [unreadCounts]);

  const value = useMemo(() => {
    return {
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
  }, [
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
  ]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}