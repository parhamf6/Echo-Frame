'use client';

import { ReactionPicker } from './ReactionPicker';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface MessageItemProps {
  id: string;
  username: string;
  message: string;
  timestamp: string;
  reply_to_id?: string | null;
  reactions: Record<string, string[]>;
  currentUserId?: string;
  onReact: (messageId: string, emoji: string, action: 'add' | 'remove') => void;
  onReply: (messageId: string, username: string) => void;
}

export function MessageItem({
  id,
  username,
  message,
  timestamp,
  reply_to_id,
  reactions,
  currentUserId,
  onReact,
  onReply,
}: MessageItemProps) {
  const renderReactions = () => {
    const entries = Object.entries(reactions || {});
    if (!entries.length) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-2 text-xs">
        {entries.map(([emoji, users]) => {
          const selfReacted = currentUserId ? users.includes(currentUserId) : false;
          return (
            <button
              key={emoji}
              onClick={() => onReact(id, emoji, selfReacted ? 'remove' : 'add')}
              className={`px-2 py-1 rounded-full border text-foreground/80 ${selfReacted ? 'bg-primary/10 border-primary/40' : 'bg-muted border-border'}`}
            >
              {emoji} {users.length}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-2 rounded border border-border bg-card/40">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{username}</span>
        <span>{formatDistanceToNow(new Date(timestamp), { addSuffix: true })}</span>
      </div>
      {reply_to_id && <div className="text-xs text-muted-foreground mt-1">Replying to {reply_to_id}</div>}
      <div className="mt-1 text-foreground whitespace-pre-wrap break-words">{message}</div>
      {renderReactions()}
      <div className="flex items-center gap-2 mt-2 text-xs">
        <ReactionPicker onSelect={(emoji) => onReact(id, emoji, 'add')} />
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => onReply(id, username)}>
          Reply
        </Button>
      </div>
    </div>
  );
}

