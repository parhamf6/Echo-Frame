'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MessageInputProps {
  onSend: (text: string, replyToId?: string | null) => Promise<void> | void;
  onTyping?: () => Promise<void> | void;
  canChat: boolean;
  replyTo?: { id: string; username: string } | null;
  clearReply: () => void;
}

export function MessageInput({ onSend, onTyping, canChat, replyTo, clearReply }: MessageInputProps) {
  const [text, setText] = useState('');
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, []);

  const handleTyping = () => {
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {}, 3000);
    onTyping?.();
  };

  const handleSend = async () => {
    if (!text.trim() || !canChat) return;
    await onSend(text.trim(), replyTo?.id);
    setText('');
    clearReply();
  };

  return (
    <div className="space-y-2">
      {replyTo && (
        <div className="text-xs text-muted-foreground flex items-center justify-between bg-muted/60 px-3 py-1 rounded">
          Replying to {replyTo.username}
          <button className="text-primary text-xs" onClick={clearReply}>
            Cancel
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            } else {
              handleTyping();
            }
          }}
          placeholder={canChat ? 'Type a message...' : 'Chat disabled'}
          disabled={!canChat}
        />
        <Button onClick={handleSend} disabled={!canChat || !text.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}

