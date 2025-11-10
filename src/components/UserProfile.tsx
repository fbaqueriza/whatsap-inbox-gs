'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import UserProfileEditor from './UserProfileEditor';

interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  profilePictureUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

interface UserProfileProps {
  className?: string;
  showEmail?: boolean;
}

export default function UserProfile({ className = '', showEmail = false }: UserProfileProps) {
  const { user, getSession } = useSupabaseAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const session = await getSession();
      if (!session) {
        return;
      }

      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProfile(data.profile);
        }
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdated = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
  };

  if (loading) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
        <div className="space-y-1">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700">Usuario</div>
        </div>
      </div>
    );
  }

  const displayName = profile.displayName || profile.email.split('@')[0];

  return (
    <>
      <button
        onClick={() => setShowEditor(true)}
        className={`flex items-center space-x-3 hover:bg-gray-50 rounded-lg p-2 transition-colors ${className}`}
      >
        {/* Foto de perfil */}
        <div className="relative">
          {profile.profilePictureUrl ? (
            <img
              src={profile.profilePictureUrl}
              alt="Foto de perfil"
              className="w-8 h-8 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        {/* Información del usuario */}
        <div className="text-left">
          <div className="text-sm font-medium text-gray-900 truncate max-w-32">
            {displayName}
          </div>
          {showEmail && (
            <div className="text-xs text-gray-400 truncate max-w-32">
              {profile.email}
            </div>
          )}
        </div>

        {/* Icono de editar */}
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      {/* Editor de perfil */}
      {showEditor && (
        <UserProfileEditor
          onClose={() => setShowEditor(false)}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </>
  );
}
