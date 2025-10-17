import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SyncKapsoDataParams {
  conversationId: string;
  phoneNumber: string;
  contactName: string | null;
  messageId: string;
  fromNumber: string;
  toNumber: string;
  content: string;
  messageType: string;
  timestamp: string;
  userId: string;
}

interface KapsoStats {
  total_conversations: number;
  total_messages: number;
  total_contacts: number;
  active_conversations: number;
}

export const KapsoSupabaseService = {
  syncKapsoData: async (params: SyncKapsoDataParams) => {
    try {
      const { data, error } = await supabase.rpc('sync_kapso_data', {
        p_conversation_id: params.conversationId,
        p_phone_number: params.phoneNumber,
        p_contact_name: params.contactName,
        p_message_id: params.messageId,
        p_from_number: params.fromNumber,
        p_to_number: params.toNumber,
        p_content: params.content,
        p_message_type: params.messageType,
        p_timestamp: params.timestamp,
        p_user_id: params.userId,
      });

      if (error) {
        console.error('❌ KapsoSupabaseService: Error en syncKapsoData:', error);
        return { success: false, error };
      }
      return { success: true, data };
    } catch (e: any) {
      console.error('❌ KapsoSupabaseService: Excepción en syncKapsoData:', e);
      return { success: false, error: e.message };
    }
  },

  getKapsoStats: async (userId: string): Promise<{ success: boolean; data?: KapsoStats; error?: any }> => {
    try {
      const { data, error } = await supabase.rpc('get_kapso_stats', { p_user_id: userId });
      if (error) {
        console.error('❌ KapsoSupabaseService: Error en getKapsoStats:', error);
        return { success: false, error };
      }
      return { success: true, data: data as KapsoStats };
    } catch (e: any) {
      console.error('❌ KapsoSupabaseService: Excepción en getKapsoStats:', e);
      return { success: false, error: e.message };
    }
  },

  getKapsoConversations: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('kapso_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('❌ KapsoSupabaseService: Error en getKapsoConversations:', error);
        return { success: false, error };
      }
      return { success: true, data };
    } catch (e: any) {
      console.error('❌ KapsoSupabaseService: Excepción en getKapsoConversations:', e);
      return { success: false, error: e.message };
    }
  },

  getKapsoMessages: async (conversationId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('kapso_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('❌ KapsoSupabaseService: Error en getKapsoMessages:', error);
        return { success: false, error };
      }
      return { success: true, data };
    } catch (e: any) {
      console.error('❌ KapsoSupabaseService: Excepción en getKapsoMessages:', e);
      return { success: false, error: e.message };
    }
  },
};