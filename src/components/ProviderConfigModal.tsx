'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, User, Mail, Phone, MapPin, Building, CreditCard, Edit, Upload, FileText, Eye, Trash2 } from 'lucide-react';
import { Provider, Catalog } from '../types';
import PaymentMethodSelector from './PaymentMethodSelector';
import WeekDaySelector from './WeekDaySelector';


interface ProviderConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null;
  isEditing?: boolean;
  onSave: (updatedProvider: Provider) => void;
  onAdd?: (providerData: Omit<Provider, 'id' | 'createdAt' | 'updatedAt' | 'user_id'>) => void;
  onCatalogUpload?: (providerId: string, file: File) => Promise<void>;
  prefill?: { cuitCuil?: string; razonSocial?: string; name?: string; address?: string } | null;
}

export default function ProviderConfigModal({
  isOpen,
  onClose,
  provider,
  isEditing = false,
  onSave,
  onAdd,
  onCatalogUpload,
  prefill,
}: ProviderConfigModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    categories: '',
    notes: '',
    cbu: '',
    alias: '',
    cuitCuil: '',
    razonSocial: '',
    defaultDeliveryDays: [] as string[],
    defaultDeliveryTime: [] as string[],
    defaultPaymentMethod: 'efectivo' as 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque',
    paymentTermDays: 30, // Plazo de pago en días (por defecto: 30)
    autoOrderFlowEnabled: true, // Por defecto activado
  });

  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [catalogFileName, setCatalogFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Cargar items de la factura desde sessionStorage
  useEffect(() => {
    if (isOpen && !isEditing) {
      try {
        const storedItems = sessionStorage.getItem('invoiceItems');
        console.log('📦 [ProviderModal] Cargando items de sessionStorage:', !!storedItems);
        if (storedItems) {
          const parsed = JSON.parse(storedItems);
          console.log('📦 [ProviderModal] Items parseados:', parsed.length, parsed);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setInvoiceItems(parsed);
            // Guardar en sessionStorage para que estén disponibles al finalizar
            sessionStorage.setItem('invoiceItems', JSON.stringify(parsed));
          } else {
            console.log('⚠️ [ProviderModal] Items vacíos o no es array');
            setInvoiceItems([]);
          }
        } else {
          console.log('⚠️ [ProviderModal] No hay items en sessionStorage');
          setInvoiceItems([]);
        }
      } catch (e) {
        console.warn('Error cargando items de factura:', e);
        setInvoiceItems([]);
      }
    } else if (!isOpen) {
      // No limpiar items al cerrar modal - mantenerlos por si se vuelve a abrir
      // Solo limpiar cuando se cierra definitivamente o se guarda el proveedor
    }
  }, [isOpen, isEditing]);

  // Initialize form when provider changes
  useEffect(() => {
    // console.log('DEBUG: ProviderConfigModal - useEffect triggered:', { provider: provider?.name, isEditing, isOpen });
    
    if (provider && isEditing && isOpen) {
      // console.log('DEBUG: ProviderConfigModal - Loading provider data for editing:', provider);
      // console.log('DEBUG: ProviderConfigModal - Provider config fields:', {
      //   defaultDeliveryDays: provider.defaultDeliveryDays,
      //   defaultDeliveryTime: provider.defaultDeliveryTime,
      //   defaultPaymentMethod: provider.defaultPaymentMethod
      // });
      
      setFormData({
        name: provider.name || '',
        contactName: provider.contactName || '',
        email: provider.email || '',
        phone: provider.phone || '',
        address: provider.address || '',
        categories: Array.isArray(provider.categories) ? provider.categories.join('; ') : '',
        notes: provider.notes || '',
        cbu: provider.cbu || '',
        alias: provider.alias || '',
        cuitCuil: provider.cuitCuil || '',
        razonSocial: provider.razonSocial || '',
        defaultDeliveryDays: provider.defaultDeliveryDays || [],
        defaultDeliveryTime: Array.isArray(provider.defaultDeliveryTime) ? provider.defaultDeliveryTime : (provider.defaultDeliveryTime ? [provider.defaultDeliveryTime] : []) as string[],
        defaultPaymentMethod: provider.defaultPaymentMethod || 'efectivo',
        paymentTermDays: provider.paymentTermDays || 30, // Plazo de pago en días
        autoOrderFlowEnabled: provider.autoOrderFlowEnabled !== undefined ? provider.autoOrderFlowEnabled : true,
      });
      
      // console.log('DEBUG: ProviderConfigModal - Form data set:', {
      //   name: provider.name || '',
      //   defaultDeliveryDays: provider.defaultDeliveryDays || [],
      //   defaultDeliveryTime: Array.isArray(provider.defaultDeliveryTime) ? provider.defaultDeliveryTime : (provider.defaultDeliveryTime ? [provider.defaultDeliveryTime] : []) as string[],
      //   defaultPaymentMethod: provider.defaultPaymentMethod || 'efectivo',
      // });
    } else if (!isEditing && isOpen) {
      // console.log('DEBUG: ProviderConfigModal - Resetting form for new provider');
      // Reset form for new provider
      setFormData({
        name: prefill?.name || '',
        contactName: '',
        email: '',
        phone: '',
        address: '',
        categories: '',
        notes: '',
        cbu: '',
        alias: '',
        cuitCuil: prefill?.cuitCuil || '',
        razonSocial: prefill?.razonSocial || '',
        address: prefill?.address || '',
        defaultDeliveryDays: [],
        defaultDeliveryTime: [] as string[],
        defaultPaymentMethod: 'efectivo',
        paymentTermDays: 30, // Plazo de pago por defecto: 30 días
        autoOrderFlowEnabled: true,
      });
    }
  }, [provider, isEditing, isOpen, prefill]);

  const handleInputChange = (field: string, value: string | string[] | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCatalogUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCatalogFile(file);
      setCatalogFileName(file.name);
    }
  };

  const handleRemoveCatalog = () => {
    setCatalogFile(null);
    setCatalogFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Funciones para editar items
  const handleEditItem = (index: number) => {
    setEditingItemIndex(index);
  };

  const handleSaveItem = (index: number) => {
    setEditingItemIndex(null);
    // Guardar items modificados en sessionStorage
    sessionStorage.setItem('invoiceItems', JSON.stringify(invoiceItems));
  };

  const handleItemFieldChange = (index: number, field: string, value: string | number) => {
    const updatedItems = [...invoiceItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
      // Mantener compatibilidad con campos alternativos
      ...(field === 'name' && { description: value, productName: value }),
      ...(field === 'quantity' && { quantityItem: value }),
      ...(field === 'unit' && { unitItem: value }),
      ...(field === 'priceUnitNet' && { price_unit_net: value, unitPrice: value }),
      ...(field === 'priceTotalNet' && { price_total_net: value, total: value }),
    };
    setInvoiceItems(updatedItems);
  };

  const handleDeleteItem = (index: number) => {
    if (confirm('¿Estás seguro de que deseas eliminar este item?')) {
      const updatedItems = invoiceItems.filter((_, i) => i !== index);
      setInvoiceItems(updatedItems);
      sessionStorage.setItem('invoiceItems', JSON.stringify(updatedItems));
    }
  };

  const handleViewCatalog = () => {
    console.log('DEBUG: handleViewCatalog called with provider:', provider);
    console.log('DEBUG: provider.catalogs:', provider?.catalogs);
    
    if (!provider?.catalogs || provider.catalogs.length === 0) {
      console.log('DEBUG: No catalogs found');
      alert('Este proveedor no tiene catálogos cargados.');
      return;
    }
    
    const catalog = provider.catalogs[0];
    if (!catalog?.fileUrl) {
      console.log('DEBUG: Catalog found but no fileUrl');
      alert('El catálogo existe pero la URL no está disponible.');
      return;
    }
    
    console.log('DEBUG: Opening catalog URL:', catalog.fileUrl);
    try {
      // Verificar si es una URL válida (incluye data URLs)
      if (catalog.fileUrl.startsWith('blob:') || 
          catalog.fileUrl.startsWith('http') || 
          catalog.fileUrl.startsWith('data:')) {
        window.open(catalog.fileUrl, '_blank');
      } else {
        console.log('DEBUG: Invalid URL format:', catalog.fileUrl);
        alert('El formato de la URL del catálogo no es válido.');
      }
    } catch (error) {
      console.error('DEBUG: Error opening catalog:', error);
      alert('Error al abrir el catálogo. Verifica que la URL sea válida.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // console.log('DEBUG: ProviderConfigModal - handleSubmit called');
    // console.log('DEBUG: ProviderConfigModal - isEditing:', isEditing);
    // console.log('DEBUG: ProviderConfigModal - provider:', provider);
    // console.log('DEBUG: ProviderConfigModal - onAdd exists:', !!onAdd);
    // console.log('DEBUG: ProviderConfigModal - onAdd function:', onAdd);
    
    if (isEditing && provider) {
      // Update existing provider with all fields
      // console.log('DEBUG: ProviderConfigModal - Saving provider:', formData);
      
      const updatedProvider = {
        ...provider,
        name: formData.name,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        categories: formData.categories.split(';').filter(cat => cat.trim()),
        notes: formData.notes,
        cbu: formData.cbu,
        alias: formData.alias,
        cuitCuil: formData.cuitCuil,
        razonSocial: formData.razonSocial,
        defaultDeliveryDays: formData.defaultDeliveryDays,
        defaultDeliveryTime: formData.defaultDeliveryTime as string[],
        defaultPaymentMethod: formData.defaultPaymentMethod,
        paymentTermDays: formData.paymentTermDays,
        autoOrderFlowEnabled: formData.autoOrderFlowEnabled,
        updatedAt: new Date(),
      };
      
      // Call onSave with the full updated provider
      onSave(updatedProvider);

      // Handle catalog upload if there's a new file
      if (catalogFile && onCatalogUpload) {
        console.log('DEBUG: Uploading catalog for provider:', provider.id);
        onCatalogUpload(provider.id, catalogFile).catch((error) => {
          console.error('DEBUG: Error uploading catalog:', error);
          alert('Error al subir el catálogo. Intenta nuevamente.');
        });
      }
    } else if (onAdd) {
      // Add new provider
      console.log('DEBUG: ProviderConfigModal - Adding new provider with formData:', formData);
      const newProvider = {
        ...formData,
        categories: formData.categories.split(';').filter(cat => cat.trim()),
        tags: [],
        catalogs: [] as Catalog[], // Catalogs will be handled separately via onCatalogUpload
      };
      console.log('DEBUG: ProviderConfigModal - Calling onAdd with:', newProvider);
      
      try {
        onAdd(newProvider);
        console.log('DEBUG: ProviderConfigModal - onAdd called successfully');
        // Guardar items modificados en sessionStorage antes de limpiar (para que finalize-assignment los use)
        if (invoiceItems.length > 0) {
          sessionStorage.setItem('invoiceItems', JSON.stringify(invoiceItems));
        }
        // No limpiar items aún - se limpiarán después de finalizar la asignación
      } catch (error) {
        console.error('DEBUG: ProviderConfigModal - Error calling onAdd:', error);
      }

      // Handle catalog upload for new provider
      if (catalogFile && onCatalogUpload) {
        // We'll need to get the provider ID after it's created
        // For now, we'll handle this in the parent component
        console.log('DEBUG: New provider created with catalog file:', catalogFile.name);
      }
    } else {
      console.log('DEBUG: ProviderConfigModal - Neither isEditing nor onAdd available');
    }
    
    onClose();
  };

  // console.log('DEBUG: ProviderConfigModal - Render check:', { isOpen, provider: provider?.name, isEditing });
  
  // Don't render if modal is not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? (
                <>
                  <Edit className="inline h-5 w-5 mr-2" />
                  Configurar {provider?.name}
                </>
              ) : (
                <>
                  <Plus className="inline h-5 w-5 mr-2" />
                  Agregar Nuevo Proveedor
                </>
              )}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {/* Información Básica */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 border-b pb-2 mb-3">
              <User className="inline h-4 w-4 mr-1" />
              Información Básica
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del proveedor *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Distribuidora Gastronómica S.A."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de contacto
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => handleInputChange('contactName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="inline h-4 w-4 mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="pedidos@proveedor.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="inline h-4 w-4 mr-1" />
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+54 11 4567-8901"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Av. Corrientes 1234, CABA"
                />
              </div>
            </div>
          </div>

          {/* Información Comercial */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 border-b pb-2 mb-3">
              <Building className="inline h-4 w-4 mr-1" />
              Información Comercial
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categorías
                </label>
                <input
                  type="text"
                  value={formData.categories}
                  onChange={(e) => handleInputChange('categories', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Proveeduría General; Lácteos; Frescos"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separa múltiples categorías con punto y coma (;)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CUIT/CUIL
                </label>
                <input
                  type="text"
                  value={formData.cuitCuil}
                  onChange={(e) => handleInputChange('cuitCuil', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="30-12345678-9"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razón Social
                </label>
                <input
                  type="text"
                  value={formData.razonSocial}
                  onChange={(e) => handleInputChange('razonSocial', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Distribuidora Gastronómica S.A."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CBU
                </label>
                <input
                  type="text"
                  value={formData.cbu}
                  onChange={(e) => handleInputChange('cbu', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ES9121000418450200051332"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alias
                </label>
                <input
                  type="text"
                  value={formData.alias}
                  onChange={(e) => handleInputChange('alias', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="DISTGASTRO"
                />
              </div>
            </div>
          </div>

          {/* Configuración de Entrega y Pago */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 border-b pb-2 mb-3">
              <CreditCard className="inline h-4 w-4 mr-1" />
              Configuración de Entrega y Pago
            </h3>

            <div className="space-y-3">
              {/* Entrega: Días y Horario en la misma línea */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Días de entrega
                  </label>
                  <WeekDaySelector
                    value={formData.defaultDeliveryDays}
                    onChange={(days) => handleInputChange('defaultDeliveryDays', days)}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Horario de entrega
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={formData.defaultDeliveryTime[0] || ''}
                      onChange={(e) => {
                        const startTime = e.target.value;
                        const endTime = formData.defaultDeliveryTime[1] || '';
                        handleInputChange('defaultDeliveryTime', [startTime, endTime]);
                      }}
                      className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="09:00"
                    />
                    <span className="text-gray-500 text-sm">-</span>
                    <input
                      type="time"
                      value={formData.defaultDeliveryTime[1] || ''}
                      onChange={(e) => {
                        const endTime = e.target.value;
                        const startTime = formData.defaultDeliveryTime[0] || '';
                        handleInputChange('defaultDeliveryTime', [startTime, endTime]);
                      }}
                      className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="18:00"
                    />
                  </div>
                </div>
              </div>

              {/* Pago: Método y Plazo en la misma línea */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Método de pago
                  </label>
                  <PaymentMethodSelector
                    value={formData.defaultPaymentMethod}
                    onChange={(method) => handleInputChange('defaultPaymentMethod', method)}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Plazo de pago (días)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={formData.paymentTermDays}
                    onChange={(e) => handleInputChange('paymentTermDays', parseInt(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="30"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Días hasta vencimiento (0 = inmediato)
                  </p>
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.autoOrderFlowEnabled}
                    onChange={(e) => handleInputChange('autoOrderFlowEnabled', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Activar flujo automático de órdenes
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Si está activado, el sistema procesará automáticamente los mensajes del proveedor para avanzar el estado de las órdenes
                </p>
              </div>
            </div>
          </div>

          {/* Catálogo */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 border-b pb-2 mb-3">
              <FileText className="inline h-4 w-4 mr-1" />
              Catálogo del Proveedor
            </h3>

            <div className="space-y-4">
              {/* Catálogo existente */}
              {provider?.catalogs?.[0] && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Catálogo actual
                      </p>
                      <p className="text-xs text-gray-500">
                        {provider.catalogs[0].fileName || 'Catálogo.pdf'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleViewCatalog}
                    className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </button>
                </div>
              )}

              {/* Nuevo catálogo */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {provider?.catalogs?.[0] ? 'Cambiar catálogo' : 'Cargar catálogo'}
                </label>
                
                <div className="flex items-center space-x-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleCatalogUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Seleccionar archivo
                  </button>
                  
                  {catalogFileName && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{catalogFileName}</span>
                      <button
                        type="button"
                        onClick={handleRemoveCatalog}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-gray-500">
                  Formatos aceptados: PDF, DOC, DOCX. Máximo 10MB.
                </p>
              </div>
            </div>
          </div>

          {/* Items Extraídos de Factura */}
          {invoiceItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 border-b pb-2 mb-3">
                <FileText className="inline h-4 w-4 mr-1" />
                Items Extraídos de Factura ({invoiceItems.length})
              </h3>
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-800 mb-3">
                  La factura procesada contiene los siguientes items que se agregarán a stock. Puedes editarlos si hay errores de extracción:
                </p>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {invoiceItems.map((item, idx) => (
                    <div key={idx} className="bg-white border border-green-200 rounded-md p-3">
                      {editingItemIndex === idx ? (
                        // Modo edición
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del producto</label>
                            <input
                              type="text"
                              value={item.name || item.description || item.productName || ''}
                              onChange={(e) => handleItemFieldChange(idx, 'name', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Nombre del producto"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad</label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.quantity || item.quantityItem || ''}
                                onChange={(e) => handleItemFieldChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Unidad</label>
                              <input
                                type="text"
                                value={item.unit || item.unitItem || ''}
                                onChange={(e) => handleItemFieldChange(idx, 'unit', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="un, kg, litros..."
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Precio unitario</label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.priceUnitNet || item.price_unit_net || item.unitPrice || ''}
                                onChange={(e) => handleItemFieldChange(idx, 'priceUnitNet', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Precio total</label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.priceTotalNet || item.price_total_net || item.total || ''}
                                onChange={(e) => handleItemFieldChange(idx, 'priceTotalNet', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end space-x-2 pt-2">
                            <button
                              type="button"
                              onClick={() => handleSaveItem(idx)}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemIndex(null)}
                              className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Modo visualización
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {item.name || item.description || item.productName || `Item ${idx + 1}`}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              Cantidad: {item.quantity || item.quantityItem || 1} {item.unit || item.unitItem || 'un'}
                            </p>
                            {item.category && (
                              <p className="text-xs text-gray-500 mt-1">
                                Categoría: {item.category}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            {(item.priceUnitNet || item.price_unit_net || item.unitPrice) && (
                              <p className="text-sm font-medium text-gray-900">
                                ${new Intl.NumberFormat('es-AR').format(item.priceUnitNet || item.price_unit_net || item.unitPrice || 0)}
                              </p>
                            )}
                            {(item.priceTotalNet || item.price_total_net || item.total) && (
                              <p className="text-xs text-gray-600">
                                Total: ${new Intl.NumberFormat('es-AR').format(item.priceTotalNet || item.price_total_net || item.total || 0)}
                              </p>
                            )}
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <button
                              type="button"
                              onClick={() => handleEditItem(idx)}
                              className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                              title="Editar item"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(idx)}
                              className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Eliminar item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notas */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas adicionales
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Información adicional sobre el proveedor..."
            />
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isEditing ? (
                <>
                  <Edit className="h-4 w-4 mr-1" />
                  Guardar configuración
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar Proveedor
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 