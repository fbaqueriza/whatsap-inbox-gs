'use client';

import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Link, Unlink, Upload, Filter, Search, Eye } from 'lucide-react';

interface Document {
  id: string;
  filename: string;
  file_url: string;
  file_size: number;
  file_type: 'factura' | 'comprobante' | 'catalogo' | 'foto' | 'other';
  mime_type: string;
  status: 'pending' | 'processing' | 'processed' | 'assigned' | 'error';
  sender_phone: string;
  whatsapp_message_id: string;
  extracted_text?: string;
  ocr_data?: any;
  confidence_score?: number;
  created_at: string;
  updated_at: string;
  processed_at?: string;
  order_id?: string;
  providers: {
    id: string;
    name: string;
    phone: string;
  };
}

interface ProviderDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: {
    id: string;
    name: string;
    phone: string;
  };
  userId: string;
}

export default function ProviderDocumentsModal({ 
  isOpen, 
  onClose, 
  provider, 
  userId 
}: ProviderDocumentsModalProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [orders, setOrders] = useState<{[key: string]: any}>({});

  // Cargar documentos cuando se abre el modal o cambian los filtros
  useEffect(() => {
    if (isOpen && provider.id) {
      loadDocuments();
    }
  }, [isOpen, provider.id, filterType]);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        provider_id: provider.id,
        user_id: userId,
        limit: '100'
      });

      if (filterType !== 'all') {
        params.append('file_type', filterType);
      }

      const response = await fetch(`/api/documents/provider?${params}`);
      const data = await response.json();

      if (data.success) {
        setDocuments(data.data.documents);
        setStats(data.data.stats);
        
        // Cargar órdenes asociadas
        const orderIds = data.data.documents
          .filter((doc: any) => doc.order_id)
          .map((doc: any) => doc.order_id);
        
        console.log('🔍 [ProviderDocumentsModal] Total documentos:', data.data.documents.length);
        console.log('🔍 [ProviderDocumentsModal] Documentos con order_id:', orderIds.length);
        console.log('🔍 [ProviderDocumentsModal] Order IDs encontrados:', orderIds);
        
        // Debug: Mostrar todos los documentos y sus order_ids
        data.data.documents.forEach((doc: any, index: number) => {
          console.log(`📄 [ProviderDocumentsModal] Doc ${index + 1}:`, {
            filename: doc.filename,
            order_id: doc.order_id,
            status: doc.status,
            file_type: doc.file_type
          });
        });
        
        if (orderIds.length > 0) {
          await loadOrders(orderIds);
        }
      } else {
        setError(data.error || 'Error cargando documentos');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (orderIds: string[]) => {
    try {
      console.log('🔍 [ProviderDocumentsModal] Cargando órdenes para IDs:', orderIds);
      
      // Importar Supabase client
      const { supabase } = await import('../lib/supabase/client');
      
      // Cargar órdenes directamente desde Supabase
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .in('id', orderIds);
      
      if (error) {
        console.error('❌ [ProviderDocumentsModal] Error cargando órdenes:', error);
        return;
      }
      
      if (ordersData) {
        const ordersMap: {[key: string]: any} = {};
        ordersData.forEach((order: any) => {
          ordersMap[order.id] = order;
          console.log('✅ [ProviderDocumentsModal] Orden cargada:', {
            id: order.id,
            orderNumber: order.order_number,
            status: order.status,
            totalAmount: order.total_amount
          });
        });
        console.log('📊 [ProviderDocumentsModal] Órdenes cargadas:', Object.keys(ordersMap).length);
        setOrders(ordersMap);
      }
    } catch (err) {
      console.error('❌ [ProviderDocumentsModal] Error loading orders:', err);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('provider_id', provider.id);
      formData.append('user_id', userId);
      formData.append('file_type', 'other');

      const response = await fetch('/api/documents/provider', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setSelectedFile(null);
        loadDocuments(); // Recargar lista
      } else {
        setError(data.error || 'Error subiendo archivo');
      }
    } catch (err) {
      setError('Error subiendo archivo');
      console.error('Error uploading file:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleLinkDocument = async (documentId: string, orderId: string, linkType: 'factura' | 'comprobante') => {
    try {
      const response = await fetch('/api/documents/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId,
          orderId,
          linkType,
          userId
        })
      });

      const data = await response.json();

      if (data.success) {
        loadDocuments(); // Recargar lista
      } else {
        setError(data.error || 'Error linkeando documento');
      }
    } catch (err) {
      setError('Error linkeando documento');
      console.error('Error linking document:', err);
    }
  };

  const handleUnlinkDocument = async (documentId: string, orderId: string) => {
    try {
      const response = await fetch(`/api/documents/link?document_id=${documentId}&order_id=${orderId}&user_id=${userId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        loadDocuments(); // Recargar lista
      } else {
        setError(data.error || 'Error deslinkeando documento');
      }
    } catch (err) {
      setError('Error deslinkeando documento');
      console.error('Error unlinking document:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'factura': return '📄';
      case 'comprobante': return '🧾';
      case 'catalogo': return '📋';
      case 'foto': return '📷';
      default: return '📁';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'processed': return 'text-green-600 bg-green-100';
      case 'assigned': return 'text-purple-600 bg-purple-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.extracted_text?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || doc.file_type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              📁 Documentos de {provider.name}
            </h2>
            <p className="text-gray-600 mt-1">
              {provider.phone}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>


        {/* Filters and Search */}
        <div className="p-6 border-b">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos los tipos</option>
                <option value="factura">Facturas</option>
                <option value="comprobante">Comprobantes</option>
                <option value="catalogo">Catálogos</option>
                <option value="foto">Fotos</option>
                <option value="other">Otros</option>
              </select>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="p-6 border-b bg-gray-50">
          <div className="flex items-center gap-4">
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleFileUpload}
              disabled={!selectedFile || uploading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Subiendo...' : 'Subir'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
            {error}
          </div>
        )}

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Cargando documentos...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No hay documentos para mostrar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex gap-4">
                    {/* Main Content - Left Side */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getFileTypeIcon(doc.file_type)}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{doc.filename}</h3>
                          <div className="flex items-center gap-3 text-xs text-gray-600">
                            <span>{formatFileSize(doc.file_size)}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                              {doc.status}
                            </span>
                            <span>{new Date(doc.created_at).toLocaleDateString('es-AR')}</span>
                            {doc.confidence_score && (
                              <span className="text-blue-600">
                                {(doc.confidence_score * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* OCR Text Preview - Compact */}
                      {doc.extracted_text && (
                        <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                          📄 {doc.extracted_text.substring(0, 120)}...
                        </div>
                      )}
                    </div>

                    {/* Structured Data and Order Info - Right Side */}
                    <div className="w-96 flex-shrink-0 flex gap-2">
                      {/* Invoice Data */}
                      <div className="flex-1">
                        {doc.ocr_data ? (
                          <div className="bg-blue-50 rounded p-2">
                            <h4 className="font-medium text-blue-900 mb-1 text-xs">📊 Datos Factura:</h4>
                            <div className="space-y-1 text-xs">
                              {doc.ocr_data.invoiceNumber && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">N°:</span>
                                  <span className="text-blue-900 font-semibold">{doc.ocr_data.invoiceNumber}</span>
                                </div>
                              )}
                              {doc.ocr_data.totalAmount && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Monto:</span>
                                  <span className="text-green-600 font-semibold">${doc.ocr_data.totalAmount.toLocaleString('es-AR')}</span>
                                </div>
                              )}
                              {doc.ocr_data.providerTaxId && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">CUIT:</span>
                                  <span className="text-blue-900 font-semibold">{doc.ocr_data.providerTaxId}</span>
                                </div>
                              )}
                              {!doc.ocr_data.invoiceNumber && !doc.ocr_data.totalAmount && !doc.ocr_data.providerTaxId && (
                                <div className="text-center text-gray-500 text-xs">
                                  Sin datos estructurados
                                </div>
                              )}
                            </div>
                          </div>
                        ) : doc.status === 'processed' && (
                          <div className="bg-yellow-50 rounded p-2">
                            <p className="text-xs text-yellow-700">
                              ⚠️ Procesado sin datos estructurados
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Order Information - More Prominent */}
                      {doc.order_id && orders[doc.order_id] && (
                        <div className="flex-1">
                          <div className="bg-green-50 rounded p-2 border-l-4 border-green-400">
                            <h4 className="font-medium text-green-900 mb-1 text-xs">📋 Orden Asociada:</h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Número:</span>
                                <span className="text-green-900 font-semibold">{orders[doc.order_id].orderNumber || orders[doc.order_id].order_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Estado:</span>
                                <span className={`font-semibold ${
                                  orders[doc.order_id].status === 'pendiente_de_pago' ? 'text-orange-600' :
                                  orders[doc.order_id].status === 'pagado' ? 'text-green-600' :
                                  orders[doc.order_id].status === 'comprobante_enviado' ? 'text-emerald-600' :
                                  'text-blue-600'
                                }`}>
                                  {orders[doc.order_id].status === 'pagado' ? 'Pagado' :
                                   orders[doc.order_id].status === 'comprobante_enviado' ? 'Comprobante enviado' :
                                   orders[doc.order_id].status}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Monto:</span>
                                <span className="text-green-900 font-semibold">${(orders[doc.order_id].totalAmount || orders[doc.order_id].total_amount || 0).toLocaleString('es-AR')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions - Right Side */}
                    <div className="flex items-center gap-1 ml-2">
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-600 hover:text-blue-600 transition-colors"
                        title="Ver/Descargar documento"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                      {doc.order_id ? (
                        <button
                          onClick={() => handleUnlinkDocument(doc.id, doc.order_id!)}
                          className="p-1.5 text-gray-600 hover:text-red-600 transition-colors"
                          title="Deslinkear de orden"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const orderId = prompt('ID de la orden a linkear:');
                            if (orderId) {
                              const linkType = doc.file_type === 'factura' ? 'factura' : 'comprobante';
                              handleLinkDocument(doc.id, orderId, linkType);
                            }
                          }}
                          className="p-1.5 text-gray-600 hover:text-blue-600 transition-colors"
                          title="Linkear a orden"
                        >
                          <Link className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
