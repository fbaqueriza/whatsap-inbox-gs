'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ConversationList, type ConversationListRef } from '@/components/conversation-list';
import { MessageView } from '@/components/message-view';
import {
  InboxConfigContext,
  type InboxConfig,
  type ProviderInfo,
} from '@/contexts/inbox-config-context';
import { normalizePhoneNumber } from '@/lib/utils';

type Conversation = {
  id: string;
  phoneNumber: string;
  contactName?: string;
};

type ParamsConfig = Omit<InboxConfig, 'providerMap' | 'setProviderMap'>;

export default function Home() {
  const [paramsConfig, setParamsConfig] = useState<ParamsConfig | null>(null);
  const [providerMap, setProviderMap] = useState<Record<string, ProviderInfo>>({});
  const [configError, setConfigError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation>();
  const conversationListRef = useRef<ConversationListRef>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const authToken = params.get('authToken');
    const kapsoConfigId = params.get('kapsoConfigId');
    const phoneNumberId = params.get('phoneNumberId');
    const wabaId = params.get('wabaId');
    const userId = params.get('userId');
    const appUrl = params.get('appUrl');

    setParamsConfig({
      authToken,
      kapsoConfigId,
      phoneNumberId,
      wabaId,
      userId,
      appUrl,
    });
  }, []);

  useEffect(() => {
    if (!paramsConfig) {
      return;
    }

    if (!paramsConfig.userId || !paramsConfig.appUrl) {
      return;
    }

    const controller = new AbortController();

    const loadProviders = async () => {
      try {
        const query = new URLSearchParams({
          userId: paramsConfig.userId ?? '',
          appUrl: paramsConfig.appUrl ?? '',
        });

        const response = await fetch(`/api/providers?${query.toString()}`, {
          method: 'GET',
          headers: paramsConfig.authToken
            ? { Authorization: `Bearer ${paramsConfig.authToken}` }
            : undefined,
          signal: controller.signal,
        });

        if (!response.ok) {
          console.warn(
            '⚠️ [Inbox] No se pudo obtener la lista de proveedores:',
            response.status,
            response.statusText
          );
          return;
        }

        const data = await response.json();
        const providers: any[] =
          data?.providers ??
          data?.data ??
          [];

        const nextMap: Record<string, ProviderInfo> = {};

        providers.forEach((provider) => {
          const possiblePhones: string[] = [
            provider.phone,
            provider.whatsapp_phone,
            provider.secondary_phone,
            provider.contact_phone,
            ...(Array.isArray(provider.phones) ? provider.phones : []),
          ].filter(Boolean);

          const digitValues = new Set<string>();
          possiblePhones.forEach((value: string) => {
            if (!value) return;
            const digits = value.replace(/\D+/g, '');
            if (digits) {
              digitValues.add(digits);
            }
          });

          const keySet = new Set<string>();
          digitValues.forEach((digits) => {
            if (!digits) return;
            const normalized = normalizePhoneNumber(digits);
            if (normalized) {
              keySet.add(normalized);
            }
            keySet.add(digits);

            if (digits.startsWith('549') && digits.length >= 12) {
              keySet.add('54' + digits.slice(3));
              keySet.add(digits.slice(2));
            }

            if (digits.startsWith('54') && digits.length === 12 && digits[2] === '0') {
              keySet.add('54' + digits.slice(3));
            }
          });

          const canonicalPhone = Array.from(keySet).find((candidate) => candidate.length >= 10);
          if (!canonicalPhone) {
            return;
          }

          const razonSocial =
            typeof provider.razon_social === 'string' && provider.razon_social.trim().length > 0
              ? provider.razon_social.trim()
              : undefined;
          const contactName =
            typeof provider.contact_name === 'string' && provider.contact_name.trim().length > 0
              ? provider.contact_name.trim()
              : undefined;
          const providerName =
            typeof provider.name === 'string' && provider.name.trim().length > 0
              ? provider.name.trim()
              : undefined;

          const displayParts: string[] = [];

          if (razonSocial) {
            displayParts.push(razonSocial);
          }

          const secondaryName =
            razonSocial && providerName && providerName.toLowerCase() === razonSocial.toLowerCase()
              ? contactName
              : providerName || contactName;

          if (secondaryName && secondaryName.trim().length > 0) {
            displayParts.push(secondaryName.trim());
          }

          if (displayParts.length === 0) {
            displayParts.push(canonicalPhone);
          }

          const info: ProviderInfo = {
            id: provider.id,
            phone: provider.phone,
            name: providerName ?? contactName,
            razonSocial,
            displayName: displayParts.join(' · '),
          };

          keySet.forEach((key) => {
            if (!key) return;
            nextMap[key] = info;
          });
        });

        setProviderMap(nextMap);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('❌ [Inbox] Error obteniendo proveedores:', error);
      }
    };

    loadProviders();

    return () => {
      controller.abort();
    };
  }, [paramsConfig]);

  const config = useMemo<InboxConfig | null>(() => {
    if (!paramsConfig) {
      return null;
    }

    return {
      ...paramsConfig,
      providerMap,
      setProviderMap,
    };
  }, [paramsConfig, providerMap]);

  const handleTemplateSent = async (phoneNumber: string) => {
    // Refresh the conversation list and get the updated conversations
    const conversations = await conversationListRef.current?.refresh();

    // Find and select the conversation for the phone number
    if (conversations) {
      const normalizedTarget = normalizePhoneNumber(phoneNumber);
      const conversation = conversations.find(
        conv => normalizePhoneNumber(conv.phoneNumber) === normalizedTarget
      );
      if (conversation) {
        setSelectedConversation(conversation);
      }
    }
  };

  const handleBackToList = () => {
    setSelectedConversation(undefined);
  };

  if (configError) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="max-w-md text-center bg-white shadow rounded-lg p-6 border border-[#d1d7db]">
          <h1 className="text-lg font-semibold text-[#111b21] mb-2">Configuración incompleta</h1>
          <p className="text-sm text-[#667781]">
            {configError} Asegúrate de que la plataforma envíe los parámetros necesarios.
          </p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center text-[#667781]">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <InboxConfigContext.Provider value={config}>
      <div className="h-screen flex">
        <ConversationList
          ref={conversationListRef}
          onSelectConversation={setSelectedConversation}
          selectedConversationId={selectedConversation?.id}
          isHidden={!!selectedConversation}
        />
        <MessageView
          conversationId={selectedConversation?.id}
          phoneNumber={selectedConversation?.phoneNumber}
          contactName={selectedConversation?.contactName}
          onTemplateSent={handleTemplateSent}
          onBack={handleBackToList}
          isVisible={!!selectedConversation}
        />
      </div>
    </InboxConfigContext.Provider>
  );
}
