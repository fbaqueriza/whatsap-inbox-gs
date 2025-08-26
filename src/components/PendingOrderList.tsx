'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Send, CheckCircle, XCircle } from 'lucide-react';
import { usePendingOrdersRealtime } from '../hooks/useSupabaseRealtime';

interface PendingOrder {
  order_id: string;
  provider_id: string;
  provider_phone: string;
  order_data: {
    order: any;
    provider: any;
    items: any[];
  };
  status: string;
  created_at: string;
  user_id?: string;
}

export default function PendingOrderList() {
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPendingOrders();
  }, []);

  const loadPendingOrders = async () => {
    try {
      const response = await fetch('/api/whatsapp/get-all-pending-orders', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPendingOrders(data.pendingOrders || []);
      } else {
        console.error('Error cargando pedidos pendientes:', response.statusText);
      }
    } catch (error) {
      console.error('Error cargando pedidos pendientes:', error);
    }
  };

  // MANEJADORES REALTIME
  const handleNewPendingOrder = useCallback((payload: any) => {
    console.log('🔄 Nueva orden pendiente recibida via Realtime:', payload);
    const newOrder = payload.new;
    
    if (newOrder) {
      setPendingOrders(prev => {
        // Verificar si la orden ya existe
        const orderExists = prev.some(order => order.order_id === newOrder.order_id);
        if (orderExists) {
          return prev;
        }
        
        // Agregar la nueva orden al inicio
        return [newOrder, ...prev];
      });
    }
  }, []);

  const handlePendingOrderUpdate = useCallback((payload: any) => {
    console.log('🔄 Orden pendiente actualizada via Realtime:', payload);
    const updatedOrder = payload.new;
    
    if (updatedOrder) {
      setPendingOrders(prev => 
        prev.map(order => 
          order.order_id === updatedOrder.order_id ? updatedOrder : order
        )
      );
    }
  }, []);

  const handlePendingOrderDelete = useCallback((payload: any) => {
    console.log('🔄 Orden pendiente eliminada via Realtime:', payload);
    const deletedOrder = payload.old;
    
    if (deletedOrder) {
      setPendingOrders(prev => 
        prev.filter(order => order.order_id !== deletedOrder.order_id)
      );
    }
  }, []);

  // SUSCRIPCIÓN REALTIME
  usePendingOrdersRealtime(
    handleNewPendingOrder,
    handlePendingOrderUpdate,
    handlePendingOrderDelete
  );

  const removePendingOrder = async (providerPhone: string) => {
    try {
      const response = await fetch('/api/whatsapp/remove-pending-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerPhone }),
      });

      if (response.ok) {
        // La actualización se manejará automáticamente via Realtime
        console.log('✅ Orden pendiente removida, actualización automática via Realtime');
      } else {
        console.error('Error removiendo pedido pendiente:', response.statusText);
      }
    } catch (error) {
      console.error('Error removiendo pedido pendiente:', error);
    }
  };

  if (pendingOrders.length === 0) {
    return null; // No mostrar nada si no hay pedidos pendientes
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-yellow-800 flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          Pedidos Pendientes de Confirmación ({pendingOrders.length})
        </h3>
        <button
          onClick={loadPendingOrders}
          className="text-sm text-yellow-600 hover:text-yellow-800"
        >
          Actualizar
        </button>
      </div>

      <div className="space-y-3">
        {pendingOrders.map((pendingOrder, index) => (
          <div key={index} className="bg-white border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">
                  {pendingOrder.order_data.provider.name}
                </h4>
                <p className="text-sm text-gray-600">
                  Pedido: {pendingOrder.order_data.order.orderNumber || 'N/A'}
                </p>
                <p className="text-xs text-gray-500">
                  Creado: {new Date(pendingOrder.created_at).toLocaleString('es-AR')}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => removePendingOrder(pendingOrder.provider_phone)}
                  className="inline-flex items-center px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-yellow-700">
        💡 Los detalles del pedido se enviarán automáticamente cuando el proveedor responda al mensaje inicial.
      </div>
    </div>
  );
} 