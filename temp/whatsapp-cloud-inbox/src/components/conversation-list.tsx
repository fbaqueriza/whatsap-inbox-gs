'use client';

import { useEffect, useState, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { format, isValid, isToday, isYesterday } from 'date-fns';
import { RefreshCw, Search } from 'lucide-react';
import { cn, normalizePhoneNumber } from '@/lib/utils';
import { useAutoPolling } from '@/hooks/use-auto-polling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useInboxConfig } from '@/contexts/inbox-config-context';

type Conversation = {
  id: string;
  phoneNumber: string;
  status: string;
  lastActiveAt: string;
  phoneNumberId: string;
  metadata?: Record<string, unknown>;
  contactName?: string;
  messagesCount?: number;
  lastMessage?: {
    content: string;
    direction: string;
    type?: string;
  };
};

function formatConversationDate(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (!isValid(date)) return '';

    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  } catch {
    return '';
  }
}

function getAvatarInitials(contactName?: string, phoneNumber?: string): string {
  if (contactName) {
    const words = contactName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return contactName.slice(0, 2).toUpperCase();
  }

  if (phoneNumber) {
    const digits = phoneNumber.replace(/\D/g, '');
    return digits.slice(-2);
  }

  return '??';
}

type Props = {
  onSelectConversation: (conversation: Conversation) => void;
  selectedConversationId?: string;
  isHidden?: boolean;
};

export type ConversationListRef = {
  refresh: () => Promise<Conversation[]>;
  selectByPhoneNumber: (phoneNumber: string) => void;
};

export const ConversationList = forwardRef<ConversationListRef, Props>(
  ({ onSelectConversation, selectedConversationId, isHidden = false }, ref) => {
  const { phoneNumberId, authToken, appUrl, userId, providerMap } = useInboxConfig();
  const [rawConversations, setRawConversations] = useState<Conversation[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const applyDecorators = useCallback(
    (items: Conversation[]): Conversation[] => {
      const conversationMap = new Map<string, Conversation>();

      const getStatusPriority = (status: string) => {
        switch (status) {
          case 'active':
            return 2;
          case 'pending':
          case 'open':
            return 1;
          default:
            return 0;
        }
      };

      for (const conversation of items) {
        const normalizedPhone =
          normalizePhoneNumber(conversation.phoneNumber) || conversation.id;

        const providerInfo = providerMap[normalizedPhone];
        const decorated: Conversation = {
          ...conversation,
          contactName:
            providerInfo?.displayName ??
            conversation.contactName ??
            conversation.phoneNumber,
        };

        const existing = conversationMap.get(normalizedPhone);
        if (!existing) {
          conversationMap.set(normalizedPhone, decorated);
          continue;
        }

        const existingPriority = getStatusPriority(existing.status);
        const candidatePriority = getStatusPriority(decorated.status);

        if (candidatePriority > existingPriority) {
          conversationMap.set(normalizedPhone, decorated);
          continue;
        }

        if (candidatePriority < existingPriority) {
          continue;
        }

        const existingTime = new Date(existing.lastActiveAt).getTime() || 0;
        const candidateTime = new Date(decorated.lastActiveAt).getTime() || 0;

        if (candidateTime >= existingTime) {
          conversationMap.set(normalizedPhone, decorated);
        }
      }

      return Array.from(conversationMap.values()).sort((a, b) => {
        const dateA = new Date(a.lastActiveAt).getTime() || 0;
        const dateB = new Date(b.lastActiveAt).getTime() || 0;
        return dateB - dateA;
      });
    },
    [providerMap]
  );

  const fetchConversations = useCallback(async () => {
    if (!phoneNumberId && !userId) {
      return [];
    }

    try {
      const query = new URLSearchParams();
      if (phoneNumberId) {
        query.set('phoneNumberId', phoneNumberId);
      }
      if (userId) {
        query.set('userId', userId);
      }
      if (appUrl) {
        query.set('appUrl', appUrl);
      }

      const response = await fetch(`/api/conversations?${query.toString()}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      const data = await response.json();
      const list = data.data || [];
      setRawConversations(list);
      return list;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [phoneNumberId, userId, appUrl, authToken]);

  useEffect(() => {
    setConversations(applyDecorators(rawConversations));
  }, [applyDecorators, rawConversations]);

  useEffect(() => {
    if (phoneNumberId || userId) {
      fetchConversations();
    }
  }, [fetchConversations, phoneNumberId, userId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  // Auto-polling for conversations (every 10 seconds)
  const { isPolling } = useAutoPolling({
    interval: 10000,
    enabled: true,
    onPoll: fetchConversations
  });

  const selectByPhoneNumber = (phoneNumber: string) => {
    const normalized = normalizePhoneNumber(phoneNumber);
    const conversation = conversations.find(conv =>
      normalizePhoneNumber(conv.phoneNumber) === normalized
    );
    if (conversation) {
      onSelectConversation(conversation);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: async () => {
      if (!phoneNumberId) {
        const updated = await fetchConversations();
        return applyDecorators(updated.length > 0 ? updated : rawConversations);
      }

      setRefreshing(true);
      const query = new URLSearchParams();
      query.set('phoneNumberId', phoneNumberId);
      if (userId) {
        query.set('userId', userId);
      }
      if (appUrl) {
        query.set('appUrl', appUrl);
      }

      const response = await fetch(`/api/conversations?${query.toString()}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      const data = await response.json();
      const newConversations = data.data || [];
      setRawConversations(newConversations);
      setRefreshing(false);
      return applyDecorators(newConversations);
    },
    selectByPhoneNumber
  }));

  const filteredConversations = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      return (
        conv.phoneNumber.toLowerCase().includes(query) ||
        conv.contactName?.toLowerCase().includes(query)
      );
    });
  }, [conversations, searchQuery]);

  if (loading) {
    return (
      <div className={cn(
        "w-full md:w-96 border-r border-[#d1d7db] bg-white flex flex-col",
        isHidden && "hidden md:flex"
      )}>
        <div className="p-4 border-b border-[#d1d7db] bg-[#f0f2f5]">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="flex-1 p-3 space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex gap-3 p-3">
              <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full md:w-96 border-r border-[#d1d7db] bg-white flex flex-col",
      isHidden && "hidden md:flex"
    )}>
      <div className="p-4 border-b border-[#d1d7db] bg-[#f0f2f5]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-[#111b21]">Chats</h1>
            {isPolling && (
              <div
                className="h-2 w-2 rounded-full bg-green-500 animate-pulse"
                title="Auto-updating"
              />
            )}
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="ghost"
            size="icon"
            className="text-[#667781] hover:bg-[#d1d7db]/30"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667781]" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or start new chat"
            className="pl-9 bg-white border-[#d1d7db] focus-visible:ring-[#00a884] rounded-lg"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 h-0 overflow-hidden">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-[#667781]">
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="w-full overflow-hidden">
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation)}
              className={cn(
                'w-full p-3 pr-4 border-b border-[#e9edef] hover:bg-[#f0f2f5] text-left transition-colors relative overflow-hidden',
                selectedConversationId === conversation.id && 'bg-[#f0f2f5]'
              )}
            >
              <div className="flex gap-3 items-start overflow-hidden">
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarFallback className="bg-[#d1d7db] text-[#111b21] text-sm font-medium">
                    {getAvatarInitials(conversation.contactName, conversation.phoneNumber)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 flex justify-between items-start gap-4 overflow-hidden">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="font-medium text-[#111b21] truncate">
                      {conversation.contactName || conversation.phoneNumber}
                    </p>
                    {conversation.lastMessage && (
                      <p className="text-sm text-[#667781] truncate mt-0.5">
                        {conversation.lastMessage.direction === 'outbound' && (
                          <span className="text-[#53bdeb]">✓ </span>
                        )}
                        {conversation.lastMessage.content}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-[#667781] flex-shrink-0 mt-0.5 ml-4">
                    {formatConversationDate(conversation.lastActiveAt)}
                  </span>
                </div>
              </div>
            </button>
          ))
          }
          </div>
        )}
      </ScrollArea>
    </div>
  );
});

ConversationList.displayName = 'ConversationList';
