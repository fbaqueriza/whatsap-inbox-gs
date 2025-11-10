'use client';

import { useState, useEffect } from 'react';
import { useSupabaseAuth } from './useSupabaseAuth';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  profilePictureUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export function useUserProfile() {
  const { user, getSession } = useSupabaseAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
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
      } else {
        setError(data.error || 'Error cargando perfil');
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
      setError(error instanceof Error ? error.message : 'Error cargando perfil');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: {
    displayName?: string;
  }) => {
    try {
      setError(null);
      
      const session = await getSession();
      if (!session) {
        setError('No hay sesión activa');
        return { success: false, error: 'No hay sesión activa' };
      }

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error actualizando perfil');
      }

      const data = await response.json();
      if (data.success) {
        setProfile(data.profile);
        return { success: true, profile: data.profile };
      } else {
        setError(data.error || 'Error actualizando perfil');
        return { success: false, error: data.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error actualizando perfil';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const uploadProfilePicture = async (file: File) => {
    try {
      setError(null);
      
      const session = await getSession();
      if (!session) {
        setError('No hay sesión activa');
        return { success: false, error: 'No hay sesión activa' };
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
        // Recargar perfil para obtener la nueva URL
        await loadProfile();
        return { success: true, profilePictureUrl: data.profilePictureUrl };
      } else {
        setError(data.error || 'Error subiendo foto');
        return { success: false, error: data.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error subiendo foto';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const removeProfilePicture = async () => {
    try {
      setError(null);
      
      const session = await getSession();
      if (!session) {
        setError('No hay sesión activa');
        return { success: false, error: 'No hay sesión activa' };
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
        // Recargar perfil para actualizar la URL
        await loadProfile();
        return { success: true };
      } else {
        setError(data.error || 'Error eliminando foto');
        return { success: false, error: data.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error eliminando foto';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  useEffect(() => {
    if (user) {
      loadProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user]);

  return {
    profile,
    loading,
    error,
    loadProfile,
    updateProfile,
    uploadProfilePicture,
    removeProfilePicture
  };
}
