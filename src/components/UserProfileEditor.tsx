'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  profilePictureUrl?: string;
  statusMessage?: string;
  statusEmoji?: string;
  createdAt: string;
  updatedAt?: string;
}

interface UserProfileEditorProps {
  onClose: () => void;
  onProfileUpdated?: (profile: UserProfile) => void;
}

export default function UserProfileEditor({ onClose, onProfileUpdated }: UserProfileEditorProps) {
  const { user, getSession } = useSupabaseAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form states
  const [displayName, setDisplayName] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [cuit, setCuit] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const session = await getSession();
      if (!session) {
        setError('No hay sesión activa');
        return;
      }

      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Error cargando perfil');
      }

      const data = await response.json();
      if (data.success) {
        setProfile(data.profile);
        setDisplayName(data.profile.displayName || '');
        setRazonSocial(data.profile.razon_social || '');
        setCuit(data.profile.cuit || '');
      } else {
        setError(data.error || 'Error cargando perfil');
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
      setError('Error cargando perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const session = await getSession();
      if (!session) {
        setError('No hay sesión activa');
        return;
      }

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: displayName.trim() || null
        })
      });
      // Guardar CUIT y Razón Social obligatorios
      if (!razonSocial.trim() || !cuit.trim()) {
        setError('Razón Social y CUIT son obligatorios');
        setSaving(false);
        return;
      }
      const upd = await fetch('/api/user/update-business-profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ razon_social: razonSocial.trim(), cuit: cuit.trim() })
      });
      const updData = await upd.json();
      if (!updData.success) {
        throw new Error(updData.error || 'Error actualizando CUIT/Razón Social');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error actualizando perfil');
      }

      const data = await response.json();
      if (data.success) {
        setProfile(data.profile);
        setSuccess('Perfil actualizado exitosamente');
        onProfileUpdated?.(data.profile);
        
        // Auto-cerrar después de 2 segundos
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(data.error || 'Error actualizando perfil');
      }
    } catch (error) {
      console.error('Error guardando perfil:', error);
      setError(error instanceof Error ? error.message : 'Error guardando perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      const session = await getSession();
      if (!session) {
        setError('No hay sesión activa');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/user/profile-picture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error subiendo foto');
      }

      const data = await response.json();
      if (data.success) {
        setSuccess('Foto de perfil actualizada exitosamente');
        // Recargar perfil para obtener la nueva URL
        await loadProfile();
      } else {
        setError(data.error || 'Error subiendo foto');
      }
    } catch (error) {
      console.error('Error subiendo foto:', error);
      setError(error instanceof Error ? error.message : 'Error subiendo foto');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setUploading(true);
      setError(null);

      const session = await getSession();
      if (!session) {
        setError('No hay sesión activa');
        return;
      }

      const response = await fetch('/api/user/profile-picture', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error eliminando foto');
      }

      const data = await response.json();
      if (data.success) {
        setSuccess('Foto de perfil eliminada exitosamente');
        // Recargar perfil para actualizar la URL
        await loadProfile();
      } else {
        setError(data.error || 'Error eliminando foto');
      }
    } catch (error) {
      console.error('Error eliminando foto:', error);
      setError(error instanceof Error ? error.message : 'Error eliminando foto');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Cargando perfil...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Editar Perfil</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        {/* Foto de perfil */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Foto de Perfil
          </label>
          <div className="flex items-center space-x-4">
            <div className="relative">
              {profile?.profilePictureUrl ? (
                <img
                  src={profile.profilePictureUrl}
                  alt="Foto de perfil"
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Subiendo...' : 'Cambiar'}
              </button>
              {profile?.profilePictureUrl && (
                <button
                  onClick={handleRemovePhoto}
                  disabled={uploading}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Nombre de visualización */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre de Visualización
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Tu nombre como aparece en la plataforma"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={100}
          />
        </div>

        {/* Razón Social */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Razón Social (obligatorio)
          </label>
          <input
            type="text"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            placeholder="Razón Social de tu negocio"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* CUIT */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CUIT (obligatorio)
          </label>
          <input
            type="text"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="XX-XXXXXXXX-X"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>



        {/* Botones */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
