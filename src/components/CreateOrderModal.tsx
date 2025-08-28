'use client';

import { useState, useEffect } from 'react';
import { X, ShoppingCart, AlertTriangle, Clock, RefreshCw, Upload, FileText, Calendar, CreditCard } from 'lucide-react';
import { Provider, OrderItem, StockItem, OrderFile } from '../types';
import DateSelector from './DateSelector';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (order: {
    providerId: string;
    items: OrderItem[];
    notes: string;
    desiredDeliveryDate?: Date;
    paymentMethod?: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque';
    additionalFiles?: OrderFile[];
  }) => void;
  providers: Provider[];
  stockItems: StockItem[];
  suggestedOrder?: {
    providerId?: string;
    providerName?: string;
  };
  isLoading?: boolean;
}

export default function CreateOrderModal({
  isOpen,
  onClose,
  onSubmit,
  providers,
  stockItems,
  suggestedOrder,
  isLoading = false,
}: CreateOrderModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [orderText, setOrderText] = useState('');
  const [notes, setNotes] = useState('');
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'cheque'>('efectivo');
  const [additionalFiles, setAdditionalFiles] = useState<OrderFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Set selectedProvider from suggestedOrder if present
  useEffect(() => {
    if (suggestedOrder?.providerId) {
      setSelectedProvider(suggestedOrder.providerId);
    }
  }, [suggestedOrder]);

  // Set default values when provider is selected
  useEffect(() => {
    if (selectedProvider) {
      const provider = providers.find(p => p.id === selectedProvider);
      if (provider) {
        // Set default payment method
        if (provider.defaultPaymentMethod) {
          setPaymentMethod(provider.defaultPaymentMethod);
        }
        
        // Set default delivery date based on provider's delivery days
        if (provider.defaultDeliveryDays && provider.defaultDeliveryTime) {
          const today = new Date();
          const deliveryDays = provider.defaultDeliveryDays;
          const deliveryTime = provider.defaultDeliveryTime;
          
          // Find next available delivery day
          let nextDeliveryDate = new Date();
          let daysToAdd = 0;
          
          while (daysToAdd < 14) { // Look up to 2 weeks ahead
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + daysToAdd);
            const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
            
            if (deliveryDays.includes(dayName)) {
              nextDeliveryDate = checkDate;
              break;
            }
            daysToAdd++;
          }
          
          // Set time - use first available time if it's an array
          const timeToUse = Array.isArray(deliveryTime) ? deliveryTime[0] : deliveryTime;
          if (timeToUse && typeof timeToUse === 'string') {
            const [hours, minutes] = timeToUse.split(':');
            nextDeliveryDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          }
          
          setDesiredDeliveryDate(nextDeliveryDate.toISOString().split('T')[0]);
        }
      }
    }
  }, [selectedProvider, providers]);

  // Generate suggested order text when provider is selected
  useEffect(() => {
    if (selectedProvider && !suggestedOrder) {
      const provider = providers.find(p => p.id === selectedProvider);
      if (provider) {
        const now = new Date();
        const weekFromNow = new Date();
        weekFromNow.setDate(now.getDate() + 7);
        // Suggest items where associatedProviders includes selectedProvider and preferredProvider is empty or matches
        const matchingItems = stockItems.filter(stock =>
          stock.associatedProviders.includes(selectedProvider) &&
          (!stock.preferredProvider || stock.preferredProvider === selectedProvider)
        );
        // Urgent items first (nextOrder due soon)
        const urgentItems = matchingItems.filter(stock => stock.nextOrder && new Date(stock.nextOrder) <= weekFromNow);
        const nonUrgentItems = matchingItems.filter(stock => !urgentItems.includes(stock));
        const itemsToSuggest = [...urgentItems, ...nonUrgentItems];
        if (itemsToSuggest.length > 0) {
          const suggestedText = itemsToSuggest.map(stock => {
            let suggestedQty = stock.quantity;
            if (Array.isArray(stock.consumptionHistory) && stock.consumptionHistory.length > 0) {
              suggestedQty = Math.round(stock.consumptionHistory.reduce((a, b) => a + b, 0) / stock.consumptionHistory.length);
            }
            // Elimina el status del final
            return `${stock.productName}: ${suggestedQty} ${stock.unit}`;
          }).join('\n');
          setOrderText(suggestedText);
        } else {
          setOrderText('');
        }
      }
    } else if (suggestedOrder) {
      // Handle suggested order from sidebar
      const suggestedText = `${suggestedOrder.productName}: ${suggestedOrder.suggestedQuantity} ${suggestedOrder.unit} - $0 (SUGERIDO)`;
      setOrderText(suggestedText);
    }
  }, [selectedProvider, providers, stockItems, suggestedOrder]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedProvider('');
      setOrderText('');
      setNotes('');
      setDesiredDeliveryDate('');
      setPaymentMethod('efectivo');
      setAdditionalFiles([]);
    }
  }, [isOpen]);

  const parseOrderText = (text: string): OrderItem[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const items: OrderItem[] = [];

    lines.forEach(line => {
      // Permite formato: "Producto: cantidad unidad" (sin precio)
      const match = line.match(/^(.+?):\s*(\d+(?:\.\d+)?)\s+(\w+)/);
      if (match) {
        const [, productName, quantity, unit] = match;
        items.push({
          productName: productName.trim(),
          quantity: parseFloat(quantity),
          unit: unit.trim(),
          price: 0,
          total: 0,
        });
      }
    });

    return items;
  };

  const handleFileUpload = async (files: FileList) => {
    setUploadingFiles(true);
    try {
      const newFiles: OrderFile[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = Date.now().toString() + i;
        
        // Simular subida de archivo (en producción esto iría a Supabase Storage)
        const mockFileUrl = URL.createObjectURL(file);
        
        newFiles.push({
          id: fileId,
          fileName: file.name,
          fileUrl: mockFileUrl,
          fileSize: file.size,
          uploadedAt: new Date(),
          description: '',
        });
      }
      
      setAdditionalFiles(prev => [...prev, ...newFiles]);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error al subir archivos. Intenta nuevamente.');
    } finally {
      setUploadingFiles(false);
    }
  };

  const removeFile = (fileId: string) => {
    setAdditionalFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProvider) return;
    
    onSubmit({
      providerId: selectedProvider,
      items: parseOrderText(orderText),
      notes,
      desiredDeliveryDate: desiredDeliveryDate ? new Date(desiredDeliveryDate) : undefined,
      paymentMethod,
      additionalFiles,
    });
  };

  const totalAmount = parseOrderText(orderText).reduce((sum, item) => sum + item.total, 0);

  // Get provider info for display
  const selectedProviderInfo = providers.find(p => p.id === selectedProvider);

  // Haz el resumen del pedido expandible/colapsable
  const [showSummary, setShowSummary] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Crear nuevo pedido
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <form onSubmit={handleSubmit}>
            {/* Provider Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecciona proveedor *
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Elige un proveedor...</option>
                                 {providers.map((provider) => (
                                   <option key={provider.id} value={provider.id}>
                  {provider.name} - {provider.contactName}
                </option>
                 ))}
              </select>
              
              {selectedProviderInfo && (
                <div className="mt-2 p-3 bg-blue-50 rounded-md">
                  <div className="text-sm text-blue-800">
                    <strong>Categorías del proveedor:</strong> {selectedProviderInfo.categories.join(', ')}
                  </div>
                  {selectedProviderInfo.notes && (
                    <div className="text-sm text-blue-700 mt-1">
                      <strong>Notas:</strong> {selectedProviderInfo.notes}
                    </div>
                  )}
                  {selectedProviderInfo.defaultDeliveryDays && selectedProviderInfo.defaultDeliveryTime && (
                    <div className="text-sm text-blue-700 mt-1">
                      <strong>Entrega:</strong> {selectedProviderInfo.defaultDeliveryDays.join(', ')} a las {selectedProviderInfo.defaultDeliveryTime}
                    </div>
                  )}
                  {selectedProviderInfo.defaultPaymentMethod && (
                    <div className="text-sm text-blue-700 mt-1">
                      <strong>Pago por defecto:</strong> {selectedProviderInfo.defaultPaymentMethod}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delivery Date and Payment Method */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Delivery Date */}
              <DateSelector
                value={desiredDeliveryDate}
                onChange={setDesiredDeliveryDate}
                providerDeliveryDays={selectedProviderInfo?.defaultDeliveryDays}
                providerDeliveryTime={selectedProviderInfo?.defaultDeliveryTime}
              />

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <CreditCard className="inline h-4 w-4 mr-1" />
                  Método de pago
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'efectivo', label: 'Efectivo', icon: '💵' },
                    { value: 'transferencia', label: 'Transferencia', icon: '🏦' },
                    { value: 'tarjeta', label: 'Tarjeta', icon: '💳' },
                    { value: 'cheque', label: 'Cheque', icon: '📄' },
                  ].map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value as any)}
                      className={`p-3 border rounded-lg text-center transition-colors ${
                        paymentMethod === method.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{method.icon}</div>
                      <div className="text-sm font-medium">{method.label}</div>
                    </button>
                  ))}
                </div>
                {selectedProviderInfo?.defaultPaymentMethod && (
                  <p className="mt-1 text-xs text-gray-500">
                    Método por defecto del proveedor: {selectedProviderInfo.defaultPaymentMethod}
                  </p>
                )}
              </div>
            </div>

            {/* Order Items Text */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-medium text-gray-900">Ítems del pedido</h3>
              </div>

              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ítems del pedido (Formato: Producto: Cantidad Unidad - Precio)
                </label>
              </div>

              <textarea
                value={orderText}
                onChange={(e) => setOrderText(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="Selecciona un proveedor para ver ítems sugeridos..."
              />

              {/* Order Summary */}
              {orderText.trim() && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <button
                    type="button"
                    className="text-blue-600 text-sm mb-2 focus:outline-none"
                    onClick={() => setShowSummary(s => !s)}
                  >
                    {showSummary ? 'Ocultar resumen' : 'Mostrar resumen'}
                  </button>
                  {showSummary && (
                    <>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Resumen del pedido</h4>
                      <div className="space-y-2">
                        {parseOrderText(orderText).map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>
                              {item.productName} - {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between font-semibold">
                          <span>Total:</span>
                          <span>${totalAmount.toFixed(0)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Additional Files */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="inline h-4 w-4 mr-1" />
                Archivos adicionales
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  multiple
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingFiles ? 'Subiendo...' : 'Seleccionar archivos'}
                </label>
                <p className="mt-2 text-sm text-gray-500">
                  PDF, imágenes, documentos (máx. 10MB por archivo)
                </p>
              </div>

              {/* File List */}
              {additionalFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-gray-900">Archivos adjuntos:</h4>
                  {additionalFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 text-gray-500 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Instrucciones especiales o notas de entrega..."
              />
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
    
                disabled={!selectedProvider || !orderText.trim()}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                Crear pedido
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 