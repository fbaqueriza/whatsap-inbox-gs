'use client';

/**
 * Panel de chat optimizado usando Kapso + Supabase
 * Reemplaza el sistema anterior con sincronización automática
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useKapsoRealtime } from '../hooks/useKapsoRealtime';
import { KapsoSupabaseService } from '../lib/kapsoSupabaseService';

interface KapsoChatPanelProps {
  className?: string;
}

export function KapsoChatPanel({ className = '' }: KapsoChatPanelProps) {
  const {
    conversations,
    messages,
    contacts,
    isLoading,
    error,
    refreshConversations,
    refreshMessages,
    refreshContacts,
    isConnected
  } = useKapsoRealtime();

  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  // Filtrar mensajes de la conversación seleccionada
  const currentMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return messages.filter(msg => msg.conversation_id === selectedConversation);
  }, [messages, selectedConversation]);

  // Obtener conversación seleccionada
  const currentConversation = useMemo(() => {
    if (!selectedConversation) return null;
    return conversations.find(conv => conv.conversation_id === selectedConversation);
  }, [conversations, selectedConversation]);

  // Cargar mensajes cuando se selecciona una conversación
  useEffect(() => {
    if (selectedConversation) {
      refreshMessages(selectedConversation);
    }
  }, [selectedConversation, refreshMessages]);

  // Seleccionar primera conversación automáticamente
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversation) {
      setSelectedConversation(conversations[0].conversation_id);
    }
  }, [conversations, selectedConversation]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentConversation) return;

    try {
      // Aquí implementarías el envío de mensaje usando la API de Kapso
      console.log('📤 Enviando mensaje:', {
        conversationId: currentConversation.conversation_id,
        content: newMessage,
        toNumber: currentConversation.phone_number
      });

      // Por ahora, solo limpiar el input
      setNewMessage('');
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando conversaciones de Kapso...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="text-red-600 mb-4">❌ Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={refreshConversations}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full ${className}`}>
      {/* Lista de conversaciones */}
      <div className="w-1/3 border-r border-gray-200 bg-gray-50">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            Conversaciones de Kapso
          </h3>
          <div className="flex items-center mt-2">
            <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>

        <div className="overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No hay conversaciones
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-100 ${
                  selectedConversation === conversation.conversation_id ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => setSelectedConversation(conversation.conversation_id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">
                      {conversation.contact_name || conversation.phone_number}
                    </p>
                    <p className="text-sm text-gray-600">{conversation.phone_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {conversation.last_message_at 
                        ? new Date(conversation.last_message_at).toLocaleTimeString()
                        : ''
                      }
                    </p>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      conversation.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {conversation.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Panel de chat */}
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <>
            {/* Header de la conversación */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <h4 className="font-semibold text-gray-800">
                {currentConversation.contact_name || currentConversation.phone_number}
              </h4>
              <p className="text-sm text-gray-600">{currentConversation.phone_number}</p>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No hay mensajes en esta conversación
                </div>
              ) : (
                currentMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.from_number === currentConversation.phone_number ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.from_number === currentConversation.phone_number
                          ? 'bg-gray-200 text-gray-800'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.from_number === currentConversation.phone_number
                          ? 'text-gray-500'
                          : 'text-blue-100'
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input de mensaje */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Enviar
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Selecciona una conversación para comenzar
          </div>
        )}
      </div>
    </div>
  );
}
