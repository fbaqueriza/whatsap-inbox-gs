'use client';

import React from 'react';
import { useChat } from '../contexts/ChatContext';
import WhatsAppInitialSetup from './WhatsAppInitialSetup';
import IntegratedChatPanel from './IntegratedChatPanel';

interface ChatWithSetupProps {
  providers: any[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatWithSetup({ providers, isOpen, onClose }: ChatWithSetupProps) {
  const { needsWhatsAppSetup, completeWhatsAppSetup } = useChat();

  // Si necesita configuración, mostrar pantalla de setup
  if (needsWhatsAppSetup) {
    return (
      <WhatsAppInitialSetup 
        onSetupComplete={(config) => {
          console.log('✅ [ChatWithSetup] Configuración completada:', config);
          completeWhatsAppSetup();
        }}
      />
    );
  }

  // Si ya tiene configuración, mostrar chat normal
  return (
    <IntegratedChatPanel 
      providers={providers}
      isOpen={isOpen}
      onClose={onClose}
    />
  );
}
