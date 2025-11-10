'use client';

import React, { useState } from 'react';
import { Phone, TestTube, CheckCircle, AlertCircle, Loader2, Zap } from 'lucide-react';
import { useWhatsAppConfig } from '../hooks/useWhatsAppConfig';

interface WhatsAppInitialSetupProps {
  onSetupComplete?: (config: any) => void;
}

export default function WhatsAppInitialSetup({ onSetupComplete }: WhatsAppInitialSetupProps) {
  const { setupSandbox, setupRealNumber, error } = useWhatsAppConfig();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [setupType, setSetupType] = useState<'sandbox' | 'real' | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSandboxSetup = async () => {
    setIsLoading(true);
    setSuccess(null);
    setSetupType('sandbox');

    try {
      const success = await setupSandbox();
      if (success) {
        setSuccess('¡Sandbox configurado exitosamente! Puedes probar el chat con mensajes simulados.');
        if (onSetupComplete) {
          onSetupComplete({ type: 'sandbox' });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRealNumberSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      return;
    }

    setIsLoading(true);
    setSuccess(null);
    setSetupType('real');

    try {
      // Normalizar número de teléfono
      let normalizedPhone = phoneNumber.replace(/[^\d+]/g, '');
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+' + normalizedPhone;
      }
      if (normalizedPhone.startsWith('+54') && normalizedPhone.length === 13) {
        // Número ya está en formato correcto
      } else if (normalizedPhone.startsWith('+') && normalizedPhone.length === 11) {
        normalizedPhone = '+54' + normalizedPhone.substring(1);
      }

      const success = await setupRealNumber(normalizedPhone);
      if (success) {
        setSuccess('¡Número de WhatsApp configurado exitosamente!');
        setPhoneNumber('');
        if (onSetupComplete) {
          onSetupComplete({ type: 'real', phoneNumber: normalizedPhone });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Phone className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Configurar WhatsApp
          </h1>
          <p className="text-gray-600">
            Para usar el chat con proveedores, necesitas configurar tu número de WhatsApp
          </p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-green-800">{success}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Opción Sandbox */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TestTube className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Probar con Sandbox
                </h3>
                <p className="text-gray-600 mb-4">
                  Configura un número de prueba para testing. Los mensajes se simularán y no se enviarán realmente.
                </p>
                <button
                  onClick={handleSandboxSetup}
                  disabled={isLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isLoading && setupType === 'sandbox' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Configurando...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      <span>Configurar Sandbox</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Opción Número Real */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Phone className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Configurar Número Real
                </h3>
                <p className="text-gray-600 mb-4">
                  Configura tu número de WhatsApp Business para recibir mensajes reales de proveedores.
                </p>
                
                <form onSubmit={handleRealNumberSetup} className="space-y-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Número de WhatsApp Business
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+54 11 1234-5678"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Incluye el código de país (ej: +54 para Argentina)
                    </p>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isLoading || !phoneNumber.trim()}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isLoading && setupType === 'real' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Configurando...</span>
                      </>
                    ) : (
                      <>
                        <Phone className="h-4 w-4" />
                        <span>Configurar Número</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            ¿Qué hace esta configuración?
          </h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Crea una configuración de WhatsApp en Kapso</li>
            <li>• Configura webhooks para recibir mensajes</li>
            <li>• Permite recibir mensajes de proveedores</li>
            <li>• Habilita el procesamiento de documentos</li>
            <li>• <strong>Sandbox:</strong> Para testing sin mensajes reales</li>
            <li>• <strong>Número Real:</strong> Para uso en producción</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
