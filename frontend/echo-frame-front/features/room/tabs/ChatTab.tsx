'use client';

import { useEffect, useMemo, useState } from 'react';
import { useChatStore } from '@/lib/stores/chat-store';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { Card } from '@/components/ui/card';

interface ChatTabProps {
  roomId: string;
  canChat: boolean;
  currentUserId?: string;
  onSendMessage: (text: string, replyToId?: string | null) => Promise<void> | void;
  onReact: (messageId: string, emoji: string, action: 'add' | 'remove') => Promise<void> | void;
  onTyping?: () => Promise<void> | void;
}

export function ChatTab({ roomId, canChat, currentUserId, onSendMessage, onReact, onTyping }: ChatTabProps) {
  const { messages, reactions, isLoadingHistory, loadHistory, typingUsers } = useChatStore();
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);

  useEffect(() => {
    loadHistory(roomId);
  }, [roomId, loadHistory]);

  const typingUsernames = useMemo(() => Object.values(typingUsers || {}).map((t) => t.name), [typingUsers]);

  return (
    <Card className="p-3 space-y-3">
      {isLoadingHistory ? (
        <div className="text-sm text-muted-foreground">Loading chat history...</div>
      ) : (
        <>
          <MessageList
            messages={messages}
            reactions={reactions}
            currentUserId={currentUserId}
            onReact={onReact}
            onReply={(id, username) => setReplyTo({ id, username })}
            typingUsers={typingUsernames}
          />
          <TypingIndicator users={typingUsernames} />
        </>
      )}
      <MessageInput
        onSend={onSendMessage}
        onTyping={onTyping}
        canChat={canChat}
        replyTo={replyTo}
        clearReply={() => setReplyTo(null)}
      />
    </Card>
  );
}

