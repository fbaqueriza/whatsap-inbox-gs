'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle, AlertCircle, DollarSign, Calendar, FileText } from 'lucide-react';
import { useAutoOCR } from '../hooks/useAutoOCR';

interface PaymentReceiptUploadProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrderIds: string[];
  onSuccess: () => void;
}

export default function PaymentReceiptUpload({
  isOpen,
  onClose,
  selectedOrderIds,
  onSuccess
}: PaymentReceiptUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('transferencia');
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileForOCR, setCurrentFileForOCR] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(acceptedFiles);
    // 🔧 NUEVO: Procesar automáticamente el primer archivo con OCR
    if (acceptedFiles.length > 0) {
      const fileUrl = URL.createObjectURL(acceptedFiles[0]);
      setCurrentFileForOCR(fileUrl);
    }
  }, []);

  // 🔧 NUEVO: Hook para OCR automático
  const { isProcessing: isOCRProcessing, progress: ocrProgress, status: ocrStatus } = useAutoOCR({
    fileUrl: currentFileForOCR,
    onOCRComplete: useCallback((result) => {
      console.log('✅ OCR automático completado:', result);
      // Auto-llenar campos con datos extraídos
      if (result.extractedData.totalAmount) {
        setPaymentAmount(result.extractedData.totalAmount.toString());
      }
      if (result.extractedData.invoiceDate) {
        setPaymentDate(new Date(result.extractedData.invoiceDate).toISOString().split('T')[0]);
      }
      setCurrentFileForOCR(null);
    }, []),
    onError: useCallback((error) => {
      console.error('❌ Error en OCR automático:', error);
      setCurrentFileForOCR(null);
    }, []),
    autoProcess: true
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    multiple: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (files.length === 0 || !paymentAmount || selectedOrderIds.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('orderIds', selectedOrderIds.join(','));
      formData.append('paymentAmount', paymentAmount);
      formData.append('paymentDate', paymentDate);
      formData.append('paymentMethod', paymentMethod);
      formData.append('notes', notes);

      // Simular progreso de subida
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/facturas/upload-payment-receipt', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (data.success) {
        // Limpiar formulario
        setFiles([]);
        setPaymentAmount('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('transferencia');
        setNotes('');
        
        // Cerrar modal y notificar éxito
        onSuccess();
        onClose();
      } else {
        throw new Error(data.error || 'Error al subir el comprobante');
      }
    } catch (error) {
      console.error('Error subiendo comprobante:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Subir Comprobante de Pago
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Información de órdenes seleccionadas */}
          <div className="mb-4 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>{selectedOrderIds.length}</strong> factura{selectedOrderIds.length !== 1 ? 's' : ''} seleccionada{selectedOrderIds.length !== 1 ? 's' : ''}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dropzone para archivos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comprobante de Pago
              </label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                {isDragActive ? (
                  <p className="text-blue-600">Suelta el archivo aquí...</p>
                ) : (
                  <div>
                    <p className="text-gray-600">
                      Arrastra y suelta el archivo aquí, o <span className="text-blue-600">haz clic para seleccionar</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      PDF, PNG, JPG hasta 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Archivos seleccionados */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 🔧 NUEVO: Indicador de procesamiento OCR automático */}
            {isOCRProcessing && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-blue-600 animate-pulse" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">
                      Procesando factura con OCR automático...
                    </p>
                    <p className="text-xs text-blue-700 mt-1">{ocrStatus}</p>
                    <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      {ocrProgress}% completado
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Monto del pago */}
            <div>
              <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="inline-block w-4 h-4 mr-1" />
                Monto del Pago
              </label>
              <input
                type="number"
                id="paymentAmount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                step="0.01"
                min="0"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            {/* Fecha del pago */}
            <div>
              <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline-block w-4 h-4 mr-1" />
                Fecha del Pago
              </label>
              <input
                type="date"
                id="paymentDate"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Método de pago */}
            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="efectivo">Efectivo</option>
                <option value="cheque">Cheque</option>
                <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            {/* Notas */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notas (opcional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Información adicional sobre el pago..."
              />
            </div>

            {/* Barra de progreso */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subiendo archivo...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isUploading || files.length === 0 || !paymentAmount}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Subiendo...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Subir Comprobante
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
