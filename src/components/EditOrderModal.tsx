'use client';

import { useState, useEffect } from 'react';
import { X, ShoppingCart, Upload, FileText, Calendar, CreditCard, Clock, ChevronDown, CheckCircle, Trash2, User } from 'lucide-react';
import { Order, OrderItem, Provider, OrderFile } from '../types';
import DeliveryDaysSelector from './DeliveryDaysSelector';
import DateSelector from './DateSelector';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  providers: Provider[];
  onSave: (orderId: string, updates: {
    desiredDeliveryDate?: Date;
    paymentMethod?: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque';
    additionalFiles?: OrderFile[];
    notes?: string;
    status?: string;
    providerId?: string;
  }) => void;
  onCancel?: (orderId: string) => void;
  onDelete?: (orderId: string) => void;
}

export default function EditOrderModal({
  isOpen,
  onClose,
  order,
  providers,
  onSave,
  onCancel,
  onDelete,
}: EditOrderModalProps) {
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'cheque'>('efectivo');
  const [additionalFiles, setAdditionalFiles] = useState<OrderFile[]>([]);
  const [notes, setNotes] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string>('');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');

  // Initialize form when order changes
  useEffect(() => {
    if (order) {
      setDesiredDeliveryDate(order.desiredDeliveryDate ? new Date(order.desiredDeliveryDate).toISOString().split('T')[0] : '');
      setPaymentMethod(order.paymentMethod || 'efectivo');
      setAdditionalFiles(order.additionalFiles || []);
      setNotes(order.notes || '');
      setOrderStatus(order.status || 'standby');
      setSelectedProviderId(order.providerId || '');
    }
  }, [order]);

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

  const handleSave = () => {
    if (!order) return;
    
    onSave(order.id, {
      desiredDeliveryDate: desiredDeliveryDate ? new Date(desiredDeliveryDate) : undefined,
      paymentMethod,
      additionalFiles,
      notes,
      status: orderStatus,
      providerId: selectedProviderId !== order.providerId ? selectedProviderId : undefined,
    });
    
    onClose();
  };

  const handleCancel = () => {
    if (!order || !onCancel) return;
    
    if (confirm('¿Estás seguro de que quieres cancelar este pedido? Esta acción cambiará el estado a "cancelado".')) {
      onCancel(order.id);
      onClose();
    }
  };

  const handleDelete = () => {
    if (!order || !onDelete) return;
    
    if (confirm('¿Estás seguro de que quieres eliminar esta orden? Esta acción no se puede deshacer.')) {
      onDelete(order.id);
      onClose();
    }
  };

  const getProvider = () => {
    if (!order) return null;
    const providerId = selectedProviderId || order.providerId;
    return providers.find(p => p.id === providerId);
  };

  const provider = getProvider();

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Editar Pedido - {provider?.name}
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
          <div className="space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline h-4 w-4 mr-1" />
                Proveedor
              </label>
              <select
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} - {provider.contactName}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Información del Pedido</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div><strong>Estado:</strong></div>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="standby">Standby</option>
                  <option value="enviado">Enviado</option>
                  <option value="esperando_factura">Esperando Factura</option>
                  <option value="pendiente_de_pago">Pendiente de Pago</option>
                  <option value="pagado">Pagado</option>
                  <option value="comprobante_enviado">Comprobante enviado</option>
                </select>
                <div className="mt-2"><strong>Fecha de creación:</strong> {new Date(order.orderDate).toLocaleDateString()}</div>
                {order.invoiceDate && <div><strong>Fecha de factura:</strong> {new Date(order.invoiceDate).toLocaleDateString()}</div>}
                {order.invoiceNumber && <div><strong>Número de factura:</strong> {order.invoiceNumber}</div>}
                <div><strong>Total:</strong> ${order.totalAmount} {order.currency}</div>
              </div>
            </div>

            {/* Order Items */}
            <div>
              <button
                type="button"
                onClick={() => setShowItems(!showItems)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-700 mb-2 hover:text-gray-900"
              >
                <div className="flex items-center">
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Ítems del pedido ({order.items?.length || 0})
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${showItems ? 'rotate-180' : ''}`} />
              </button>
              
              {showItems && (
                <div className="bg-white border border-gray-200 rounded-md p-3 max-h-48 overflow-y-auto">
                  {order.items && order.items.length > 0 ? (
                    <div className="space-y-1">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-b-0">
                          <div className="flex-1">
                            <div className="text-xs font-medium text-gray-900">{item.productName}</div>
                            <div className="text-xs text-gray-500">
                              {item.quantity} {item.unit}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-medium text-gray-900">
                              ${item.price || 0}
                            </div>
                            <div className="text-xs text-gray-500">
                              ${item.total || 0}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="pt-1 border-t border-gray-200">
                        <div className="flex justify-between text-xs font-semibold text-gray-900">
                          <span>Total:</span>
                          <span>${order.totalAmount} {order.currency}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-center py-2 text-xs">
                      No hay ítems en este pedido
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delivery Date */}
            <DateSelector
              value={desiredDeliveryDate}
              onChange={setDesiredDeliveryDate}
              providerDeliveryDays={provider?.defaultDeliveryDays}
              providerDeliveryTime={provider?.defaultDeliveryTime}
            />

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CreditCard className="inline h-4 w-4 mr-1" />
                Método de pago
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
              {provider?.defaultPaymentMethod && (
                <p className="mt-1 text-xs text-gray-500">
                  Método por defecto del proveedor: {provider.defaultPaymentMethod}
                </p>
              )}
            </div>

            {/* Additional Files */}
            <div>
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
                  id="edit-file-upload"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                />
                <label
                  htmlFor="edit-file-upload"
                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingFiles ? 'Subiendo...' : 'Agregar archivos'}
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
            <div>
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
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <div className="flex space-x-3">
            {onDelete && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar orden
              </button>
            )}
            {onCancel && (
              <button
                onClick={handleCancel}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar pedido
              </button>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
