import React, { useCallback, useEffect, useState } from 'react';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Verificar si las notificaciones están soportadas
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Solicitar permisos automáticamente si no están concedidos
      if (Notification.permission === 'default') {
        console.log('Solicitando permisos de notificación automáticamente...');
        Notification.requestPermission().then((permission) => {
          setPermission(permission);
          console.log('Permisos de notificación:', permission);
        });
      }
    } else {
      console.log('Notificaciones no soportadas en este navegador');
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Las notificaciones no están soportadas en este navegador');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error solicitando permiso de notificaciones:', error);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback((options: NotificationOptions) => {
    if (!isSupported) {
      console.log('No se pueden enviar notificaciones: no soportadas');
      return null;
    }
    
    if (permission !== 'granted') {
      console.log('Solicitando permiso para notificaciones...');
      requestPermission().then(() => {
        // Reintentar después de obtener permiso
        if (Notification.permission === 'granted') {
          sendNotification(options);
        }
      });
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: options.tag || 'whatsapp-message',
        requireInteraction: options.requireInteraction || true,
        silent: false
      });

      notification.onclick = (event) => {
        event.preventDefault();
        notification.close();
        if (window.focus) { window.focus(); }
        window.dispatchEvent(new CustomEvent('openChat'));
      };

      // Cerrar automáticamente después de 10 segundos si no es interactiva
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 10000);
      }

      return notification;
    } catch (error) {
      console.error('Error enviando notificación:', error);
      return null;
    }
  }, [isSupported, permission, requestPermission]);

  const sendWhatsAppNotification = useCallback((contactName: string, message: string) => {
    return sendNotification({
      title: `Mensaje de ${contactName}`,
      body: message,
      tag: 'whatsapp-message',
      requireInteraction: true,
      actions: [
        {
          action: 'close',
          title: '✕ Cerrar'
        },
        {
          action: 'open',
          title: '💬 Abrir chat'
        }
      ]
    });
  }, [sendNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    sendWhatsAppNotification
  };
}
