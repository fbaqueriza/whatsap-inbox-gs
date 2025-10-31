"use client";

import React, { useState } from 'react';
import { 
  Phone, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft,
  Zap,
  Shield,
  Info
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface WhatsAppWizardProps {
  onComplete: (config: any) => void;
  onCancel: () => void;
}

type WizardStep = 'select' | 'sandbox' | 'production' | 'kapso-platform' | 'credentials' | 'validation' | 'complete';

export default function WhatsAppWizard({ onComplete, onCancel }: WhatsAppWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Datos del formulario
  const [formData, setFormData] = useState({
    // Sandbox
    useSandbox: false,
    
    // Production
    phone_number_id: '',
    access_token: '',
    business_account_id: '',
    display_phone_number: '',
    verified_name: '',
    webhook_url: '',
    
    // Kapso Platform
    useKapsoPlatform: false,
    business_name: '',
    
    // Estado del flujo
    customer_id: '',
    setup_link: ''
  });

  const handleNext = () => {
    setError(null);
    
    switch (currentStep) {
      case 'select':
        if (formData.useSandbox) {
          setCurrentStep('sandbox');
        } else if (formData.useKapsoPlatform) {
          setCurrentStep('kapso-platform');
        } else {
          setCurrentStep('credentials');
        }
        break;
      case 'sandbox':
        setCurrentStep('complete');
        break;
      case 'kapso-platform':
        setCurrentStep('complete');
        break;
      case 'credentials':
        setCurrentStep('validation');
        break;
      case 'validation':
        setCurrentStep('complete');
        break;
    }
  };

  const handleBack = () => {
    setError(null);
    
    switch (currentStep) {
      case 'sandbox':
      case 'credentials':
      case 'kapso-platform':
        setCurrentStep('select');
        break;
      case 'validation':
        setCurrentStep('credentials');
        break;
      case 'complete':
        setCurrentStep('select');
        break;
    }
  };

  const handleKapsoPlatformSetup = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Paso 1: Crear customer en Kapso Platform
      console.log('🚀 [Wizard] Iniciando creación de customer...');
      const customerResponse = await fetch('/api/whatsapp/create-kapso-customer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          business_name: formData.business_name || 'Mi Empresa'
        })
      });
      
      console.log('📱 [Wizard] Respuesta del customer:', customerResponse.status);
      const customerData = await customerResponse.json();
      console.log('📱 [Wizard] Datos del customer:', customerData);
      
      if (!customerData.success) {
        throw new Error(customerData.error || 'Error creando customer en Kapso');
      }
      
      // Guardar customer_id
      setFormData(prev => ({ ...prev, customer_id: customerData.customer_id }));
      
      // Paso 2: Crear setup link
      console.log('🔗 [Wizard] Iniciando creación de setup link...');
      const setupLinkResponse = await fetch('/api/whatsapp/create-setup-link', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🔗 [Wizard] Respuesta del setup link:', setupLinkResponse.status);
      const setupLinkData = await setupLinkResponse.json();
      console.log('🔗 [Wizard] Datos del setup link:', setupLinkData);
      
      if (!setupLinkData.success) {
        throw new Error(setupLinkData.error || 'Error creando setup link');
      }
      
      // Guardar customer_id y setup link
      setFormData(prev => ({ 
        ...prev, 
        customer_id: customerData.customer_id,
        setup_link: setupLinkData.setup_link.url 
      }));
      
      // Avanzar al paso de completado
      setCurrentStep('complete');
      
      // No llamar onComplete aquí, dejar que el usuario vea el setup link
      // onComplete se llamará cuando haga clic en "Finalizar"
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSandboxSetup = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/whatsapp/sandbox', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Error configurando sandbox');
      }
      
      const data = await response.json();
      
      // Avanzar al paso de completado
      setCurrentStep('complete');
      
      // No llamar onComplete aquí, dejar que el usuario vea el resultado
      // onComplete se llamará cuando haga clic en "Finalizar"
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateCredentials = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/whatsapp/validate-meta-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone_number_id: formData.phone_number_id,
          access_token: formData.access_token,
          business_account_id: formData.business_account_id
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error validando credenciales');
      }
      
      // Actualizar datos con la respuesta de validación
      setFormData(prev => ({
        ...prev,
        display_phone_number: data.data.display_phone_number,
        verified_name: data.data.verified_name
      }));
      
      setCurrentStep('validation');
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProductionConfig = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/whatsapp/create-production-config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone_number_id: formData.phone_number_id,
          access_token: formData.access_token,
          display_phone_number: formData.display_phone_number,
          verified_name: formData.verified_name,
          business_account_id: formData.business_account_id,
          webhook_url: formData.webhook_url
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error creando configuración de producción');
      }
      
      onComplete(data);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'select':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ¿Cómo quieres configurar WhatsApp?
              </h3>
              <p className="text-gray-600">
                Elige el método que mejor se adapte a tu situación
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Opción Sandbox */}
              <div 
                className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.useSandbox 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, useSandbox: true }))}
              >
                <div className="flex items-center mb-3">
                  <Zap className="w-6 h-6 text-blue-600 mr-3" />
                  <h4 className="font-semibold text-gray-900">Sandbox (Pruebas)</h4>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Configuración rápida para pruebas y desarrollo
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Número de prueba gratuito</li>
                  <li>• Configuración automática</li>
                  <li>• Ideal para desarrollo</li>
                </ul>
              </div>
              
              {/* Opción Kapso Platform */}
              <div 
                className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.useKapsoPlatform 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, useSandbox: false, useKapsoPlatform: true }))}
              >
                <div className="flex items-center mb-3">
                  <Settings className="w-6 h-6 text-purple-600 mr-3" />
                  <h4 className="font-semibold text-gray-900">Kapso Platform</h4>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Flujo simplificado usando Kapso Platform para conectar WhatsApp
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Crear customer en Kapso</li>
                  <li>• Generar setup link</li>
                  <li>• Usuario conecta en 5 minutos</li>
                </ul>
              </div>
              
              {/* Opción Producción */}
              <div 
                className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                  !formData.useSandbox && !formData.useKapsoPlatform
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, useSandbox: false, useKapsoPlatform: false }))}
              >
                <div className="flex items-center mb-3">
                  <Shield className="w-6 h-6 text-green-600 mr-3" />
                  <h4 className="font-semibold text-gray-900">Tengo Credenciales</h4>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Ya tengo mi cuenta de Meta Business configurada
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Phone Number ID</li>
                  <li>• Access Token</li>
                  <li>• Configuración rápida</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'sandbox':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Zap className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Configuración de Sandbox
              </h3>
              <p className="text-gray-600">
                Se configurará automáticamente un número de prueba
              </p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">¿Qué es el Sandbox?</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Número de WhatsApp de prueba gratuito</li>
                    <li>• Perfecto para desarrollo y testing</li>
                    <li>• Configuración automática en segundos</li>
                    <li>• Puedes cambiar a producción más tarde</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'kapso-platform':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Settings className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Configuración con Kapso Platform
              </h3>
              <p className="text-gray-600">
                Usaremos Kapso Platform para crear un customer y generar un setup link
              </p>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                <div>
                  <h4 className="font-medium text-purple-900 mb-2">¿Qué hace Kapso Platform?</h4>
                  <ul className="text-sm text-purple-800 space-y-1">
                    <li>• Crea un customer único para tu usuario</li>
                    <li>• Genera un setup link para conectar WhatsApp</li>
                    <li>• El usuario sigue un proceso de 5 minutos</li>
                    <li>• Configuración automática de webhooks</li>
                    <li>• Cada usuario mantiene su propio WhatsApp</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900 mb-2">✅ Ventajas del Flujo Oficial</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Cumple con la documentación oficial de Kapso</li>
                    <li>• Escalable para múltiples usuarios</li>
                    <li>• Seguro - usuarios mantienen control de sus credenciales</li>
                    <li>• Proceso estándar de la industria</li>
                    <li>• Soporte oficial de Kapso</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de tu Empresa *
                </label>
                <input
                  type="text"
                  value={formData.business_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Mi Empresa SRL"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este nombre aparecerá en Kapso Platform
                </p>
              </div>
            </div>
          </div>
        );

      case 'credentials':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Shield className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Credenciales de Meta Business API
              </h3>
              <p className="text-gray-600">
                Ingresa las credenciales de tu aplicación de Meta Developers
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number ID *
                </label>
                <input
                  type="text"
                  value={formData.phone_number_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone_number_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="1234567890"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Token *
                </label>
                <input
                  type="password"
                  value={formData.access_token}
                  onChange={(e) => setFormData(prev => ({ ...prev, access_token: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="EAA..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Account ID (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.business_account_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, business_account_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="1234567890"
                />
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900 mb-2">¿Dónde encuentro estas credenciales?</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Ve a <a href="https://developers.facebook.com/" target="_blank" className="underline">Meta Developers</a></li>
                    <li>• Selecciona tu aplicación</li>
                    <li>• Ve a WhatsApp &gt; API Setup</li>
                    <li>• Copia el Phone Number ID y Access Token</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'validation':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Credenciales Validadas
              </h3>
              <p className="text-gray-600">
                Tus credenciales han sido verificadas exitosamente
              </p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="space-y-2">
                <p className="text-sm text-green-800">
                  <strong>Número:</strong> {formData.display_phone_number}
                </p>
                <p className="text-sm text-green-800">
                  <strong>Nombre:</strong> {formData.verified_name || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ¡Configuración Completada!
              </h3>
              <p className="text-gray-600 mb-4">
                Tu configuración de WhatsApp ha sido creada exitosamente
              </p>
              
              {/* Mostrar setup link si está disponible */}
              {formData.setup_link && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">
                    ✅ ¡Setup Link Real Generado!
                  </h4>
                  <p className="text-sm text-green-700 mb-3">
                    Tu customer ha sido creado y el setup link real está listo. Haz clic en el botón para comenzar el proceso de conexión de WhatsApp:
                  </p>
                  <div className="space-y-3">
                    <div className="bg-white border border-blue-300 rounded p-3">
                      <p className="text-sm font-semibold text-blue-900 mb-2">Customer ID:</p>
                      <code className="text-sm text-blue-800 break-all">
                        {formData.customer_id}
                      </code>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <p className="text-sm font-semibold text-green-800 mb-2">🚀 Conectar WhatsApp Business:</p>
                      <div className="space-y-2">
                        <a 
                          href={formData.setup_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg text-sm hover:bg-green-700 transition-colors font-semibold shadow-md"
                        >
                          🚀 Conectar WhatsApp Business
                        </a>
                        <p className="text-xs text-green-700">
                          Este enlace te llevará al proceso completo de configuración de WhatsApp Business en Kapso
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <p className="text-sm font-semibold text-blue-800 mb-2">📋 Proceso Automático:</p>
                      <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                        <li>El enlace te llevará directamente al proceso de configuración</li>
                        <li>Selecciona "Coexistencia" o "Dedicado" según tus necesidades</li>
                        <li>Conecta tu cuenta de Facebook Business</li>
                        <li>Verifica tu número de WhatsApp</li>
                        <li>¡Listo! Tu WhatsApp estará conectado automáticamente</li>
                      </ol>
                      <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded">
                        <p className="text-xs text-green-800">
                          <strong>✅ Ventaja:</strong> Todo el proceso se maneja automáticamente por Kapso. 
                          No necesitas credenciales técnicas de Meta.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'select':
        return true;
      case 'sandbox':
        return true;
      case 'kapso-platform':
        return formData.business_name && formData.business_name.length > 2;
      case 'credentials':
        return formData.phone_number_id && formData.access_token;
      case 'validation':
        return true;
      case 'complete':
        return true;
      default:
        return false;
    }
  };

  const getNextButtonText = () => {
    switch (currentStep) {
      case 'select':
        return 'Continuar';
      case 'sandbox':
        return 'Configurar Sandbox';
      case 'kapso-platform':
        return 'Crear Customer y Setup Link';
      case 'credentials':
        return 'Validar Credenciales';
      case 'validation':
        return 'Crear Configuración';
      default:
        return 'Finalizar';
    }
  };

  const handleNextClick = async () => {
    if (currentStep === 'sandbox') {
      await handleSandboxSetup();
    } else if (currentStep === 'kapso-platform') {
      await handleKapsoPlatformSetup();
    } else if (currentStep === 'credentials') {
      await handleValidateCredentials();
    } else if (currentStep === 'validation') {
      await handleCreateProductionConfig();
    } else if (currentStep === 'complete') {
      // Cerrar el wizard cuando se complete
      onComplete({
        success: true,
        customer_id: formData.customer_id,
        setup_link: formData.setup_link,
        message: 'Configuración completada exitosamente'
      });
    } else {
      handleNext();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Configurar WhatsApp
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>Paso 1</span>
              <span>Paso 2</span>
              <span>Paso 3</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: currentStep === 'select' ? '33%' : 
                       currentStep === 'sandbox' || currentStep === 'credentials' || currentStep === 'kapso-platform' ? '66%' : '100%' 
              }}
            />
            </div>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}
          
          {/* Step Content */}
          <div className="mb-6">
            {renderStepContent()}
          </div>
          
          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 'select'}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Atrás
            </button>
            
            <button
              onClick={handleNextClick}
              disabled={!canProceed() || loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Procesando...
                </>
              ) : (
                <>
                  {getNextButtonText()}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}