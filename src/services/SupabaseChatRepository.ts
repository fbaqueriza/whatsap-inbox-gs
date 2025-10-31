/**
 * 🎯 IMPLEMENTACIÓN SUPABASE - CHAT REPOSITORY
 * 
 * Reemplaza toda la lógica compleja del ChatContext actual
 * con una implementación limpia y elegante.
 */

import { createClient } from '@supabase/supabase-js';
import { ChatRepository, ChatMessage, ChatContact } from './ChatService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export class SupabaseChatRepository implements ChatRepository {
  private supabase = createClient(supabaseUrl, supabaseKey);

  async getMessages(contactId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await this.supabase
        .from('kapso_messages')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return data.map(this.mapToChatMessage);
    } catch (error) {
      console.error('[SupabaseChatRepository] Error getting messages:', error);
      return [];
    }
  }

  async getContacts(): Promise<ChatContact[]> {
    try {
      // Obtener conversaciones únicas de Kapso
      const { data: conversations, error } = await this.supabase
        .from('kapso_conversations')
        .select('phone_number, contact_name, last_active_at')
        .eq('status', 'active')
        .order('last_active_at', { ascending: false });

      if (error) throw error;

      // Obtener conteos de mensajes no leídos
      const { data: unreadCounts, error: countError } = await this.supabase
        .from('kapso_messages')
        .select('contact_id')
        .eq('is_read', false)
        .eq('direction', 'inbound');

      if (countError) throw countError;

      // Agrupar conteos por contacto
      const unreadMap = new Map<string, number>();
      unreadCounts.forEach(msg => {
        const count = unreadMap.get(msg.contact_id) || 0;
        unreadMap.set(msg.contact_id, count + 1);
      });

      return conversations.map(conv => ({
        id: conv.phone_number,
        name: conv.contact_name || conv.phone_number,
        phone: conv.phone_number,
        lastMessageTime: new Date(conv.last_active_at),
        unreadCount: unreadMap.get(conv.phone_number) || 0,
        isOnline: true
      }));
    } catch (error) {
      console.error('[SupabaseChatRepository] Error getting contacts:', error);
      return [];
    }
  }

  async sendMessage(contactId: string, content: string): Promise<ChatMessage> {
    try {
      // Crear mensaje temporal primero
      const tempMessage: ChatMessage = {
        id: `temp_${Date.now()}`,
        content,
        timestamp: new Date(),
        type: 'sent',
        contactId,
        status: 'pending'
      };

      // Enviar a través de Kapso API
      const response = await fetch('/api/kapso/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: contactId,
          message: content
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const result = await response.json();
      
      // Retornar mensaje con ID real de Kapso
      return {
        ...tempMessage,
        id: result.message_id || tempMessage.id,
        status: 'sent'
      };
    } catch (error) {
      console.error('[SupabaseChatRepository] Error sending message:', error);
      throw error;
    }
  }

  async markAsRead(contactId: string): Promise<void> {
    try {
      await this.supabase
        .from('kapso_messages')
        .update({ is_read: true })
        .eq('contact_id', contactId)
        .eq('direction', 'inbound')
        .eq('is_read', false);
    } catch (error) {
      console.error('[SupabaseChatRepository] Error marking as read:', error);
    }
  }

  subscribeToUpdates(callback: (message: ChatMessage) => void): () => void {
    const channel = this.supabase
      .channel('kapso_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'kapso_messages'
        },
        (payload) => {
          const message = this.mapToChatMessage(payload.new);
          callback(message);
        }
      )
      .subscribe();

    return () => {
      this.supabase.removeChannel(channel);
    };
  }

  private mapToChatMessage(data: any): ChatMessage {
    return {
      id: data.whatsapp_message_id || data.id,
      content: data.content || '',
      timestamp: new Date(data.created_at),
      type: data.direction === 'outbound' ? 'sent' : 'received',
      contactId: data.contact_id || data.from,
      status: this.mapStatus(data.status),
      metadata: {
        isDocument: !!data.media_url,
        mediaUrl: data.media_url,
        filename: data.media_url ? data.media_url.split('/').pop() : undefined,
        mediaType: data.media_type
      }
    };
  }

  private mapStatus(status: string): ChatMessage['status'] {
    switch (status) {
      case 'sent': return 'sent';
      case 'delivered': return 'delivered';
      case 'read': return 'read';
      case 'failed': return 'failed';
      default: return 'pending';
    }
  }
}

export default SupabaseChatRepository;
