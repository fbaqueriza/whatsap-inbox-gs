'use client';

import React, { useState, useCallback, useRef } from 'react';
import { 
  Upload, 
  X, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  DollarSign,
  Calendar,
  CreditCard,
  User,
  Send,
  Loader2
} from 'lucide-react';
// Removed direct import of PaymentReceiptService - using API endpoints instead

interface PaymentReceiptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrderIds: string[];
  onSuccess: () => void;
  userId: string;
}

interface UploadedFile {
  file: File;
  id: string;
  preview: string;
}

export default function PaymentReceiptUploadModal({
  isOpen,
  onClose,
  selectedOrderIds,
  onSuccess,
  userId
}: PaymentReceiptUploadModalProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadResults, setUploadResults] = useState<{ [key: string]: { success: boolean; error?: string } }>({});
  // Removed manual payment data input - will be extracted automatically
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Resetear estado cuando se abre/cierra el modal
  React.useEffect(() => {
    if (isOpen) {
      setUploadedFiles([]);
      setUploadProgress({});
      setUploadResults({});
    }
  }, [isOpen]);

  // Manejar drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  // Manejar selección de archivos
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  }, []);

  const handleFiles = useCallback((files: File[]) => {
    const validFiles = files.filter(file => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024; // 10MB max
    });

    const newFiles: UploadedFile[] = validFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

  // Remover archivo
  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
    
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
    
    setUploadResults(prev => {
      const newResults = { ...prev };
      delete newResults[fileId];
      return newResults;
    });
  }, []);

  // Subir comprobantes
  const handleUpload = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      alert('Por favor selecciona al menos un archivo');
      return;
    }

    // Los datos de pago se extraerán automáticamente del documento

    setIsUploading(true);
    setUploadProgress({});
    setUploadResults({});

    const results: { [key: string]: { success: boolean; error?: string } } = {};

    for (const uploadedFile of uploadedFiles) {
      try {
        setUploadProgress(prev => ({ ...prev, [uploadedFile.id]: 0 }));
        
        // Simular progreso
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            const current = prev[uploadedFile.id] || 0;
            if (current < 90) {
              return { ...prev, [uploadedFile.id]: current + 10 };
            }
            return prev;
          });
        }, 200);

        // Subir archivo usando API endpoint - los datos se extraerán automáticamente
        const formData = new FormData();
        formData.append('file', uploadedFile.file);
        formData.append('userId', userId);

        const response = await fetch('/api/payment-receipts/upload', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        clearInterval(progressInterval);
        setUploadProgress(prev => ({ ...prev, [uploadedFile.id]: 100 }));

        results[uploadedFile.id] = {
          success: result.success,
          error: result.error
        };

      } catch (error) {
        results[uploadedFile.id] = {
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        };
      }
    }

    setUploadResults(results);
    setIsUploading(false);

    // Verificar si todos fueron exitosos
    const allSuccessful = Object.values(results).every(r => r.success);
    if (allSuccessful) {
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    }
  }, [uploadedFiles, userId, onSuccess, onClose]);

  // Limpiar URLs de preview al desmontar
  React.useEffect(() => {
    return () => {
      uploadedFiles.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [uploadedFiles]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Subir Comprobantes de Pago
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Los datos se extraerán automáticamente del documento
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Sube los comprobantes de pago para {selectedOrderIds.length} orden(es) seleccionada(s)
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Información sobre extracción automática */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">
                  Extracción Automática de Datos
                </h4>
                <p className="text-sm text-blue-700">
                  Los datos del pago (monto, fecha, método, etc.) se extraerán automáticamente del documento usando tecnología OCR.
                </p>
              </div>
            </div>
          </div>

          {/* Zona de subida de archivos */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <Upload className="h-4 w-4 mr-2" />
              Archivos de Comprobantes
            </h4>
            
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-2">
                Arrastra y suelta los archivos aquí, o
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                selecciona archivos
              </button>
              <p className="text-xs text-gray-500 mt-2">
                PDF, JPG, PNG (máximo 10MB por archivo)
              </p>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Lista de archivos subidos */}
          {uploadedFiles.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Archivos Seleccionados ({uploadedFiles.length})
              </h4>
              <div className="space-y-2">
                {uploadedFiles.map((uploadedFile) => (
                  <div
                    key={uploadedFile.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {uploadedFile.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {/* Progreso de subida - solo mostrar si está subiendo y no hay resultado */}
                      {uploadProgress[uploadedFile.id] !== undefined && !uploadResults[uploadedFile.id] && (
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress[uploadedFile.id]}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {uploadProgress[uploadedFile.id]}%
                          </span>
                        </div>
                      )}
                      
                      {/* Resultado de subida - solo mostrar si hay resultado */}
                      {uploadResults[uploadedFile.id] && (
                        <div className="flex items-center">
                          {uploadResults[uploadedFile.id].success ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                      )}
                      
                      {/* Botón de eliminar - solo mostrar si no está subiendo */}
                      {!isUploading && !uploadResults[uploadedFile.id] && (
                        <button
                          onClick={() => removeFile(uploadedFile.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mensajes de error */}
          {Object.entries(uploadResults).some(([_, result]) => !result.success) && (
            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-red-800 mb-2">
                  Errores en la subida:
                </h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {Object.entries(uploadResults)
                    .filter(([_, result]) => !result.success)
                    .map(([fileId, result]) => {
                      const file = uploadedFiles.find(f => f.id === fileId);
                      return (
                        <li key={fileId}>
                          • {file?.file.name}: {result.error}
                        </li>
                      );
                    })}
                </ul>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading || uploadedFiles.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Subir Comprobantes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
