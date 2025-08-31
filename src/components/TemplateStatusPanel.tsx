'use client';

import React, { useState, useEffect } from 'react';
import { useTemplatesRealtime } from '../hooks/useSupabaseRealtime';

interface Template {
  id: string;
  name: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'DISABLED';
  quality_rating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  components: any[];
  last_updated: string;
}

interface TemplateStats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  disabled: number;
  greenQuality: number;
  yellowQuality: number;
  redQuality: number;
}

export default function TemplateStatusPanel() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos iniciales
  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/whatsapp/template-status');
      const data = await response.json();

      if (response.ok) {
        setTemplates(data.templates || []);
        setStats(data.stats || null);
      } else {
        setError(data.error || 'Error cargando templates');
      }
    } catch (error) {
      setError('Error de conexión');
      console.error('Error cargando templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Suscripción Realtime para templates
  useTemplatesRealtime(
    // onInsert
    (payload) => {
      console.log('🆕 Nuevo template creado:', payload.new);
      loadTemplates();
    },
    // onUpdate
    (payload) => {
      console.log('🔄 Template actualizado:', payload.new);
      loadTemplates();
    },
    // onDelete
    (payload) => {
      console.log('🗑️ Template eliminado:', payload.old);
      loadTemplates();
    }
  );

  useEffect(() => {
    loadTemplates();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'text-green-600 bg-green-100';
      case 'REJECTED': return 'text-red-600 bg-red-100';
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      case 'DISABLED': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getQualityColor = (quality?: string) => {
    switch (quality) {
      case 'GREEN': return 'text-green-600';
      case 'YELLOW': return 'text-yellow-600';
      case 'RED': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600 text-center">
          <p>❌ {error}</p>
          <button 
            onClick={loadTemplates}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Estado de Templates</h2>
      
      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-sm text-gray-600">Aprobados</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pendientes</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-sm text-gray-600">Rechazados</div>
          </div>
        </div>
      )}

      {/* Lista de templates */}
      <div className="space-y-3">
        {templates.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No hay templates registrados</p>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-500">ID: {template.id}</p>
                </div>
                <div className="flex space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(template.status)}`}>
                    {template.status}
                  </span>
                  {template.quality_rating && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getQualityColor(template.quality_rating)}`}>
                      {template.quality_rating}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Componentes */}
              {template.components && template.components.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-600 mb-1">Componentes:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.components.map((component, index) => (
                      <span 
                        key={index}
                        className={`px-2 py-1 rounded text-xs ${getStatusColor(component.status)}`}
                      >
                        {component.type}: {component.status}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-400 mt-2">
                Última actualización: {new Date(template.last_updated).toLocaleString('es-AR', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false // Forzar formato 24 horas
                })}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Botón de actualización manual */}
      <div className="mt-4 text-center">
        <button 
          onClick={loadTemplates}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          🔄 Actualizar
        </button>
      </div>
    </div>
  );
}
