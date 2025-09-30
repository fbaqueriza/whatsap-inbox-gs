'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Phone, Video, MoreVertical, Plus, Search, MessageSquare, X, FileText, Download, Image, File, Smile, Mic, RefreshCw, MessageCircle } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import { useGlobalChat } from '../contexts/GlobalChatContext';
import { WhatsAppMessage, Contact } from '../types/whatsapp';
import React from 'react';
import WhatsAppStatusIndicator from './WhatsAppStatusIndicator';
// Función simplificada para normalizar números de teléfono
const normalizeContactIdentifier = (identifier: string): string => {
  if (!identifier) return '';
  
  // Remover todos los caracteres no numéricos excepto el +
  let normalized = identifier.replace(/[^\d+]/g, '');
  
  // Si no empieza con +, agregarlo
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  
  // Para números que ya tienen el formato correcto, devolverlos tal como están
  if (normalized.startsWith('+54') || normalized.startsWith('+67')) {
    return normalized;
  }
  
  // Si es un número local sin código de país, asumir Argentina
  if (normalized.startsWith('+') && normalized.length === 11) {
    return '+54' + normalized.substring(1);
  }
  
  return normalized;
};
import NotificationPermission from './NotificationPermission';

interface IntegratedChatPanelProps {
  providers: any[];
  isOpen: boolean;
  onClose: () => void;
}

// Componente optimizado para contactos
const ContactItem = React.memo(({ 
  contact, 
  isSelected, 
  onSelect,
  unreadCount
}: { 
  contact: Contact; 
  isSelected: boolean; 
  onSelect: (contact: Contact) => void;
  unreadCount: number;
}) => (
  <div
    onClick={() => onSelect(contact)}
    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
      isSelected ? 'bg-green-50 border-green-200' : ''
    }`}
  >
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 truncate">{contact.name}</h3>
        <p className="text-sm text-gray-500 truncate">{contact.phone}</p>
        {contact.lastMessage && (
          <p className="text-xs text-gray-400 truncate mt-1">
            {contact.lastMessage}
          </p>
        )}
      </div>
      {unreadCount > 0 && (
        <span className="ml-2 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {unreadCount}
        </span>
      )}
    </div>
  </div>
));

ContactItem.displayName = 'ContactItem';

// Componente para mostrar estados de mensaje como WhatsApp
const MessageStatus = ({ status }: { status: 'sent' | 'delivered' | 'read' | 'failed' }) => {
  if (status === 'failed') {
    return <span className="text-red-500">❌</span>;
  }
  
  return (
    <span className="text-gray-400">
      {status === 'sent' && '✓'}
      {status === 'delivered' && '✓✓'}
      {status === 'read' && '✓✓'}
    </span>
  );
};

// Función para obtener el contenido del template desde Meta API
const getTemplateContent = async (templateName: string): Promise<string> => {
  try {
    // Intentar obtener el contenido real del template desde Meta API
    const response = await fetch('/api/whatsapp/template-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_name: templateName
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.content) {
        console.log(`📋 Contenido real del template ${templateName}:`, result.content);
        return result.content;
      }
    }
  } catch (error) {
    console.warn(`⚠️ No se pudo obtener contenido real del template ${templateName}:`, error);
  }

  // Fallback con contenido básico si no se puede obtener el real
  const fallbackTemplates: { [key: string]: string } = {
    'envio_de_orden': '🛒 *NUEVO PEDIDO*\n\nSe ha recibido un nuevo pedido. Por favor revisa los detalles y confirma la recepción.',
    'inicializador_de_conv': '👋 ¡Hola! Iniciando conversación para coordinar pedidos.',
    'evio_orden': '🛒 *NUEVA ORDEN*\n\nSe ha recibido una nueva orden. Por favor revisa los detalles y confirma la recepción.',
    'notificacion_pedido': '📋 Notificación de nuevo pedido recibido.',
    'confirmacion_pedido': '✅ Pedido confirmado y en proceso.',
    'recordatorio_pedido': '⏰ Recordatorio: Pedido pendiente de confirmación.',
    'pedido_enviado': '📤 Pedido enviado al proveedor.',
    'pedido_confirmado': '✅ Pedido confirmado por el proveedor.',
    'pedido_rechazado': '❌ Pedido rechazado por el proveedor.',
    'pedido_modificado': '🔄 Pedido modificado.',
    'pedido_cancelado': '🚫 Pedido cancelado.',
    'pedido_entregado': '🎉 Pedido entregado exitosamente.',
    'recordatorio_pago': '💰 Recordatorio de pago pendiente.',
    'confirmacion_pago': '💳 Pago confirmado.',
    'error_pago': '⚠️ Error en el procesamiento del pago.'
  };
  
  return fallbackTemplates[templateName] || `📋 Template: ${templateName} enviado`;
};

export default function IntegratedChatPanel({ 
  providers,
  isOpen, 
  onClose
}: IntegratedChatPanelProps) {
  const {
    selectedContact,
    messages,
    messagesByContact,
    sortedContacts,
    unreadCounts,
    markAsRead,
    sendMessage,
    closeChat,
    isConnected,
    connectionStatus,
    selectContact,
    addMessage
  } = useChat();

  // Función para verificar si han pasado 24 horas desde el último mensaje ENVIADO POR EL PROVEEDOR
  const hanPasado24Horas = (): boolean => {
    if (!currentContact) {
      console.log('🔍 DEBUG hanPasado24Horas: No hay currentContact');
      return false;
    }
    
    const normalizedPhone = normalizeContactIdentifier(currentContact.phone);
    const contactMessages = messagesByContact[normalizedPhone];
    
    console.log('🔍 DEBUG hanPasado24Horas:', {
      currentContact: currentContact.name,
      normalizedPhone,
      contactMessages: contactMessages?.length || 0,
      messagesByContactKeys: Object.keys(messagesByContact)
    });
    
    if (!contactMessages || contactMessages.length === 0) {
      console.log('🔍 DEBUG hanPasado24Horas: No hay mensajes, mostrar botón de inicializador');
      return true; // Si no hay mensajes, mostrar botón para iniciar conversación
    }
    
    // 🔧 FILTRAR SOLO MENSAJES ENVIADOS POR EL PROVEEDOR (mensajes recibidos por nosotros)
    // Los mensajes del proveedor tienen messageType: 'received'
    const providerMessages = contactMessages.filter(msg => msg.messageType === 'received');
    
    console.log('🔍 DEBUG hanPasado24Horas - Mensajes del proveedor:', {
      totalMessages: contactMessages.length,
      providerMessages: providerMessages.length,
      allMessageTypes: contactMessages.map(msg => ({ type: msg.messageType, content: msg.content?.substring(0, 30) + '...' }))
    });
    
    if (providerMessages.length === 0) {
      console.log('🔍 DEBUG hanPasado24Horas: No hay mensajes del proveedor, mostrar botón de inicializador');
      return true; // Si el proveedor nunca envió un mensaje, mostrar botón para iniciar conversación
    }
    
    // Obtener el último mensaje ENVIADO POR EL PROVEEDOR
    const lastProviderMessage = providerMessages[providerMessages.length - 1];
    
    if (!lastProviderMessage) {
      console.log('🔍 DEBUG hanPasado24Horas: No hay último mensaje del proveedor, mostrar botón de inicializador');
      return true; // Si no hay mensajes del proveedor, mostrar botón para iniciar conversación
    }
    
    const lastMessageTime = new Date(lastProviderMessage.timestamp);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);
    
    console.log('🔍 DEBUG hanPasado24Horas:', {
      lastProviderMessage: lastProviderMessage.content?.substring(0, 50) + '...',
      lastMessageTime: lastMessageTime.toISOString(),
      now: now.toISOString(),
      hoursDiff: hoursDiff.toFixed(2),
      shouldShowButton: hoursDiff >= 24
    });
    
    return hoursDiff >= 24;
  };

  // Función para enviar inicializador de conversación
  const enviarInicializadorConversacion = async () => {
    if (!currentContact) return;
    
    try {
      const normalizedPhone = normalizeContactIdentifier(currentContact.phone);
      
      const response = await fetch('/api/whatsapp/trigger-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: normalizedPhone,
          template_name: 'inicializador_de_conv'
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        // 🔧 CREAR MENSAJE EN EL CHAT: Con el contenido del template
        if (result.template_content) {
          const templateMessage = {
            id: `template_${Date.now()}`,
            content: result.template_content,
            type: 'sent' as const,
            timestamp: new Date(),
            status: 'sent' as const,
            isTemplate: true,
            templateName: result.template_sent,
            contact_id: normalizedPhone
          };
          
          addMessage(normalizedPhone, templateMessage);
          console.log('📱 Template agregado al chat con contenido real:', result.template_content);
        }
        
        // Usar toast en lugar de alert
        if ((window as any).showToast) {
          (window as any).showToast({
            type: 'success',
            title: '✅ Inicializador enviado',
            message: 'Se ha reiniciado la ventana de 24 horas. Ahora puedes enviar mensajes manuales.',
            duration: 6000
          });
        }
        // Recargar la página para mostrar el nuevo mensaje
        setTimeout(() => window.location.reload(), 1500);
      } else {
        if ((window as any).showToast) {
          (window as any).showToast({
            type: 'error',
            title: '❌ Error enviando inicializador',
            message: result.error || 'Error desconocido',
            duration: 5000
          });
        }
      }
    } catch (error) {
      console.error('Error enviando inicializador:', error);
      if ((window as any).showToast) {
        (window as any).showToast({
          type: 'error',
          title: '❌ Error de conexión',
          message: 'No se pudo enviar el inicializador de conversación',
          duration: 5000
        });
      }
    }
  };

  // Función de debug para mostrar información de contactos
  const debugContactos = () => {
    const contactosInfo = {
      sortedContacts: sortedContacts.map(c => ({ phone: c.phone, name: c.name })),
      providers: providers.map(p => ({ phone: p.phone, name: p.name })),
      contacts: contacts.map(c => ({ phone: c.phone, name: c.name })),
      messagesByContact: Object.keys(messagesByContact)
    };
    
    console.log('🔍 DEBUG CONTACTOS:', contactosInfo);
    alert(`Contactos disponibles: ${contactosInfo.sortedContacts.length}\nProveedores: ${contactosInfo.providers.length}\nContactos finales: ${contactosInfo.contacts.length}\nRevisa la consola para más detalles.`);
  };


  const { isGlobalChatOpen, closeGlobalChat, currentGlobalContact } = useGlobalChat();

  const [contacts, setContacts] = useState<Contact[]>([]);

  // 🔧 NUEVO: Escuchar evento para seleccionar proveedor automáticamente
  useEffect(() => {
    const handleSelectProviderInChat = (event: CustomEvent) => {
      const { providerId, providerName, providerPhone } = event.detail;
      
      console.log('🔧 DEBUG - Seleccionando proveedor en chat:', {
        providerId, providerName, providerPhone
      });
      
      // Buscar el contacto del proveedor
      const providerContact = contacts.find(contact => 
        contact.phone === providerPhone || 
        normalizeContactIdentifier(contact.phone) === normalizeContactIdentifier(providerPhone)
      );
      
      if (providerContact) {
        console.log('🔧 DEBUG - Proveedor encontrado en contactos, seleccionando:', providerContact.name);
        selectContact(providerContact);
      } else {
        console.log('🔧 DEBUG - Proveedor no encontrado en contactos, creando contacto temporal');
        // Crear un contacto temporal para el proveedor
        const tempContact: Contact = {
          id: `temp_${providerId}`,
          name: providerName,
          phone: providerPhone,
          lastMessage: null,
          unreadCount: 0,
          isOnline: false,
          lastSeen: null
        };
        
        // Agregar el contacto temporal a la lista
        setContacts(prev => {
          const exists = prev.find(c => c.id === tempContact.id);
          if (exists) return prev;
          return [tempContact, ...prev];
        });
        
        // Seleccionar el contacto temporal
        selectContact(tempContact);
      }
    };

    // Agregar listener para el evento
    window.addEventListener('selectProviderInChat', handleSelectProviderInChat as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('selectProviderInChat', handleSelectProviderInChat as EventListener);
    };
  }, [contacts, selectContact]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Usar el estado global del chat
  const isPanelOpen = isGlobalChatOpen || isOpen;
  const currentContact = selectedContact; // Usar solo selectedContact del contexto de chat

  // Verificar si el usuario está autenticado
  const { isUserAuthenticated } = useChat();



  // Función para cerrar el chat usando el contexto global
  const handleClose = () => {
    closeGlobalChat();
    closeChat();
    if (onClose) onClose();
  };

  // Combinar proveedores con contactos de mensajes - CARGA CON ESTADO DE CARGA
  useEffect(() => {
    // Si no hay proveedores cargados, mantener estado de carga
    if (!providers || providers.length === 0) {
      setIsLoading(true);
      return;
    }

    const allContacts: Contact[] = [];
    
    // PASO 1: Incluir todos los contactos con mensajes (menos estricto)
    if (sortedContacts && sortedContacts.length > 0) {
      sortedContacts.forEach(contact => {
        // Incluir todos los contactos con mensajes, incluso si no tienen proveedor
        // Asegurar que el contacto tenga un id
        const contactWithId: Contact = {
          id: contact.phone || `contact_${Date.now()}_${Math.random()}`,
          name: contact.name,
          phone: contact.phone,
          lastMessage: contact.lastMessage,
          lastMessageTime: contact.lastMessageTime || new Date(),
          unreadCount: contact.unreadCount
        };
        allContacts.push(contactWithId);
      });
    }
    
    // PASO 2: Agregar todos los proveedores con nombres correctos
    console.log('🔍 DEBUG providers:', providers);
    providers.forEach(provider => {
      console.log('🔍 DEBUG provider:', provider);
      const normalizedPhone = normalizeContactIdentifier(provider.phone);
      const existingContact = allContacts.find(c => c.phone === normalizedPhone);
      
      if (!existingContact) {
        // Proveedor sin mensajes - agregarlo con nombre correcto
        const providerDisplayName = provider.contact_name 
          ? `${provider.name} - ${provider.contact_name}`
          : provider.name;
        
        console.log('🔍 DEBUG providerDisplayName (nuevo):', providerDisplayName);
        
        allContacts.push({
          id: provider.id,
          name: providerDisplayName,
          phone: normalizedPhone,
          providerId: provider.id,
          lastMessage: '',
          lastMessageTime: new Date(),
          unreadCount: 0
        });
      } else {
        // Actualizar el nombre del contacto existente con el nombre del proveedor
        const providerDisplayName = provider.contact_name 
          ? `${provider.name} - ${provider.contact_name}`
          : provider.name;
        
        console.log('🔍 DEBUG providerDisplayName (existente):', providerDisplayName);
        
        existingContact.name = providerDisplayName;
        existingContact.providerId = provider.id;
      }
    });
    
    setContacts(allContacts);
    setIsLoading(false);
    
  }, [sortedContacts, providers]);

  // Listener para seleccionar contactos desde botones externos
  useEffect(() => {
    const handleSelectContact = (event: CustomEvent) => {
      const { contact } = event.detail;
      if (contact && contact.phone) {
        // Buscar el contacto en la lista
        const foundContact = contacts.find(c => c.phone === contact.phone);
        if (foundContact) {
          selectContact(foundContact);
        }
      }
    };

    window.addEventListener('selectContact', handleSelectContact as EventListener);
    
    return () => {
      window.removeEventListener('selectContact', handleSelectContact as EventListener);
    };
  }, [contacts, selectContact]);

  // Listener para detectar cuando se envía un template desde el flujo de notificación
  // ELIMINADO: Este listener causaba duplicación de mensajes ya que el template se envía desde orderNotificationService
  // useEffect(() => {
  //   const handleOrderSent = async (event: CustomEvent) => {
  //     const { orderId, providerId } = event.detail;
  //     
  //     // Buscar el proveedor por ID
  //     const provider = providers.find(p => p.id === providerId);
  //     if (provider) {
  //       const normalizedPhone = normalizeContactIdentifier(provider.phone);
  //       
  //       try {
  //         console.log('📱 Iniciando obtención de contenido real del template...');
  //         
  //         // Obtener el contenido real del template desde Meta API
  //         const templateContent = await getTemplateContent('envio_de_orden');
  //         
  //         console.log('📱 Contenido real obtenido:', templateContent);
  //         
  //         // Crear el mensaje del template
  //         const templateMessage = {
  //           id: `template_${orderId}_${Date.now()}`,
  //           from: 'me',
  //           to: normalizedPhone,
  //           content: templateContent,
  //           type: 'sent' as const,
  //           timestamp: new Date(),
  //           status: 'sent' as const,
  //           isTemplate: true,
  //           templateName: 'envio_de_orden',
  //           contact_id: normalizedPhone
  //         };
  //         
  //         // Agregar el mensaje al contexto del chat
  //         addMessage(normalizedPhone, templateMessage);
  //         
  //         console.log('📱 Template agregado al chat con contenido real:', templateContent);
  //       } catch (error) {
  //         console.error('❌ Error obteniendo contenido del template:', error);
  //         
  //         // Fallback: usar contenido básico si falla la obtención
  //         const fallbackContent = '🛒 *NUEVO PEDIDO*\n\nSe ha recibido un nuevo pedido. Por favor revisa los detalles y confirma la recepción.';
  //         
  //         const fallbackMessage = {
  //           id: `template_${orderId}_${Date.now()}`,
  //           from: 'me',
  //           to: normalizedPhone,
  //           content: fallbackContent,
  //           type: 'sent' as const,
  //           timestamp: new Date(),
  //           status: 'sent' as const,
  //           isTemplate: true,
  //           templateName: 'envio_de_orden',
  //           contact_id: normalizedPhone
  //         };
  //         
  //         addMessage(normalizedPhone, fallbackMessage);
  //         console.log('📱 Template agregado al chat con contenido fallback');
  //       }
  //     }
  //   };

  //   window.addEventListener('orderSent', handleOrderSent as unknown as EventListener);
  //   
  //   return () => {
  //     window.removeEventListener('orderSent', handleOrderSent as unknown as EventListener);
  //   };
  // }, [providers, addMessage]);

  // Seleccionar automáticamente el primer contacto cuando se abre el chat
  useEffect(() => {
    if (isPanelOpen && contacts.length > 0 && !currentContact) {
      selectContact(contacts[0]);
    }
  }, [isPanelOpen, contacts, currentContact?.phone, selectContact]);

  // Marcar como leído cuando cambia el contacto (optimizado)
  useEffect(() => {
    if (currentContact?.phone && isPanelOpen) {
      const normalizedPhone = normalizeContactIdentifier(currentContact.phone);
      markAsRead(normalizedPhone);
    }
  }, [currentContact?.phone, isPanelOpen, markAsRead]);

  // Marcar como leído automáticamente cuando llegan nuevos mensajes a la conversación activa
  useEffect(() => {
    if (currentContact?.phone && isPanelOpen) {
      const normalizedPhone = normalizeContactIdentifier(currentContact.phone);
      const contactMessages = messagesByContact[normalizedPhone];
      
      // Si hay mensajes no leídos en la conversación activa, marcarlos como leídos
      if (contactMessages && contactMessages.some(msg => msg.type === 'received' && msg.status !== 'read')) {
        markAsRead(normalizedPhone);
      }
    }
  }, [messagesByContact, currentContact?.phone, isPanelOpen, markAsRead]);

  // Scroll al final de los mensajes (optimizado)
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });
    }
  }, []);

  // Scroll automático cuando cambia el contacto o llegan nuevos mensajes
  useEffect(() => {
    if (currentContact && messagesEndRef.current) {
      // Scroll inmediatamente al final sin animación
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'instant',
            block: 'end',
            inline: 'nearest'
          });
        }
      }, 200); // Aumentar delay para asegurar que el DOM esté listo
    }
  }, [currentContact?.phone, messagesByContact[currentContact?.phone || '']?.length]); // Agregar dependencia de cantidad de mensajes

  // Scroll adicional cuando se abre el chat por primera vez
  useEffect(() => {
    if (isPanelOpen && currentContact && messagesEndRef.current) {
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'instant',
            block: 'end',
            inline: 'nearest'
          });
        }
      }, 300);
    }
  }, [isPanelOpen, currentContact?.phone]); // Solo cuando se abre el panel o cambia el contacto

  // Auto-resize del textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [newMessage]);

  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentContact || isSending) {
      return;
    }

    const messageToSend = newMessage.trim();
    
    // Prevenir envíos duplicados con protección adicional
    if (isSending) {
      console.log('⚠️ Envío en progreso, ignorando llamada duplicada');
      return;
    }
    
    setIsSending(true);
    
    // Limpiar el input inmediatamente para mejor UX
    setNewMessage('');
    
    try {
      console.log('📤 Enviando mensaje:', messageToSend);
      await sendMessage(currentContact.phone, messageToSend);
      console.log('✅ Mensaje enviado exitosamente');
      
      // Scroll al final después de enviar el mensaje
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
      // Restaurar el mensaje si falla
      setNewMessage(messageToSend);
      alert('Error al enviar mensaje. Inténtalo de nuevo.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendDocument = async (file: File) => {
    if (!currentContact) return;

    setUploadingDocument(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('recipient', currentContact.phone);

      const response = await fetch('/api/whatsapp/send-document', {
          method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        // Documento enviado exitosamente
        } else {
        throw new Error('Error al enviar documento');
      }
    } catch (error) {
      alert('Error al enviar documento. Inténtalo de nuevo.');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && currentContact) {
      handleSendDocument(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim() && currentContact && !isSending) {
        console.log('🔑 Enter presionado, enviando mensaje');
        handleSendMessage();
      } else if (isSending) {
        console.log('⚠️ Enter presionado pero envío en progreso, ignorando');
      }
    }
  };

  const handleAddContact = () => {
    if (newContact.name && newContact.phone) {
      const contact: Contact = {
        id: Date.now().toString(),
        name: newContact.name,
        phone: newContact.phone,
        lastMessage: '',
        lastMessageTime: new Date(),
        unreadCount: 0
      };
      setContacts(prev => [...prev, contact]);
      setNewContact({ name: '', phone: '' });
      setShowAddContact(false);
    }
  };



  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm)
  );

  if (!isPanelOpen) {
    return null;
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[800px] bg-white shadow-xl flex flex-col z-50">
        {/* Header */}
      <div className="flex-shrink-0 bg-green-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageSquare className="h-6 w-6" />
            <div>
              <h2 className="text-lg font-semibold">WhatsApp Business</h2>
              <WhatsAppStatusIndicator className="text-green-100" />
              <NotificationPermission />
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-green-700 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        </div>

        {/* Mensaje de autenticación */}
        {!isUserAuthenticated && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Autenticación requerida:</strong> Para ver y enviar mensajes, necesitas iniciar sesión.
                </p>
                <div className="mt-2">
                  <a 
                    href="/auth/login" 
                    className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                  >
                    Iniciar sesión →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

      <div className="flex flex-1 min-h-0">
        {/* Contactos */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          {/* Búsqueda */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar contactos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            </div>

          {/* Lista de contactos */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500 text-sm">Cargando contactos...</p>
                </div>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No hay contactos disponibles</p>
                </div>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <ContactItem
                  key={contact.phone}
                  contact={contact}
                  isSelected={currentContact?.phone === contact.phone}
                  onSelect={() => {
                    selectContact(contact);
                  }}
                  unreadCount={unreadCounts[contact.phone] || 0}
                />
              ))
            )}
          </div>
                    </div>

        {/* Chat */}
        <div className="w-2/3 flex flex-col min-h-0">
          {currentContact ? (
            <>
              {/* Header del chat */}
              <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {currentContact.name.charAt(0).toUpperCase()}
                    </span>
                      </div>
                  <div className="flex-1">
                    {/* Debug: mostrar información del contacto */}
                    {console.log('🔍 DEBUG currentContact:', currentContact)}
                    
                    {/* Mostrar nombre del proveedor y contacto por separado */}
                    {currentContact.name.includes(' - ') ? (
                      <>
                        <h3 className="font-medium text-gray-900">{currentContact.name.split(' - ')[0]}</h3>
                        <p className="text-sm text-blue-600 font-medium">{currentContact.name.split(' - ')[1]}</p>
                        <p className="text-xs text-gray-500">{currentContact.phone}</p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-medium text-gray-900">{currentContact.name}</h3>
                        <p className="text-sm text-gray-500">{currentContact.phone}</p>
                      </>
                    )}
                    {isTyping && (
                      <p className="text-xs text-green-600 mt-1">escribiendo...</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                     <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
                       <Phone className="h-4 w-4" />
                     </button>
                     <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
                       <Video className="h-4 w-4" />
                     </button>
                     <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
                       <MoreVertical className="h-4 w-4" />
                     </button>
                </div>
            </div>
        </div>

                               {/* Mensajes */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-100">
                  {(() => {
                    const normalizedPhone = currentContact ? normalizeContactIdentifier(currentContact.phone) : '';
                    const contactMessages = currentContact && messagesByContact[normalizedPhone];
                    
                    return contactMessages?.map((message) => (
              <div
                key={message.id}
                       className={`flex ${message.type === 'sent' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                         className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                           message.type === 'sent'
                             ? 'bg-green-500 text-white'
                             : 'bg-white text-gray-900 shadow-sm'
                         }`}
                       >
                         {/* Indicador de template */}
                         {message.isTemplate && (
                           <div className="mb-1">
                             <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                               📋 Template: {message.templateName}
                             </span>
                           </div>
                         )}
                         <div className="whitespace-pre-wrap">
                           {message.content}
                           
                           {/* 🔧 NUEVO: Mostrar enlace a factura si existe */}
                           {message.content && message.content.includes('Factura recibida') && (
                             <div className="mt-2 pt-2 border-t border-gray-200">
                               <button
                                 onClick={() => {
                                   // Buscar la orden más reciente del proveedor para obtener el receipt_url
                                   const currentContactPhone = currentContact?.phone;
                                   if (currentContactPhone) {
                                     // Hacer fetch de la orden más reciente
                                     fetch('/api/facturas/invoices')
                                       .then(res => res.json())
                                       .then(data => {
                                         if (data.success && data.invoices) {
                                           const latestInvoice = data.invoices.find((inv: any) => 
                                             inv.provider_name === currentContact?.name
                                           );
                                           if (latestInvoice?.receipt_url) {
                                             window.open(latestInvoice.receipt_url, '_blank');
                                           }
                                         }
                                       })
                                       .catch(console.error);
                                   }
                                 }}
                                 className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full hover:bg-blue-200 transition-colors"
                               >
                                 📎 Ver Factura
                               </button>
                             </div>
                           )}
                         </div>
                         <div className={`text-xs mt-1 flex items-center justify-between ${
                           message.type === 'sent' ? 'text-green-100' : 'text-gray-500'
                         }`}>
                           <span>
                             {new Date(message.timestamp).toLocaleTimeString([], {
                               hour: '2-digit',
                               minute: '2-digit'
                             })}
                           </span>
                           {message.type === 'sent' && (
                             <MessageStatus status={message.status || 'sent'} />
                           )}
                         </div>
                </div>
              </div>
                   ));
                 })()}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
              <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
                {/* Inicializador de conversación - Solo visible si han pasado 24h */}
                {hanPasado24Horas() && (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MessageCircle className="h-5 w-5 text-yellow-600" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800">
                            Ventana de 24 horas expirada
                          </p>
                          <p className="text-xs text-yellow-600">
                            No puedes enviar mensajes manuales. Usa el inicializador para reactivar la conversación.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={enviarInicializadorConversacion}
                        className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-2"
                        title="Reiniciar ventana de 24 horas para poder enviar mensajes manuales"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Reiniciar Conversación</span>
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex items-end space-x-2">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <Smile className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                    disabled={uploadingDocument}
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={hanPasado24Horas() ? "No puedes enviar mensajes. Usa el inicializador arriba." : "Escribe un mensaje..."}
                      className={`w-full px-4 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                        hanPasado24Horas() 
                          ? 'border-yellow-300 bg-yellow-50 text-gray-500' 
                          : 'border-gray-300'
                      }`}
                      rows={1}
                      style={{ minHeight: '40px', maxHeight: '120px' }}
                      disabled={hanPasado24Horas()}
              />
                  </div>
                  {newMessage.trim() && !hanPasado24Horas() ? (
              <button
                      onClick={handleSendMessage}
                      disabled={uploadingDocument || isSending}
                      className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  ) : hanPasado24Horas() ? (
                    <button 
                      disabled
                      className="p-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                      title="No puedes enviar mensajes. Usa el inicializador para reactivar la conversación."
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  ) : (
                    <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
                      <Mic className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                />
            </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Selecciona un contacto para comenzar a chatear</p>
            </div>
          </div>
        )}
        </div>
      </div>


    </div>
  );
}