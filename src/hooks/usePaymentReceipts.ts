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
  // Información relacionada
  auto_assigned_provider?: { name: string; phone?: string };
  auto_assigned_order?: { order_number: string; total_amount: number; status: string };
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

      const { data: receipts, error: fetchError } = await supabase
        .from('payment_receipts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Obtener datos relacionados por separado para evitar errores de relación ambigua
      const enrichedReceipts = await Promise.all(receipts.map(async (receipt) => {
        // Buscar proveedor si hay assignment
        let providerData = null;
        if (receipt.auto_assigned_provider_id) {
          const { data: provider } = await supabase
            .from('providers')
            .select('name, phone')
            .eq('id', receipt.auto_assigned_provider_id)
            .single();
          providerData = provider;
        }

        // Buscar orden si hay assignment  
        let orderData = null;
        if (receipt.auto_assigned_order_id) {
          const { data: order } = await supabase
            .from('orders')
            .select('order_number, total_amount, status')
            .eq('id', receipt.auto_assigned_order_id)
            .single();
          orderData = order;
        }

        return {
          ...receipt,
          auto_assigned_provider: providerData,
          auto_assigned_order: orderData
        };
      }));

      setReceipts(enrichedReceipts || []);
      return enrichedReceipts || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error obteniendo comprobantes';
      setError(errorMessage);
      console.error('❌ [usePaymentReceipts] Error obteniendo comprobantes:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 🔧 SOLUCIÓN CRÍTICA: Configurar suscripción en tiempo real con estabilidad
  const subscriptionInitializedRef = useRef<Set<string>>(new Set());
  
  const setupRealtimeSubscription = useCallback((userId: string) => {
    // 🚫 PREVENIR: Múltiples suscripciones simultaneas por usuario
    if (subscriptionInitializedRef.current.has(userId)) {
      return;
    }
    
    subscriptionInitializedRef.current.add(userId);
    
    // Limpiar suscripción anterior
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    
    subscriptionRef.current = supabase
      .channel(`payment_receipts_stable_${userId}`) // Nombre único y estable
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
            const newReceipt = payload.new as PaymentReceiptData;
            setReceipts(prev => {
              // Verificar que no existe ya
              const exists = prev.find(r => r.id === newReceipt.id);
              if (exists) {
                return prev;
              }
              return [newReceipt, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedReceipt = payload.new as PaymentReceiptData;
            setReceipts(prev => prev.map(receipt => 
              receipt.id === updatedReceipt.id 
                ? { ...receipt, ...updatedReceipt }
                : receipt
            ));
          } else if (payload.eventType === 'DELETE') {
            const deletedReceipt = payload.old as PaymentReceiptData;
            setReceipts(prev => prev.filter(receipt => receipt.id !== deletedReceipt.id));
          }
        }
      )
        .subscribe((status) => {
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            subscriptionInitializedRef.current.clear();
          }
        });
  }, []);

  // Limpiar suscripción al desmontar
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      subscriptionInitializedRef.current.clear();
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
