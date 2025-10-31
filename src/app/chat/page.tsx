'use client';

import KapsoInbox from '@/components/KapsoInbox';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-2 sm:px-4 lg:px-6 py-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[calc(100vh-100px)]">
          <div className="px-3 sm:px-6 py-3 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              WhatsApp Chat
            </h2>
            <p className="text-xs sm:text-sm text-gray-600">
              Interfaz completa de WhatsApp con soporte para mensajes, plantillas y documentos
            </p>
          </div>
          <div className="p-2 sm:p-4 lg:p-6 h-[calc(100vh-180px)]">
            <KapsoInbox className="h-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

