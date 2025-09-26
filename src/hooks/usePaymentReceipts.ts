import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase/client';

export interface PaymentReceiptData {
  id?: string;
  user_id: string;
  provider_id?: string;
  order_id?: string;
  filename: string;
  file_url: string;
  file_size?: number;
  file_type: 'transferencia' | 'cheque' | 'efectivo' | 'tarjeta' | 'other';
  mime_type?: string;
  receipt_number?: string;
  payment_amount?: number;
  payment_currency?: string;
  payment_date?: string;
  payment_method?: 'transferencia' | 'cheque' | 'efectivo' | 'tarjeta' | 'other';
  auto_assigned_provider_id?: string;
  auto_assigned_order_id?: string;
  assignment_confidence?: number;
  assignment_method?: 'cuit_match' | 'amount_match' | 'provider_match' | 'manual';
  sent_to_provider?: boolean;
  sent_at?: string;
  whatsapp_message_id?: string;
  status: 'pending' | 'processed' | 'assigned' | 'sent' | 'error';
  processing_error?: string;
  created_at?: string;
  updated_at?: string;
  processed_at?: string;
}

export function usePaymentReceipts() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<PaymentReceiptData[]>([]);
  const subscriptionRef = useRef<any>(null);

  // Obtener comprobantes del usuario
  const getPaymentReceipts = useCallback(async (userId: string): Promise<PaymentReceiptData[]> => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('payment_receipts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        // Si la tabla no existe, retornar array vacío en lugar de error
        if (fetchError.message.includes('relation "payment_receipts" does not exist') || 
            fetchError.message.includes('Could not find a relationship')) {
          return [];
        }
        throw new Error(fetchError.message);
      }
      
      setReceipts(data || []);
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error obteniendo comprobantes';
      setError(errorMessage);
      console.error('❌ [usePaymentReceipts] Error obteniendo comprobantes:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Configurar suscripción en tiempo real
  const setupRealtimeSubscription = useCallback((userId: string) => {
    
    // Limpiar suscripción anterior
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    subscriptionRef.current = supabase
      .channel('payment_receipts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_receipts',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setReceipts(prev => [payload.new as PaymentReceiptData, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setReceipts(prev => prev.map(receipt => 
              receipt.id === payload.new.id 
                ? { ...receipt, ...payload.new }
                : receipt
            ));
          } else if (payload.eventType === 'DELETE') {
            setReceipts(prev => prev.filter(receipt => receipt.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        // Suscripción configurada
      });
  }, []);

  // Limpiar suscripción al desmontar
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  // Enviar comprobante a proveedor
  const sendReceiptToProvider = useCallback(async (receiptId: string, providerId: string): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/payment-receipts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId, providerId })
      });

      const data = await response.json();

      if (data.success) {
        return { success: true, messageId: data.messageId };
      } else {
        return { success: false, error: data.error || 'Error enviando comprobante' };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error de conexión';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    receipts,
    getPaymentReceipts,
    setupRealtimeSubscription,
    sendReceiptToProvider
  };
}
