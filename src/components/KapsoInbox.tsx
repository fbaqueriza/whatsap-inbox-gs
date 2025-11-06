'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface KapsoInboxProps {
  className?: string;
}

export default function KapsoInbox({ className = '' }: KapsoInboxProps) {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasWhatsAppConfig, setHasWhatsAppConfig] = useState<boolean | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadInbox = async () => {
      try {
        // Obtener el token del usuario
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          throw new Error('No se pudo obtener el token de autenticación');
        }

        // Verificar si el usuario tiene configuración de WhatsApp
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Usuario no autenticado');
        }

        const { data: userConfig, error: configError } = await supabase
          .from('user_whatsapp_config')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (configError || !userConfig) {
          console.log('⚠️ [KapsoInbox] Usuario no tiene configuración de WhatsApp:', configError);
          setHasWhatsAppConfig(false);
          setLoading(false);
          return;
        }

        if (!userConfig.kapso_config_id) {
          console.log('⚠️ [KapsoInbox] Usuario no tiene kapso_config_id configurado');
          setHasWhatsAppConfig(false);
          setLoading(false);
          return;
        }

        setHasWhatsAppConfig(true);

        // Usar el inbox local en desarrollo o el de producción en staging
        const baseUrl = process.env.NEXT_PUBLIC_KAPSO_INBOX_URL || 
          (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
            ? 'http://localhost:4000' 
            : 'https://whatsapp-inbox.vercel.app');
        
        // Pasar el token vía URL para que el inbox lo use en sus requests
        const params = new URLSearchParams({
          authToken: token,
          kapsoConfigId: userConfig.kapso_config_id
        });
        
        setIframeUrl(`${baseUrl}?${params.toString()}`);
        setLoading(false);
      } catch (err) {
        console.error('❌ [KapsoInbox] Error cargando inbox:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setLoading(false);
      }
    };

    loadInbox();
  }, []);

  // Verificar si el servidor está disponible antes de mostrar error
  useEffect(() => {
    if (iframeUrl && iframeUrl.includes('localhost:4000') && !iframeLoaded) {
      // Primero verificar que el servidor esté respondiendo
      const checkServer = async () => {
        try {
          const response = await fetch('http://localhost:4000', { 
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache'
          });
          // Si llegamos aquí, el servidor está respondiendo
          console.log('✅ [KapsoInbox] Servidor localhost:4000 está respondiendo');
        } catch (error) {
          console.warn('⚠️ [KapsoInbox] Servidor localhost:4000 no responde:', error);
          // Esperar un poco más antes de marcar error
          setTimeout(() => {
            if (!iframeLoaded) {
              setIframeError(true);
            }
          }, 3000);
        }
      };

      // Timeout más largo para dar tiempo al iframe de cargar (10 segundos)
      const timeout = setTimeout(() => {
        if (!iframeLoaded) {
          console.warn('⚠️ [KapsoInbox] Iframe no mostró contenido después de 10 segundos');
          checkServer();
        }
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [iframeUrl, iframeLoaded]);

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
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (hasWhatsAppConfig === false) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center max-w-md">
          <div className="text-gray-400 text-6xl mb-4">📱</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            WhatsApp no configurado
          </h3>
          <p className="text-gray-600 mb-4">
            Necesitas configurar WhatsApp para poder usar el chat. Ve a la configuración para conectar tu número.
          </p>
          <Link
            href="/dashboard/whatsapp-config"
            className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Configurar WhatsApp
          </Link>
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

  if (iframeError && iframeUrl?.includes('localhost:4000')) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center max-w-md">
          <div className="text-yellow-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Servidor de Inbox no disponible
          </h3>
          <p className="text-gray-600 mb-4">
            El servidor del WhatsApp Inbox no está corriendo en el puerto 4000 o no está respondiendo correctamente. 
            Necesitas iniciarlo para poder usar el chat.
          </p>
          <div className="mt-4 p-4 bg-gray-100 rounded-md text-left text-sm">
            <p className="font-semibold mb-2">Para iniciar el servidor:</p>
            <code className="block bg-white p-2 rounded border">
              cd temp/whatsapp-cloud-inbox<br />
              npm run dev
            </code>
          </div>
          <div className="mt-4 flex gap-2 justify-center">
            <button
              onClick={() => {
                setIframeError(false);
                setIframeLoaded(false);
                window.location.reload();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            O usa la versión en producción configurando NEXT_PUBLIC_KAPSO_INBOX_URL
          </p>
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
        onError={(e) => {
          console.error('❌ [KapsoInbox] Error cargando iframe:', e);
          setIframeError(true);
          setError('Error al cargar el iframe del chat');
        }}
        onLoad={() => {
          console.log('✅ [KapsoInbox] Iframe cargado correctamente');
          setIframeLoaded(true);
          
          // Verificar si el iframe tiene contenido después de un momento
          setTimeout(() => {
            // Intentar acceder al contenido del iframe (puede fallar por CORS)
            try {
              const iframe = document.querySelector('iframe[title="Kapso WhatsApp Inbox"]') as HTMLIFrameElement;
              if (iframe && iframe.contentDocument) {
                const hasContent = iframe.contentDocument.body && iframe.contentDocument.body.innerHTML.trim().length > 0;
                if (!hasContent) {
                  console.warn('⚠️ [KapsoInbox] Iframe cargado pero sin contenido visible');
                  // No establecer error aquí porque puede ser CORS, solo loguear
                }
              }
            } catch (err) {
              // CORS - no podemos acceder al contenido del iframe desde otro origen
              // Esto es normal, solo logueamos
              console.log('ℹ️ [KapsoInbox] No se puede verificar contenido del iframe (CORS)');
            }
          }, 1000);
        }}
      />
    </div>
  );
}

