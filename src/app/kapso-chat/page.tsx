'use client';

import { useState } from 'react';
import IntegratedChatPanel from '../../components/IntegratedChatPanel';

export default function KapsoChatPage() {
  const [isChatOpen, setIsChatOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-2xl font-bold text-gray-900">Kapso Realtime Chat</h1>
        <p className="text-sm text-gray-600">Conversaciones en tiempo real con proveedores</p>
      </header>
      
      <div className="flex-1">
        <IntegratedChatPanel 
          isOpen={isChatOpen} 
          onClose={() => setIsChatOpen(false)} 
        />
      </div>
    </div>
  );
}