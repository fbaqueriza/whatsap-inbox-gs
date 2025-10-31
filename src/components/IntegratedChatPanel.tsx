'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Paperclip, Phone, Video, MoreVertical, Plus, Search, MessageSquare, X, FileText, Download, Image, File, Smile, Mic, RefreshCw, MessageCircle } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import { useGlobalChat } from '../contexts/GlobalChatContext';
import { WhatsAppMessage, Contact } from '../types/whatsapp';
import React from 'react';
import { normalizeContactIdentifier } from '../contexts/ChatContext';
import NotificationPermission from './NotificationPermission';

interface IntegratedChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IntegratedChatPanel({ isOpen, onClose }: IntegratedChatPanelProps) {
  const [newMessage, setNewMessage] = useState('');
  const [pendingApprovalBanner, setPendingApprovalBanner] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showInitializer, setShowInitializer] = useState(false);
  const [initializerMessage, setInitializerMessage] = useState('');

  const {
    messages,
    contacts,
    selectedContact,
    isChatOpen,
    messagesByContact,
    sortedContacts,
    totalUnreadCount,
    markAsRead,
    sendMessage,
    closeChat,
    selectContact,
    loadMessages
  } = useChat();

  const { isGlobalChatOpen } = useGlobalChat();

  const currentContact = selectedContact;

  // Mostrar banner de "Pendiente de aprobación" si fue marcado por el flujo de órdenes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pending = localStorage.getItem('wa_display_name_pending') === '1';
      const dismissed = localStorage.getItem('wa_display_name_pending_dismissed') === '1';
      setPendingApprovalBanner(pending && !dismissed);
    }
  }, [isOpen]);

  // Función para verificar si han pasado 24 horas desde el último mensaje ENVIADO POR EL PROVEEDOR
  const hanPasado24Horas = useMemo((): boolean => {
    if (!selectedContact) return false;
    
    const currentPhone = selectedContact.phone;
    let contactMessages = messagesByContact[currentPhone] || [];
    
    if (contactMessages.length === 0 && Object.keys(messagesByContact).length > 0) {
      const allKeys = Object.keys(messagesByContact);
      const matchingKey = allKeys.find(key => {
        const normalizedKey = normalizeContactIdentifier(key);
        const normalizedContact = normalizeContactIdentifier(currentPhone);
        return normalizedKey === normalizedContact || 
               key.includes(currentPhone.replace('+', '')) ||
               currentPhone.includes(key.replace('+', ''));
      });
      
      if (matchingKey) {
        contactMessages = messagesByContact[matchingKey] || [];
      }
    }
    
    if (!contactMessages || contactMessages.length === 0) {
      return false;
    }
    
    const providerMessages = contactMessages.filter(msg => {
      const msgType = (msg as any).message_type || msg.type;
      const msgDirection = (msg as any).direction;
      return msgType === 'received' || msgDirection === 'inbound';
    });
    
    if (providerMessages.length === 0) {
      return false;
    }
    
    const lastProviderMessage = providerMessages[providerMessages.length - 1];
    const lastMessageTime = new Date(lastProviderMessage.timestamp);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);
    
    return hoursDiff >= 24;
  }, [selectedContact, messagesByContact]);

  // Usar el estado global del chat
  const isPanelOpen = isGlobalChatOpen || isOpen;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Función helper para obtener icono de archivo
  const getFileIcon = (filename: string | undefined) => {
    if (!filename) return <span className="text-gray-600 text-lg">📄</span>;
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return <span className="text-red-600 text-lg">📄</span>;
      case 'doc':
      case 'docx':
        return <span className="text-blue-600 text-lg">📄</span>;
      case 'xls':
      case 'xlsx':
        return <span className="text-green-600 text-lg">📊</span>;
      case 'txt':
        return <span className="text-gray-600 text-lg">📄</span>;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <span className="text-purple-600 text-lg">🖼️</span>;
      default:
        return <span className="text-gray-600 text-lg">📄</span>;
    }
  };

  // Filtrar contactos basado en búsqueda
  const filteredContacts = useMemo(() => {
    if (!searchTerm) return sortedContacts;
    return sortedContacts.filter(contact =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone.includes(searchTerm)
    );
  }, [sortedContacts, searchTerm]);

  // Obtener mensajes del contacto seleccionado
  const currentMessages = useMemo(() => {
    if (!selectedContact) return [];
    return messagesByContact[selectedContact.phone] || [];
  }, [selectedContact, messagesByContact]);

  // Auto-scroll al final de los mensajes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMessages]);

  // Manejar envío de mensaje
  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedContact || hanPasado24Horas) return;

    try {
      setIsTyping(true);
      await sendMessage(selectedContact.phone, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
    } finally {
      setIsTyping(false);
    }
  }, [newMessage, selectedContact, hanPasado24Horas, sendMessage]);

  // Manejar tecla Enter
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Manejar selección de contacto
  const handleContactSelect = useCallback((contact: Contact) => {
    selectContact(contact);
  }, [selectContact]);

  // Manejar archivo seleccionado
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowFilePicker(false);
    }
  }, []);

  // Manejar envío de archivo
  const handleSendFile = useCallback(async () => {
    if (!selectedFile || !selectedContact || hanPasado24Horas) return;

    try {
      setIsTyping(true);
      // Aquí implementarías la lógica para enviar archivos
      console.log('Enviando archivo:', selectedFile.name);
      setSelectedFile(null);
    } catch (error) {
      console.error('❌ Error enviando archivo:', error);
    } finally {
      setIsTyping(false);
    }
  }, [selectedFile, selectedContact, hanPasado24Horas]);

  // Manejar inicializador de conversación
  const handleInitializerSend = useCallback(async () => {
    if (!initializerMessage.trim() || !selectedContact) return;

    try {
      setIsTyping(true);
      await sendMessage(selectedContact.phone, initializerMessage.trim());
      setInitializerMessage('');
      setShowInitializer(false);
    } catch (error) {
      console.error('❌ Error enviando mensaje inicializador:', error);
    } finally {
      setIsTyping(false);
    }
  }, [initializerMessage, selectedContact, sendMessage]);

  if (!isPanelOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-green-600 text-white p-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-6 h-6" />
            <h2 className="text-lg font-semibold">WhatsApp Business</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Lista de contactos */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            {/* Búsqueda */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
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
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => handleContactSelect(contact)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedContact?.id === contact.id ? 'bg-green-50 border-green-200' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {contact.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {contact.phone}
                          </p>
                        </div>
                      </div>
                      {contact.lastMessage && (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {contact.lastMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      {contact.lastMessageTime && (
                        <span className="text-xs text-gray-400">
                          {new Date(contact.lastMessageTime).toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                      {contact.unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                          {contact.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Área principal - Chat */}
          <div className="flex-1 flex flex-col">
            {pendingApprovalBanner && (
              <div className="p-3 bg-yellow-50 border-b border-yellow-200 text-yellow-900 flex items-start justify-between">
                <div className="pr-4 text-sm">
                  Pendiente de aprobación del nombre para mostrar en WhatsApp Business. Mientras tanto, los envíos usarán texto regular.
                </div>
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('wa_display_name_pending_dismissed','1');
                    }
                    setPendingApprovalBanner(false);
                  }}
                  className="text-yellow-900 hover:text-yellow-700"
                  aria-label="Cerrar aviso"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            {selectedContact ? (
              <>
                {/* Header del chat */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {selectedContact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{selectedContact.name}</h3>
                      <p className="text-sm text-gray-500">{selectedContact.phone}</p>
                    </div>
                  </div>
                </div>

                {/* Mensajes */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {currentMessages.map((message, index) => (
                    <div
                      key={`${message.id}-${message.timestamp}`}
                      className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.direction === 'outbound'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {new Date(message.timestamp).toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input de mensaje */}
                <div className="p-4 border-t border-gray-200">
                  {hanPasado24Horas && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        Han pasado más de 24 horas desde el último mensaje del proveedor. 
                        Usa el inicializador de conversación para enviar un mensaje.
                      </p>
                      <button
                        onClick={() => setShowInitializer(true)}
                        className="mt-2 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600 transition-colors"
                      >
                        Inicializar Conversación
                      </button>
                    </div>
                  )}

                  {showInitializer && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 mb-2">
                        Selecciona un mensaje inicial para enviar:
                      </p>
                      <div className="space-y-2">
                        <button
                          onClick={() => setInitializerMessage('Hola, ¿cómo estás?')}
                          className="w-full text-left px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm hover:bg-blue-50"
                        >
                          Hola, ¿cómo estás?
                        </button>
                        <button
                          onClick={() => setInitializerMessage('Buenos días, ¿en qué puedo ayudarte?')}
                          className="w-full text-left px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm hover:bg-blue-50"
                        >
                          Buenos días, ¿en qué puedo ayudarte?
                        </button>
                        <button
                          onClick={() => setInitializerMessage('Hola, ¿tienes disponibilidad?')}
                          className="w-full text-left px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm hover:bg-blue-50"
                        >
                          Hola, ¿tienes disponibilidad?
                        </button>
                      </div>
                      <div className="flex space-x-2 mt-3">
                        <input
                          type="text"
                          value={initializerMessage}
                          onChange={(e) => setInitializerMessage(e.target.value)}
                          placeholder="O escribe tu propio mensaje..."
                          className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm"
                        />
                        <button
                          onClick={handleInitializerSend}
                          disabled={!initializerMessage.trim() || isTyping}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
                        >
                          Enviar
                        </button>
                        <button
                          onClick={() => setShowInitializer(false)}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-end space-x-2">
                    <div className="flex-1">
                      <textarea
                        ref={textareaRef}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={hanPasado24Horas ? "No puedes enviar mensajes. Usa el inicializador arriba." : "Escribe un mensaje..."}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                          hanPasado24Horas 
                            ? 'bg-gray-100 cursor-not-allowed' 
                            : 'bg-white'
                        }`}
                        rows={1}
                        disabled={hanPasado24Horas}
                      />
                    </div>
                    <div className="flex space-x-1">
                      {newMessage.trim() && !hanPasado24Horas ? (
                        <button
                          onClick={handleSendMessage}
                          disabled={isTyping}
                          className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                        >
                          {isTyping ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                        </button>
                      ) : hanPasado24Horas ? (
                        <button
                          onClick={() => setShowInitializer(true)}
                          className="p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                          title="Inicializar conversación"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      ) : (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            <Smile className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setShowFilePicker(!showFilePicker)}
                            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            <Paperclip className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {showFilePicker && (
                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <input
                        type="file"
                        onChange={handleFileSelect}
                        className="w-full text-sm"
                        accept="image/*,application/pdf,.doc,.docx,.txt"
                      />
                      {selectedFile && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm text-gray-600">{selectedFile.name}</span>
                          <button
                            onClick={handleSendFile}
                            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                          >
                            Enviar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Selecciona un contacto para comenzar</p>
                  <p className="text-sm">Elige una conversación de la lista para ver los mensajes</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
