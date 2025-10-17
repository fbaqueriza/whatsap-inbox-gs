'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase/client';

interface KapsoMessage {
  id: string;
  message_id: string;
  conversation_id: string;
  from_number: string;
  to_number: string;
  content: string;
  message_type: string;
  status: string;
  timestamp: string;
  media_url?: string;
  media_type?: string;
  user_id: string;
  created_at: string;
}

interface KapsoConversation {
  id: string;
  conversation_id: string;
  phone_number: string;
  contact_name: string;
  status: string;
  last_message_at: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface KapsoContact {
  id: string;
  phone_number: string;
  contact_name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const useKapsoRealtime = () => {
  // Por ahora, usar un usuario fijo para testing
  // Obtener el ID del usuario actual desde Supabase Auth
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [messages, setMessages] = useState<KapsoMessage[]>([]);
  const [conversations, setConversations] = useState<KapsoConversation[]>([]);
  const [contacts, setContacts] = useState<KapsoContact[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const messageListeners = useRef(new Set<(message: KapsoMessage) => void>());
  const conversationListeners = useRef(new Set<(conversation: KapsoConversation) => void>());

  const addMessageListener = useCallback((callback: (message: KapsoMessage) => void) => {
    messageListeners.current.add(callback);
    return () => messageListeners.current.delete(callback);
  }, []);

  const addConversationListener = useCallback((callback: (conversation: KapsoConversation) => void) => {
    conversationListeners.current.add(callback);
    return () => conversationListeners.current.delete(callback);
  }, []);

  // Obtener el usuario actual
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error('❌ Error obteniendo usuario:', error);
          // Fallback al usuario que tiene datos en Kapso
          setCurrentUserId('39a01409-56ed-4ae6-884a-148ad5edb1e1');
          console.log('👤 [useKapsoRealtime] Usuario fallback por error:', '39a01409-56ed-4ae6-884a-148ad5edb1e1');
          return;
        }
        // Usar el usuario actual logueado
        if (user) {
          setCurrentUserId(user.id);
          console.log('👤 [useKapsoRealtime] Usuario actual:', user.id);
        } else {
          // Fallback al usuario que tiene datos en Kapso
          setCurrentUserId('39a01409-56ed-4ae6-884a-148ad5edb1e1');
          console.log('👤 [useKapsoRealtime] Usuario fallback (no autenticado):', '39a01409-56ed-4ae6-884a-148ad5edb1e1');
        }
      } catch (err) {
        console.error('❌ Error en getCurrentUser:', err);
        // Fallback al usuario que tiene datos en Kapso
        setCurrentUserId('39a01409-56ed-4ae6-884a-148ad5edb1e1');
        console.log('👤 [useKapsoRealtime] Usuario fallback por excepción:', '39a01409-56ed-4ae6-884a-148ad5edb1e1');
      }
    };

    getCurrentUser();
  }, []);

         const handleNewMessage = useCallback((payload: any) => {
           console.log('🔄 [useKapsoRealtime] Nuevo mensaje recibido:', payload);
           const newMessage = payload.new as KapsoMessage;
           
           // 🔧 CORRECCIÓN: Aceptar mensajes del usuario actual O mensajes sin user_id
           const isValidMessage = newMessage.user_id === currentUserId || !newMessage.user_id || !currentUserId;
           
           if (isValidMessage) {
             console.log('✅ [useKapsoRealtime] Agregando mensaje:', newMessage.id, newMessage.content);
             setMessages(prev => {
               if (prev.some(msg => msg.id === newMessage.id)) {
                 console.log('⚠️ [useKapsoRealtime] Mensaje ya existe, ignorando:', newMessage.id);
                 return prev;
               }
               console.log('✅ [useKapsoRealtime] Mensaje agregado exitosamente');
               return [...prev, newMessage];
             });
             messageListeners.current.forEach(cb => cb(newMessage));
           } else {
             console.log('⚠️ [useKapsoRealtime] Mensaje ignorado - usuario diferente:', newMessage.user_id, 'vs', currentUserId);
           }
         }, [currentUserId]);

  const handleUpdateMessage = useCallback((payload: any) => {
    const updatedMessage = payload.new as KapsoMessage;
    if (updatedMessage.user_id === currentUserId) {
      setMessages(prev => prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg));
      messageListeners.current.forEach(cb => cb(updatedMessage));
    }
  }, [currentUserId]);

  const handleNewConversation = useCallback((payload: any) => {
    const newConversation = payload.new as KapsoConversation;
    if (newConversation.user_id === currentUserId) {
      setConversations(prev => {
        if (prev.some(conv => conv.id === newConversation.id)) return prev;
        return [...prev, newConversation];
      });
      conversationListeners.current.forEach(cb => cb(newConversation));
    }
  }, [currentUserId]);

  const handleUpdateConversation = useCallback((payload: any) => {
    const updatedConversation = payload.new as KapsoConversation;
    if (updatedConversation.user_id === currentUserId) {
      setConversations(prev => prev.map(conv => conv.id === updatedConversation.id ? updatedConversation : conv));
      conversationListeners.current.forEach(cb => cb(updatedConversation));
    }
  }, [currentUserId]);

  // Cargar datos iniciales
  const loadInitialData = useCallback(async () => {
    if (!currentUserId) {
      console.log('⚠️ [useKapsoRealtime] No se puede cargar datos: currentUserId es null');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 [useKapsoRealtime] Cargando datos iniciales para userId:', currentUserId);

      // Usar endpoint API para obtener datos de Kapso
      const response = await fetch(`/api/kapso/data?userId=${currentUserId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error obteniendo datos de Kapso');
      }

      if (result.success && result.data) {
        setConversations(result.data.conversations || []);
        setContacts(result.data.contacts || []);
        setMessages(result.data.messages || []);
        
        console.log('✅ [useKapsoRealtime] Datos cargados exitosamente:', {
          conversations: result.data.conversations?.length || 0,
          contacts: result.data.contacts?.length || 0,
          messages: result.data.messages?.length || 0
        });
        
        // 🔧 DEBUG: Mostrar algunos mensajes para verificar
        if (result.data.messages && result.data.messages.length > 0) {
          console.log('📱 [useKapsoRealtime] Primeros mensajes cargados:');
          result.data.messages.slice(0, 3).forEach((msg, index) => {
            console.log(`   ${index + 1}. ${msg.content} (${msg.timestamp})`);
          });
        }
      } else {
        console.log('⚠️ [useKapsoRealtime] No se recibieron datos válidos');
      }

    } catch (err) {
      console.error('❌ Error cargando datos iniciales:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const refreshMessages = useCallback(async (conversationId: string) => {
    if (!currentUserId) return;

    try {
      // Recargar todos los datos para obtener mensajes actualizados
      await loadInitialData();
    } catch (err) {
      console.error('❌ Error cargando mensajes:', err);
    }
  }, [currentUserId, loadInitialData]);

  const refreshConversations = useCallback(async () => {
    await loadInitialData();
  }, [loadInitialData]);

  const refreshContacts = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const { data: contactsData, error: contError } = await supabase
        .from('kapso_contacts')
        .select('*')
        .eq('user_id', currentUserId);

      if (contError) throw contError;
      setContacts(contactsData || []);
    } catch (err) {
      console.error('❌ Error cargando contactos:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      console.log('⚠️ [useKapsoRealtime] No hay currentUserId, desconectando...');
      setIsConnected(false);
      return;
    }

    console.log('🔄 [useKapsoRealtime] Inicializando para userId:', currentUserId);

    // Cargar datos iniciales
    loadInitialData();

    setIsConnected(true);

    // 🔧 SOLUCIÓN SIMPLE: Supabase Realtime directo sin filtros complejos
    let messagesChannel: any = null;
    let conversationsChannel: any = null;

    const setupRealtimeSubscriptions = () => {
      try {
        console.log('📡 [useKapsoRealtime] Configurando Supabase Realtime...');

        // 1. Suscripción a mensajes - escuchar TODOS los mensajes
        messagesChannel = supabase
          .channel(`kapso_messages_all`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'kapso_messages'
            },
            (payload) => {
              console.log('📡 [useKapsoRealtime] Nuevo mensaje INSERT:', payload);
              
              // Filtrar por usuario en el handler
              const message = payload.new as any;
              if (message && message.user_id === currentUserId) {
                console.log('✅ [useKapsoRealtime] Mensaje válido para usuario actual');
                handleNewMessage(payload);
              } else {
                console.log('⚠️ [useKapsoRealtime] Mensaje ignorado - usuario diferente:', message?.user_id, 'vs', currentUserId);
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'kapso_messages'
            },
            (payload) => {
              console.log('📡 [useKapsoRealtime] Mensaje UPDATE:', payload);
              
              const message = payload.new as any;
              if (message && message.user_id === currentUserId) {
                handleUpdateMessage(payload);
              }
            }
          )
          .subscribe((status, err) => {
            console.log(`📡 [useKapsoRealtime] Mensajes status: ${status}`);
            if (status === 'SUBSCRIBED') {
              console.log('✅ [useKapsoRealtime] Suscripción a mensajes activa');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ [useKapsoRealtime] Error en suscripción a mensajes:', err);
            } else if (status === 'TIMED_OUT') {
              console.warn('⏰ [useKapsoRealtime] Timeout en suscripción a mensajes');
            }
          });

        // 2. Suscripción a conversaciones - escuchar TODAS las conversaciones
        conversationsChannel = supabase
          .channel(`kapso_conversations_all`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'kapso_conversations'
            },
            (payload) => {
              console.log('📡 [useKapsoRealtime] Nueva conversación INSERT:', payload);
              
              const conversation = payload.new as any;
              if (conversation && conversation.user_id === currentUserId) {
                console.log('✅ [useKapsoRealtime] Conversación válida para usuario actual');
                handleNewConversation(payload);
              } else {
                console.log('⚠️ [useKapsoRealtime] Conversación ignorada - usuario diferente:', conversation?.user_id, 'vs', currentUserId);
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'kapso_conversations'
            },
            (payload) => {
              console.log('📡 [useKapsoRealtime] Conversación UPDATE:', payload);
              
              const conversation = payload.new as any;
              if (conversation && conversation.user_id === currentUserId) {
                handleUpdateConversation(payload);
              }
            }
          )
          .subscribe((status, err) => {
            console.log(`📡 [useKapsoRealtime] Conversaciones status: ${status}`);
            if (status === 'SUBSCRIBED') {
              console.log('✅ [useKapsoRealtime] Suscripción a conversaciones activa');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ [useKapsoRealtime] Error en suscripción a conversaciones:', err);
            } else if (status === 'TIMED_OUT') {
              console.warn('⏰ [useKapsoRealtime] Timeout en suscripción a conversaciones');
            }
          });

      } catch (error) {
        console.error('❌ [useKapsoRealtime] Error configurando suscripciones:', error);
      }
    };

    // Inicializar suscripciones
    setupRealtimeSubscriptions();

    return () => {
      console.log('🔌 [useKapsoRealtime] Desconectando suscripciones...');
      if (messagesChannel) {
        messagesChannel.unsubscribe();
      }
      if (conversationsChannel) {
        conversationsChannel.unsubscribe();
      }
      setIsConnected(false);
    };
  }, [currentUserId, handleNewMessage, handleUpdateMessage, handleNewConversation, handleUpdateConversation, loadInitialData]);

  return {
    messages,
    conversations,
    contacts,
    addMessageListener,
    addConversationListener,
    isConnected,
    isLoading,
    error,
    refreshMessages,
    refreshConversations,
    refreshContacts,
    currentUserId,
  };
};