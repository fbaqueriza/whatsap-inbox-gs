'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

interface CustomerData {
  name: string;
  business_name?: string;
  email?: string;
  phone?: string;
}

interface OnboardingProps {
  onCustomerCreated?: (customer: any) => void;
  onSetupLinkGenerated?: (link: string) => void;
  className?: string;
}

export default function CustomerOnboarding({ 
  onCustomerCreated, 
  onSetupLinkGenerated,
  className = '' 
}: OnboardingProps) {
  const [step, setStep] = useState<'form' | 'generating' | 'success' | 'error'>('form');
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: '',
    business_name: '',
    email: '',
    phone: ''
  });
  const [setupLink, setSetupLink] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: keyof CustomerData, value: string) => {
    setCustomerData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setLoading(true);
    setError('');
    setStep('generating');

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('Usuario no autenticado');
      }

      // Crear cliente en Kapso Platform
      const customerResponse = await fetch('/api/kapso/platform/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: customerData.name,
          external_customer_id: `customer_${user.id}_${Date.now()}`,
          metadata: {
            business_name: customerData.business_name,
            email: customerData.email,
            phone: customerData.phone,
            created_by: 'gastronomy-saas'
          }
        })
      });

      if (!customerResponse.ok) {
        const errorData = await customerResponse.json();
        throw new Error(errorData.error || 'Error creando cliente');
      }

      const { customer } = await customerResponse.json();
      onCustomerCreated?.(customer);

      // Generar link de configuración
      const setupLinkResponse = await fetch('/api/kapso/platform/setup-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customer.id,
          expires_in: 86400, // 24 horas
          metadata: {
            business_name: customerData.business_name,
            created_by: 'gastronomy-saas'
          }
        })
      });

      if (!setupLinkResponse.ok) {
        const errorData = await setupLinkResponse.json();
        throw new Error(errorData.error || 'Error generando link de configuración');
      }

      const { setup_link } = await setupLinkResponse.json();
      setSetupLink(setup_link.url);
      onSetupLinkGenerated?.(setup_link.url);
      
      setStep('success');

    } catch (err) {
      console.error('❌ [CustomerOnboarding] Error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('form');
    setCustomerData({
      name: '',
      business_name: '',
      email: '',
      phone: ''
    });
    setSetupLink('');
    setError('');
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(setupLink);
      // Aquí podrías mostrar una notificación de éxito
    } catch (err) {
      console.error('Error copiando al portapapeles:', err);
    }
  };

  if (step === 'generating') {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Configurando cliente...
          </h3>
          <p className="text-gray-600">
            Creando cliente en Kapso Platform y generando link de configuración.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className={`max-w-2xl mx-auto ${className}`}>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="text-center">
            <div className="text-green-500 text-6xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              ¡Cliente creado exitosamente!
            </h3>
            <p className="text-green-700 mb-4">
              El cliente ha sido creado en Kapso Platform. Comparte el siguiente link para que configure su WhatsApp:
            </p>
            
            <div className="bg-white border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={setupLink}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                >
                  Copiar
                </button>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Crear otro cliente
              </button>
              <button
                onClick={() => window.open(setupLink, '_blank')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Abrir link
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className={`max-w-2xl mx-auto ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">❌</div>
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              Error creando cliente
            </h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto ${className}`}>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Onboarding de Cliente
          </h2>
          <p className="text-gray-600">
            Crea un nuevo cliente en Kapso Platform para que pueda conectar su WhatsApp Business.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del cliente *
            </label>
            <input
              type="text"
              id="name"
              value={customerData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Juan Pérez"
              required
            />
          </div>

          <div>
            <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del negocio
            </label>
            <input
              type="text"
              id="business_name"
              value={customerData.business_name}
              onChange={(e) => handleInputChange('business_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Restaurante El Buen Sabor"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={customerData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="cliente@ejemplo.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              id="phone"
              value={customerData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+54 9 11 1234-5678"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !customerData.name.trim()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creando cliente...' : 'Crear cliente y generar link'}
          </button>
        </form>
      </div>
    </div>
  );
}
