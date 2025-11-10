'use client';

import React, { useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { Phone, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface WhatsAppSetupProps {
  onSetupComplete?: (config: any) => void;
}

export default function WhatsAppSetup({ onSetupComplete }: WhatsAppSetupProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      setError('Por favor ingresa un número de teléfono');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Obtener token de autenticación
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No estás autenticado. Por favor inicia sesión.');
      }

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

      console.log('🔧 [WhatsAppSetup] Configurando número:', normalizedPhone);

      // Llamar a la API para configurar el número
      const response = await fetch('/api/kapso/setup-number', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: normalizedPhone
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error configurando número');
      }

      console.log('✅ [WhatsAppSetup] Configuración exitosa:', data);
      
      setSuccess('¡Número de WhatsApp configurado exitosamente!');
      
      if (onSetupComplete) {
        onSetupComplete(data.config);
      }

      // Limpiar formulario
      setPhoneNumber('');

    } catch (error) {
      console.error('❌ [WhatsAppSetup] Error:', error);
      setError(error instanceof Error ? error.message : 'Error configurando número');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-md mx-auto">
      <div className="flex items-center space-x-3 mb-4">
        <Phone className="h-6 w-6 text-green-600" />
        <h2 className="text-lg font-semibold text-gray-900">
          Configurar WhatsApp
        </h2>
      </div>

      <p className="text-gray-600 mb-4">
        Configura tu número de WhatsApp para recibir mensajes de proveedores.
      </p>

      <form onSubmit={handleSetup} className="space-y-4">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Número de WhatsApp
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

        {error && (
          <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-md">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !phoneNumber.trim()}
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Configurando...</span>
            </>
          ) : (
            <span>Configurar WhatsApp</span>
          )}
        </button>
      </form>

      <div className="mt-4 p-3 bg-blue-50 rounded-md">
        <h3 className="text-sm font-medium text-blue-900 mb-1">
          ¿Qué hace esta configuración?
        </h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Crea una configuración de WhatsApp en Kapso</li>
          <li>• Configura webhooks para recibir mensajes</li>
          <li>• Permite recibir mensajes de proveedores</li>
          <li>• Habilita el procesamiento de documentos</li>
        </ul>
      </div>
    </div>
  );
}
