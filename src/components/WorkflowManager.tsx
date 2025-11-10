'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'draft';
  triggers: string[];
  actions: string[];
  created_at: string;
  updated_at: string;
}

interface WorkflowManagerProps {
  onWorkflowCreated?: (workflow: Workflow) => void;
  onWorkflowUpdated?: (workflow: Workflow) => void;
  className?: string;
}

export default function WorkflowManager({ 
  onWorkflowCreated, 
  onWorkflowUpdated,
  className = '' 
}: WorkflowManagerProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    triggers: [] as string[],
    actions: [] as string[]
  });

  const availableTriggers = [
    { id: 'order_created', name: 'Orden creada', description: 'Se activa cuando se crea una nueva orden' },
    { id: 'order_updated', name: 'Orden actualizada', description: 'Se activa cuando se actualiza una orden' },
    { id: 'payment_received', name: 'Pago recibido', description: 'Se activa cuando se recibe un pago' },
    { id: 'stock_low', name: 'Stock bajo', description: 'Se activa cuando el stock está bajo' },
    { id: 'message_received', name: 'Mensaje recibido', description: 'Se activa cuando se recibe un mensaje de WhatsApp' }
  ];

  const availableActions = [
    { id: 'send_whatsapp_message', name: 'Enviar mensaje WhatsApp', description: 'Envía un mensaje por WhatsApp' },
    { id: 'send_whatsapp_template', name: 'Enviar plantilla WhatsApp', description: 'Envía una plantilla predefinida' },
    { id: 'update_order_status', name: 'Actualizar estado de orden', description: 'Cambia el estado de una orden' },
    { id: 'create_notification', name: 'Crear notificación', description: 'Crea una notificación en el sistema' },
    { id: 'send_email', name: 'Enviar email', description: 'Envía un correo electrónico' }
  ];

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('Usuario no autenticado');
      }

      // Por ahora, cargar workflows desde Supabase
      // En el futuro, esto se integrará con la API de Kapso Workflows
      const { data: workflowsData, error: workflowsError } = await supabase
        .from('workflows')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (workflowsError) {
        throw new Error('Error cargando workflows');
      }

      setWorkflows(workflowsData || []);

    } catch (err) {
      console.error('❌ [WorkflowManager] Error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newWorkflow.name.trim()) {
      setError('El nombre del workflow es requerido');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('Usuario no autenticado');
      }

      // Crear workflow en Supabase
      const { data: workflowData, error: workflowError } = await supabase
        .from('workflows')
        .insert({
          user_id: user.id,
          name: newWorkflow.name,
          description: newWorkflow.description,
          triggers: newWorkflow.triggers,
          actions: newWorkflow.actions,
          status: 'draft'
        })
        .select()
        .single();

      if (workflowError) {
        throw new Error('Error creando workflow');
      }

      setWorkflows(prev => [workflowData, ...prev]);
      onWorkflowCreated?.(workflowData);
      
      // Reset form
      setNewWorkflow({
        name: '',
        description: '',
        triggers: [],
        actions: []
      });
      setShowCreateForm(false);

    } catch (err) {
      console.error('❌ [WorkflowManager] Error creando workflow:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTrigger = (triggerId: string) => {
    setNewWorkflow(prev => ({
      ...prev,
      triggers: prev.triggers.includes(triggerId)
        ? prev.triggers.filter(id => id !== triggerId)
        : [...prev.triggers, triggerId]
    }));
  };

  const handleToggleAction = (actionId: string) => {
    setNewWorkflow(prev => ({
      ...prev,
      actions: prev.actions.includes(actionId)
        ? prev.actions.filter(id => id !== actionId)
        : [...prev.actions, actionId]
    }));
  };

  const toggleWorkflowStatus = async (workflowId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

      const { data, error } = await supabase
        .from('workflows')
        .update({ status: newStatus })
        .eq('id', workflowId)
        .select()
        .single();

      if (error) {
        throw new Error('Error actualizando workflow');
      }

      setWorkflows(prev => 
        prev.map(w => w.id === workflowId ? { ...w, status: newStatus } : w)
      );
      onWorkflowUpdated?.(data);

    } catch (err) {
      console.error('❌ [WorkflowManager] Error actualizando workflow:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  if (loading && workflows.length === 0) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando workflows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workflows</h2>
          <p className="text-gray-600">Automatiza procesos con workflows inteligentes</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Crear Workflow
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Create Workflow Form */}
      {showCreateForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Crear nuevo workflow</h3>
          
          <form onSubmit={handleCreateWorkflow} className="space-y-4">
            <div>
              <label htmlFor="workflow_name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del workflow *
              </label>
              <input
                type="text"
                id="workflow_name"
                value={newWorkflow.name}
                onChange={(e) => setNewWorkflow(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Notificación de orden creada"
                required
              />
            </div>

            <div>
              <label htmlFor="workflow_description" className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                id="workflow_description"
                value={newWorkflow.description}
                onChange={(e) => setNewWorkflow(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Describe qué hace este workflow..."
              />
            </div>

            {/* Triggers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Triggers (¿Cuándo se activa?)
              </label>
              <div className="space-y-2">
                {availableTriggers.map(trigger => (
                  <label key={trigger.id} className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={newWorkflow.triggers.includes(trigger.id)}
                      onChange={() => handleToggleTrigger(trigger.id)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{trigger.name}</div>
                      <div className="text-xs text-gray-500">{trigger.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Acciones (¿Qué hace?)
              </label>
              <div className="space-y-2">
                {availableActions.map(action => (
                  <label key={action.id} className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={newWorkflow.actions.includes(action.id)}
                      onChange={() => handleToggleAction(action.id)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{action.name}</div>
                      <div className="text-xs text-gray-500">{action.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading || !newWorkflow.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creando...' : 'Crear Workflow'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Workflows List */}
      <div className="space-y-4">
        {workflows.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">⚙️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay workflows creados
            </h3>
            <p className="text-gray-600 mb-4">
              Crea tu primer workflow para automatizar procesos.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Crear primer workflow
            </button>
          </div>
        ) : (
          workflows.map(workflow => (
            <div key={workflow.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      workflow.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : workflow.status === 'inactive'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {workflow.status === 'active' ? 'Activo' : 
                       workflow.status === 'inactive' ? 'Inactivo' : 'Borrador'}
                    </span>
                  </div>
                  
                  {workflow.description && (
                    <p className="text-gray-600 mb-3">{workflow.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-3">
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Triggers:</span>
                      <span className="ml-1 text-gray-600">
                        {workflow.triggers.length > 0 
                          ? workflow.triggers.map(t => 
                              availableTriggers.find(at => at.id === t)?.name || t
                            ).join(', ')
                          : 'Ninguno'
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Acciones:</span>
                      <span className="ml-1 text-gray-600">
                        {workflow.actions.length > 0 
                          ? workflow.actions.map(a => 
                              availableActions.find(aa => aa.id === a)?.name || a
                            ).join(', ')
                          : 'Ninguna'
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => toggleWorkflowStatus(workflow.id, workflow.status)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      workflow.status === 'active'
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {workflow.status === 'active' ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
