'use client';

import React from 'react';
import { useData } from './DataProvider';

export default function DebugPanel() {
  const { orders, loading } = useData();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-90 text-white p-4 rounded-lg max-w-md z-50">
      <h3 className="text-sm font-bold mb-2">🔍 DEBUG PANEL</h3>
      
      <div className="text-xs space-y-1">
        <div>📊 Total órdenes: {orders.length}</div>
        <div>⏳ Loading: {loading ? 'Sí' : 'No'}</div>
        
        {orders.length > 0 && (
          <div className="mt-2">
            <div className="font-semibold">📋 Primera orden:</div>
            <div className="ml-2">
              <div>ID: {orders[0].id?.substring(0, 8)}...</div>
              <div>Número: {orders[0].orderNumber}</div>
              <div>Fecha entrega: {orders[0].desiredDeliveryDate ? '✅' : '❌'}</div>
              <div>Horarios: {orders[0].desiredDeliveryTime ? '✅' : '❌'}</div>
              <div>Método pago: {orders[0].paymentMethod ? '✅' : '❌'}</div>
              <div>Archivos: {orders[0].additionalFiles ? '✅' : '❌'}</div>
            </div>
          </div>
        )}
        
        {orders.length > 0 && orders[0].desiredDeliveryDate && (
          <div className="mt-2 p-2 bg-green-800 rounded">
            <div className="font-semibold">🎯 DATOS DEL MODAL DETECTADOS:</div>
            <div className="ml-2">
              <div>Fecha: {orders[0].desiredDeliveryDate?.toLocaleDateString()}</div>
              <div>Horarios: {JSON.stringify(orders[0].desiredDeliveryTime)}</div>
              <div>Pago: {orders[0].paymentMethod}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
