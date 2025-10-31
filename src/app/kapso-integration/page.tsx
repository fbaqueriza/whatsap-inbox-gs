'use client';

import { useState } from 'react';
import CustomerOnboarding from '@/components/CustomerOnboarding';
import KapsoInbox from '@/components/KapsoInbox';
import WorkflowManager from '@/components/WorkflowManager';

type TabType = 'inbox' | 'onboarding' | 'workflows' | 'analytics';

export default function KapsoIntegrationPage() {
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
  const [customers, setCustomers] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);

  const tabs = [
    { id: 'inbox', name: 'WhatsApp Inbox', icon: '💬' },
    { id: 'onboarding', name: 'Onboarding', icon: '👥' },
    { id: 'workflows', name: 'Workflows', icon: '⚙️' },
    { id: 'analytics', name: 'Analytics', icon: '📊' }
  ];

  const handleCustomerCreated = (customer: any) => {
    setCustomers(prev => [customer, ...prev]);
  };

  const handleSetupLinkGenerated = (link: string) => {
    console.log('🔗 Link de configuración generado:', link);
  };

  const handleWorkflowCreated = (workflow: any) => {
    setWorkflows(prev => [workflow, ...prev]);
  };

  const handleWorkflowUpdated = (workflow: any) => {
    setWorkflows(prev => 
      prev.map(w => w.id === workflow.id ? workflow : w)
    );
  };

  const handleMessageSent = (message: any) => {
    console.log('📤 Mensaje enviado:', message);
  };

  const handleMessageReceived = (message: any) => {
    console.log('📥 Mensaje recibido:', message);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Integración Kapso
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Gestiona WhatsApp Business con las nuevas capacidades de Kapso
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                <span className="font-medium">{customers.length}</span> clientes
              </div>
              <div className="text-sm text-gray-500">
                <span className="font-medium">{workflows.length}</span> workflows
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'inbox' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  WhatsApp Inbox
                </h2>
                <p className="text-sm text-gray-600">
                  Interfaz completa de WhatsApp con soporte para mensajes, plantillas y documentos
                </p>
              </div>
              <div className="p-6 h-[calc(100vh-280px)]">
                <KapsoInbox className="h-full" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'onboarding' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Onboarding de Clientes
                </h2>
                <p className="text-sm text-gray-600">
                  Crea clientes en Kapso Platform y genera links de configuración para WhatsApp
                </p>
              </div>
              <div className="p-6">
                <CustomerOnboarding
                  onCustomerCreated={handleCustomerCreated}
                  onSetupLinkGenerated={handleSetupLinkGenerated}
                />
              </div>
            </div>

            {/* Lista de clientes existentes */}
            {customers.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Clientes Creados
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {customers.map((customer, index) => (
                      <div key={customer.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{customer.name}</div>
                          <div className="text-sm text-gray-500">
                            ID: {customer.id}
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(customer.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'workflows' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Gestión de Workflows
                </h2>
                <p className="text-sm text-gray-600">
                  Crea y gestiona workflows automatizados con triggers y acciones
                </p>
              </div>
              <div className="p-6">
                <WorkflowManager
                  onWorkflowCreated={handleWorkflowCreated}
                  onWorkflowUpdated={handleWorkflowUpdated}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Analytics y Métricas
                </h2>
                <p className="text-sm text-gray-600">
                  Monitorea el rendimiento de tus integraciones de WhatsApp
                </p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="text-blue-600 text-2xl mr-3">💬</div>
                      <div>
                        <div className="text-2xl font-bold text-blue-900">0</div>
                        <div className="text-blue-700 text-sm">Mensajes enviados</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="text-green-600 text-2xl mr-3">👥</div>
                      <div>
                        <div className="text-2xl font-bold text-green-900">{customers.length}</div>
                        <div className="text-green-700 text-sm">Clientes activos</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="text-purple-600 text-2xl mr-3">⚙️</div>
                      <div>
                        <div className="text-2xl font-bold text-purple-900">{workflows.length}</div>
                        <div className="text-purple-700 text-sm">Workflows activos</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Próximas funcionalidades
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900">Métricas de mensajes</h4>
                      <p className="text-sm text-gray-600">Tasa de entrega, lectura y respuesta</p>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900">Análisis de conversaciones</h4>
                      <p className="text-sm text-gray-600">Tiempo de respuesta y satisfacción</p>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900">Rendimiento de workflows</h4>
                      <p className="text-sm text-gray-600">Efectividad de automatizaciones</p>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900">Reportes personalizados</h4>
                      <p className="text-sm text-gray-600">Dashboards y exportación de datos</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
