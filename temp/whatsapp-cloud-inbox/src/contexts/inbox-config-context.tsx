import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';

export type ProviderInfo = {
  id?: string;
  phone?: string | null;
  name?: string | null;
  razonSocial?: string | null;
  displayName: string;
};

export type InboxConfig = {
  authToken: string | null;
  kapsoConfigId: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  userId: string | null;
  appUrl: string | null;
  providerMap: Record<string, ProviderInfo>;
  setProviderMap: Dispatch<SetStateAction<Record<string, ProviderInfo>>>;
};

export const InboxConfigContext = createContext<InboxConfig | null>(null);

export function useInboxConfig(): InboxConfig {
  const context = useContext(InboxConfigContext);

  if (!context) {
    throw new Error('useInboxConfig debe usarse dentro de un InboxConfigContext.Provider');
  }

  return context;
}

