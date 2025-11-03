'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

interface KapsoInboxProps {
  className?: string;
}

export default function KapsoInbox({ className = '' }: KapsoInboxProps) {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInbox = async () => {
      try {
        // Obtener el token del usuario
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          throw new Error('No se pudo obtener el token de autenticación');
        }

        // Usar el inbox local en desarrollo o el de producción en staging
        const baseUrl = process.env.NEXT_PUBLIC_KAPSO_INBOX_URL || 'https://whatsapp-inbox.vercel.app';
        
        // Pasar el token vía URL para que el inbox lo use en sus requests
        const params = new URLSearchParams({
          authToken: token
        });
        
        setIframeUrl(`${baseUrl}?${params.toString()}`);
        setLoading(false);
      } catch (err) {
        console.error('Error cargando inbox:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setLoading(false);
      }
    };

    loadInbox();
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando WhatsApp Inbox...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Error cargando WhatsApp Inbox
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (!iframeUrl) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">📱</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Configuración no encontrada
          </h3>
          <p className="text-gray-600">No se encontró una configuración de WhatsApp válida.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-hidden ${className}`}>
      <iframe
        src={iframeUrl}
        className="w-full h-full border-0 rounded-lg"
        title="Kapso WhatsApp Inbox"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        style={{ 
          display: 'block',
          maxWidth: '100%',
          overflow: 'hidden'
        }}
      />
    </div>
  );
}

