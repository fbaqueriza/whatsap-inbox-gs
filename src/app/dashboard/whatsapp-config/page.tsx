"use client";

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSessionValidator } from '../../../hooks/useSessionValidator';
import { supabase } from '../../../lib/supabase/client';
import WhatsAppWizard from '../../../components/WhatsAppWizard';
import {
  Phone,
  Plus,
  Settings,
  CheckCircle,
  AlertCircle,
  Trash2,
  Edit,
  MessageSquare,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';

interface WhatsAppConfig {
  id: string;
  user_id: string;
  phone_number: string;
  kapso_config_id?: string;
  meta_phone_number_id?: string;
  meta_access_token?: string;
  is_sandbox: boolean;
  is_active: boolean;
  webhook_url?: string;
  created_at: string;
  updated_at: string;
}

interface KapsoSandboxInfo {
  id: string;
  name: string;
  phone_number?: string;
  is_sandbox: boolean;
  status: 'active' | 'inactive' | 'pending';
}

export default function WhatsAppConfigPage() {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [configs, setConfigs] = useState<WhatsAppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  
  // Validar sesión automáticamente
  useSessionValidator();
  
  // 🔧 DETECTAR STATUS DEL SETUP LINK Y COMPLETAR CONFIGURACIÓN
  useEffect(() => {
    const status = searchParams?.get('status');
    
    if (status === 'success' && user) {
      console.log('✅ [WhatsAppConfig] Setup completado exitosamente, completando configuración...');
      
      const completeSetup = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session?.access_token) {
            console.error('❌ [WhatsAppConfig] No hay sesión activa para completar setup');
            return;
          }
          
          const response = await fetch('/api/whatsapp/complete-setup', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok && data.success) {
            console.log('✅ [WhatsAppConfig] Configuración completada exitosamente');
            // Limpiar el parámetro de query para no volver a ejecutarlo
            router.replace('/dashboard/whatsapp-config');
            // Recargar configuraciones después de un pequeño delay para asegurar que la actualización se complete
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            console.error('❌ [WhatsAppConfig] Error completando configuración:', data.error);
            setError(data.error || 'Error completando la configuración. Por favor, intenta nuevamente.');
          }
        } catch (err) {
          console.error('❌ [WhatsAppConfig] Error al completar setup:', err);
          setError('Error al completar la configuración. Por favor, intenta nuevamente.');
        }
      };
      
      completeSetup();
    } else if (status === 'error') {
      console.error('❌ [WhatsAppConfig] El setup falló');
      setError('Error al conectar WhatsApp. Por favor, intenta nuevamente.');
      // Limpiar el parámetro de query
      router.replace('/dashboard/whatsapp-config');
    }
  }, [searchParams, user, router]);
  
  // Mostrar loading mientras se verifica la autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }
  
  // 🔧 CARGA OPTIMIZADA: Con rate limiting para evitar llamadas repetitivas
  const [hasLoaded, setHasLoaded] = useState(false);
  
  useEffect(() => {
    if (user && !hasLoaded) {
      console.log('📱 [WhatsAppConfig] Cargando configuraciones...');
      loadConfigurations();
      setHasLoaded(true); // Marcar como cargado
    }
  }, [user, hasLoaded]);

  // Redirigir a login si no hay usuario
  if (!user) {
    if (typeof window !== 'undefined') {
      router.push('/auth/login');
    }
    return null;
  }

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setError('No hay sesión activa');
        return;
      }

      const response = await fetch('/api/whatsapp/configs', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
        
        // Verificar si hay configuraciones sin kapso_config_id y actualizarlas
        const configsWithoutKapsoId = data.configs?.filter(config => !config.kapso_config_id);
        if (configsWithoutKapsoId && configsWithoutKapsoId.length > 0) {
          console.log('📱 [WhatsAppConfig] Actualizando configuraciones sin kapso_config_id...');
          await updateKapsoConfigIds();
        }
      } else {
        setError('Error al cargar configuraciones');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const updateKapsoConfigIds = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        return;
      }

      const response = await fetch('/api/whatsapp/update-kapso-config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        // Endpoint deshabilitado sin sandbox; ignorar silenciosamente
        return;
      } else {
        console.error('❌ [WhatsAppConfig] Error actualizando kapso_config_id');
      }
    } catch (error) {
      console.error('❌ [WhatsAppConfig] Error actualizando kapso_config_id:', error);
    }
  };

  const toggleConfigStatus = async (configId: string, isActive: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setError('No hay sesión activa');
        return;
      }

      const response = await fetch(`/api/whatsapp/configs/${configId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ is_active: !isActive })
      });
      
      if (response.ok) {
        await loadConfigurations();
      } else {
        setError('Error actualizando configuración');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const deleteConfig = async (configId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta configuración?')) {
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setError('No hay sesión activa');
        return;
      }

      const response = await fetch(`/api/whatsapp/configs/${configId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        await loadConfigurations();
      } else {
        setError('Error eliminando configuración');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  // Funciones para el wizard
  const handleWizardComplete = async (config: any) => {
    console.log('🎉 [WhatsAppConfig] Wizard completado:', config);
    setShowWizard(false); // Cerrar el wizard
    await loadConfigurations(); // Recargar configuraciones
    setError(null);
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setError(null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Configuración de WhatsApp</h1>
              <p className="mt-2 text-gray-600">
                Gestiona tus números de WhatsApp para el chat con proveedores
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Sandbox Section eliminado */}

        {/* Configurations List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                Mis Configuraciones de WhatsApp
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowWizard(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Configurar WhatsApp
                </button>
                {configs.length > 0 && (
                  <button
                    onClick={() => window.location.href = '/dashboard'}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Ir al Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {configs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No tienes configuraciones de WhatsApp
                </h3>
                <p className="text-gray-600 mb-4">
                  Configura un número de WhatsApp para empezar a chatear con tus proveedores
                </p>
              </div>
            ) : (
              configs.map((config) => (
                <div key={config.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {config.is_active ? (
                          <CheckCircle className="h-6 w-6 text-green-500" />
                        ) : (
                          <AlertCircle className="h-6 w-6 text-gray-400" />
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <Phone className="h-5 w-5 text-gray-400 mr-2" />
                          <p className="text-lg font-medium text-gray-900">
                            {config.phone_number}
                          </p>
                          {config.is_sandbox && (
                            <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              Sandbox
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <span>
                            {config.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                          <span className="mx-2">•</span>
                          <span>
                            Creado: {new Date(config.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleConfigStatus(config.id, config.is_active)}
                        className={`px-3 py-1 text-sm rounded-md ${
                          config.is_active
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {config.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => deleteConfig(config.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded-md hover:bg-red-200"
                        title="Desconectar este número"
                      >
                        Desconectar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add Configuration Form */}
        {showAddForm && (
          <div className="mt-8 bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Agregar Nueva Configuración
            </h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
                <div className="ml-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Nota:</strong> Para agregar números de WhatsApp personalizados, 
                    necesitarás configurar la integración con Meta Business API. 
                    Por ahora, puedes usar el número de sandbox de Kapso para pruebas.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            ¿Cómo funciona?
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                1
              </div>
              <div>
                <strong>Configuración de Sandbox:</strong> Usa el número de sandbox de Kapso para 
                probar la funcionalidad de chat sin configurar un número real.
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                2
              </div>
              <div>
                <strong>Números Reales:</strong> Para usar números de WhatsApp reales, necesitarás 
                configurar la integración con Meta Business API (próximamente).
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                3
              </div>
              <div>
                <strong>Chat con Proveedores:</strong> Una vez configurado, podrás chatear 
                directamente con tus proveedores desde el dashboard.
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* WhatsApp Wizard */}
      {showWizard && (
        <WhatsAppWizard
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      )}
    </div>
  );
}
