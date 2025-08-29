'use client';

import { useState } from 'react';
import { Clock, AlertTriangle, Plus, Calendar } from 'lucide-react';
import { StockItem, Provider } from '../types';
import es from '../locales/es';

interface SuggestedOrder {
  id: string;
  productName: string;
  category: string;
  suggestedQuantity: number;
  unit: string;
  reason: 'low_stock' | 'restock_due' | 'seasonal';
  urgency: 'high' | 'medium' | 'low';
  suggestedProviders: Provider[];
  estimatedCost: number;
  currency: string;
}

interface SuggestedOrdersProps {
  stockItems: StockItem[];
  providers: Provider[];
  onCreateOrder: (suggestedOrder: SuggestedOrder) => void;
}

export default function SuggestedOrders({
  stockItems,
  providers,
  onCreateOrder,
}: SuggestedOrdersProps) {
  
  const [selectedOrder, setSelectedOrder] = useState<SuggestedOrder | null>(null);

  // 🔧 OPTIMIZACIÓN: Deshabilitar órdenes sugeridas temporalmente
  const generateSuggestedOrders = (): SuggestedOrder[] => {
    // Retornar array vacío para deshabilitar sugerencias
    return [];
  };

  const suggestedOrders = generateSuggestedOrders();

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'low_stock':
        return <AlertTriangle className="h-4 w-4" />;
      case 'restock_due':
        return <Clock className="h-4 w-4" />;
      case 'seasonal':
        return <Calendar className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getReasonText = (reason: string) => {
    switch (reason) {
      case 'low_stock':
        return es.stock.lowStockAlert;
      case 'restock_due':
        return es.stock.useRestockFrequency;
      case 'seasonal':
        return es.stock.managementTips;
      default:
        return 'Desconocido';
    }
  };

  // 🔧 OPTIMIZACIÓN: Mostrar mensaje de deshabilitado
  return (
    <div className="text-center py-8">
      <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
      <p className="text-sm text-gray-500">Órdenes sugeridas deshabilitadas</p>
      <p className="text-xs text-gray-400 mt-1">
        Funcionalidad temporalmente desactivada
      </p>
    </div>
  );
} 