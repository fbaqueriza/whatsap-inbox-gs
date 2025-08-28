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

  // Generate suggested orders based on stock data
  const generateSuggestedOrders = (): SuggestedOrder[] => {
    const suggestions: SuggestedOrder[] = [];
    const now = new Date();
    stockItems.forEach((item) => {
      // Calculate average consumption per period (last 3 completed orders)
      // This is a mock: in real use, you would fetch real consumption data
      let avgConsumption = undefined;
      if (item.consumptionHistory && item.consumptionHistory.length >= 3) {
        const lastThree = item.consumptionHistory.slice(-3);
        avgConsumption = lastThree.reduce((a, b) => a + b, 0) / lastThree.length;
      }
      // Suggest restock if today is near or past próxima orden
      if (item.nextOrder && new Date(item.nextOrder) <= now) {
        const suggestedProviders = providers.filter((p) =>
          item.associatedProviders.includes(p.id),
        );
        if (suggestedProviders.length > 0) {
          suggestions.push({
            id: `restock-${item.id}`,
            productName: item.productName,
            category: item.category,
            suggestedQuantity: avgConsumption ? Math.ceil(avgConsumption) : item.quantity,
            unit: item.unit,
            reason: 'restock_due',
            urgency: 'medium',
            suggestedProviders,
            estimatedCost: (avgConsumption ? Math.ceil(avgConsumption) : item.quantity) * 2.5, // Mock price
            currency: 'EUR',
          });
        }
      }
    });
    return suggestions.sort((a, b) => {
      const urgencyOrder = { high: 3, medium: 2, low: 1 };
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    });
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

  if (suggestedOrders.length === 0) {
    return (
      <div className="text-center py-4">
        <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{es.orders.noSuggestedOrders}</p>
        <p className="text-xs text-gray-400 mt-1">
          {es.orders.allItemsStocked}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          {es.orders.suggestedOrders} ({suggestedOrders.length})
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {es.orders.basedOnStock}
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {suggestedOrders.map((order) => (
          <div key={order.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  {getReasonIcon(order.reason)}
                  <h4 className="font-medium text-gray-900">
                    {order.productName}
                  </h4>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getUrgencyColor(
                      order.urgency,
                    )}`}
                  >
                    {order.urgency.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                  <div>
                    <span className="font-medium">{es.stock.category}:</span> {order.category}
                  </div>
                  <div>
                    <span className="font-medium">{es.stock.quantity}:</span>{' '}
                    {order.suggestedQuantity} {order.unit}
                  </div>
                  <div>
                    <span className="font-medium">{es.orders.reason}:</span>{' '}
                    {getReasonText(order.reason)}
                  </div>
                  <div>
                    <span className="font-medium">{es.orders.estimatedCost}:</span>{' '}
                    {order.estimatedCost} {order.currency}
                  </div>
                </div>

                <div className="mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    {es.orders.suggestedProviders}:
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {order.suggestedProviders.map((provider) => (
                      <span
                        key={provider.id}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {provider.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ml-4">
                <button
                  onClick={() => onCreateOrder(order)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {es.orders.createOrder}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 