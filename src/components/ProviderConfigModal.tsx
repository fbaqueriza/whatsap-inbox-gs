'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, User, Mail, Phone, MapPin, Building, CreditCard, Edit, Upload, FileText, Eye } from 'lucide-react';
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
}

export default function ProviderConfigModal({
  isOpen,
  onClose,
  provider,
  isEditing = false,
  onSave,
  onAdd,
  onCatalogUpload,
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
  });

  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [catalogFileName, setCatalogFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        defaultDeliveryDays: [],
        defaultDeliveryTime: [] as string[],
        defaultPaymentMethod: 'efectivo',
      });
    }
  }, [provider, isEditing, isOpen]);

  const handleInputChange = (field: string, value: string | string[]) => {
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Días de entrega por defecto
                </label>
                <WeekDaySelector
                  value={formData.defaultDeliveryDays}
                  onChange={(days) => handleInputChange('defaultDeliveryDays', days)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horario de entrega por defecto
                </label>
                <div className="space-y-2">
                  <input
                    type="time"
                    value={formData.defaultDeliveryTime[0] || ''}
                    onChange={(e) => handleInputChange('defaultDeliveryTime', [e.target.value])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Hora de entrega"
                  />
                  <p className="text-xs text-gray-500">
                    Formato: HH:MM (24 horas)
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de pago por defecto
                </label>
                <PaymentMethodSelector
                  value={formData.defaultPaymentMethod}
                  onChange={(method) => handleInputChange('defaultPaymentMethod', method)}
                  className="w-full"
                />
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