'use client';

import { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import { Message, ReactionMap } from '@/lib/stores/chat-store';

interface MessageListProps {
  messages: Message[];
  reactions: ReactionMap;
  currentUserId?: string;
  onReact: (messageId: string, emoji: string, action: 'add' | 'remove') => void;
  onReply: (messageId: string, username: string) => void;
  typingUsers: string[];
}

export function MessageList({ messages, reactions, currentUserId, onReact, onReply, typingUsers }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUsers.join(',')]);

  return (
    <div className="flex flex-col gap-2 h-80 overflow-y-auto px-1">
      {messages.map((m) => (
        <MessageItem
          key={m.id}
          id={m.id}
          username={m.username}
          message={m.message}
          timestamp={m.timestamp}
          reply_to_id={m.reply_to_id}
          reactions={reactions[m.id] || {}}
          currentUserId={currentUserId}
          onReact={onReact}
          onReply={onReply}
        />
      ))}
      {typingUsers.length > 0 && (
        <div className="text-xs text-muted-foreground">Someone is typing...</div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

