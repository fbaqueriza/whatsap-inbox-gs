'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { supabase } from '../lib/supabase/client';
import { WhatsAppMessage, Contact } from '../types/whatsapp';

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

  // Hook de notificaciones push
  const { sendNotification } = usePushNotifications();

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

  // CARGAR MENSAJES - VERSIÓN OPTIMIZADA CON NOTIFICACIONES
  const loadMessages = useCallback(async () => {
    try {
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      
      if (!currentUserId) {
        // console.log('No hay usuario autenticado, no se pueden cargar mensajes');
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
        if (phone && !phone.startsWith('+')) {
          phone = `+${phone}`;
        }
        return phone;
      }) || [];
      
      const response = await fetch('/api/whatsapp/messages');
      const data = await response.json();
      
      if (data.messages && Array.isArray(data.messages)) {
        const transformedMessages = data.messages
          .map((msg: any) => {
            // Determinar el tipo de mensaje correctamente
            let messageType = 'received';
            
            // Si el mensaje tiene message_type explícito, usarlo
            if (msg.message_type === 'sent') {
              messageType = 'sent';
            } else if (msg.message_type === 'received') {
              messageType = 'received';
            } else {
              // Si no hay message_type explícito, intentar determinar por otros campos
              // Los mensajes enviados desde la plataforma suelen tener un ID que empieza con 'sim_' o 'msg_'
              if (msg.message_sid && (msg.message_sid.startsWith('sim_') || msg.message_sid.startsWith('msg_'))) {
                messageType = 'sent';
              }
            }
            
            return {
              id: msg.message_sid || msg.id, // Usar message_sid (ID de Meta) como prioridad
              content: msg.content,
              timestamp: new Date(msg.timestamp || msg.created_at),
              type: messageType,
              contact_id: msg.contact_id || msg.from,
              status: msg.status || 'delivered'
            };
          })
          // Filtrar mensajes que correspondan a los proveedores del usuario actual
          // O que vengan de nuestro propio número de WhatsApp Business
          .filter((msg: any) => {
            const contactId = normalizeContactIdentifier(msg.contact_id);
            const ourWhatsAppNumber = process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID;
            const normalizedOurNumber = ourWhatsAppNumber ? `+${ourWhatsAppNumber}` : null;
            
            const isFromOurProvider = userProviderPhones.includes(contactId);
            const isFromOurWhatsApp = normalizedOurNumber && contactId === normalizedOurNumber;
            const isIncluded = isFromOurProvider || isFromOurWhatsApp;
            
            return isIncluded;
          });
        
        // PRESERVAR MENSAJES LOCALES Y DETECTAR NUEVOS MENSAJES
        setMessages(prev => {
          // Crear un mapa de mensajes existentes por ID para evitar duplicados
          const existingMessagesMap = new Map(prev.map(msg => [msg.id, msg]));
          
          // Agregar solo mensajes nuevos que no existan
          let hasNewMessages = false;
          const updatedMessages = [...prev];
          
          transformedMessages.forEach((newMsg: ChatWhatsAppMessage) => {
            // Verificar si el mensaje ya existe por ID exacto
            const isDuplicate = existingMessagesMap.has(newMsg.id);
            
            // Para mensajes enviados, también verificar si hay un mensaje temporal que debe ser reemplazado
            if (newMsg.type === 'sent') {
              const tempMessageIndex = updatedMessages.findIndex(msg => 
                msg.id.startsWith('temp_') && 
                msg.content === newMsg.content && 
                msg.contact_id === newMsg.contact_id
              );
              
              if (tempMessageIndex !== -1) {
                // Reemplazar mensaje temporal con el real
                updatedMessages[tempMessageIndex] = newMsg;
                hasNewMessages = true;
                return;
              }
            }
            
            if (!isDuplicate) {
              updatedMessages.push(newMsg);
              hasNewMessages = true;
            }
          });
          
          if (hasNewMessages) {
            // Los mensajes ya vienen ordenados del API, no reordenar
            return updatedMessages;
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, []);

  const forceReconnectSSE = useCallback(() => {
    window.location.reload();
  }, []);

    // CARGAR MENSAJES INICIALES Y POLLING OPTIMIZADO
  useEffect(() => {
    let isMounted = true;
    
    // Cargar inmediatamente
    if (isMounted) {
      loadMessages();
    }
    
    // Solicitar permisos de notificación
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Listener para actualizar mensajes cuando se envía una orden
    const handleOrderSent = () => {
      if (isMounted) {
        setTimeout(() => {
          loadMessages();
        }, 1000);
      }
    };

    window.addEventListener('orderSent', handleOrderSent);

    // Recargar cada 3 segundos para reducir carga y logs
    const interval = setInterval(() => {
      if (isMounted) {
        loadMessages();
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('orderSent', handleOrderSent);
    };
  }, []); // Remover loadMessages de las dependencias para evitar múltiples inicializaciones

  // SIMULAR CONEXIÓN EXITOSA - POLLING FUNCIONA
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Verificar si ya se inicializó para evitar múltiples instancias
    if (connectionStatus !== 'disconnected' || isConnected) return;
    
         // console.log('🔄 Iniciando sistema de mensajes con polling...');
     setConnectionStatus('connecting');
     
     // Simular conexión exitosa más rápido
     setTimeout(() => {
       setIsConnected(true);
       setConnectionStatus('connected');
       // console.log('✅ Sistema de mensajes conectado exitosamente');
     }, 500);
  }, []); // Solo ejecutar una vez al montar el componente

  // Función para enviar mensaje
  const sendMessage = useCallback(async (contactId: string, content: string) => {
    if (!content.trim()) return;

    // Generar un ID temporal que será reemplazado por el ID real de la base de datos
    const tempId = `temp_${Date.now()}`;
    
    const newMessage: ChatWhatsAppMessage = {
      id: tempId,
      content: content.trim(),
      timestamp: new Date(),
      type: 'sent',
      contact_id: contactId,
      status: 'sent'
    };

    // Agregar mensaje localmente inmediatamente al final (más reciente)
    setMessages(prev => {
      const updatedMessages = [...prev, newMessage];
      // Los mensajes ya vienen ordenados del API, no reordenar
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
        // Actualizar el mensaje local con el ID real de la base de datos
        const realMessageId = result.messageId || `msg_${Date.now()}`;
        
        setMessages(prev => {
          const updatedMessages = prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, id: realMessageId, status: 'delivered' as const }
              : msg
          );
          // Los mensajes ya vienen ordenados del API, no reordenar
          return updatedMessages;
        });
      } else {
        // Marcar como fallido si hay error
        setMessages(prev => {
          const updatedMessages = prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, status: 'failed' as const }
              : msg
          );
          // Los mensajes ya vienen ordenados del API, no reordenar
          return updatedMessages;
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Marcar como fallido si hay error
      setMessages(prev => {
        const updatedMessages = prev.map(msg => 
          msg.id === newMessage.id 
            ? { ...msg, status: 'failed' as const }
            : msg
        );
        // Los mensajes ya vienen ordenados del API, no reordenar
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
      
      // Solo incluir contactos argentinos válidos O nuestro número de WhatsApp Business
      if (!contactId.includes('+549') && contactId !== process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID) {
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
  }, [messagesByContact, messages]);

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