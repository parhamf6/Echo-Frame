'use client';

import { useEffect, useRef, useState } from 'react';
import { Message, useChatStore } from '@/lib/stores/chat-store';
import { formatDistanceToNow } from 'date-fns';
import { Reply, Smile, Check, CheckCheck } from 'lucide-react';
import ReactionPicker from './ReactionPicker';
import { cn } from '@/lib/utils';

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  livekit: any;
  currentUserId: string;
  username: string;
}

// Generate a consistent color for a user based on their ID
const getUserColor = (userId: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-yellow-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ];
  
  // Create a hash from the userId to get a consistent index
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

// Get user initials
const getUserInitials = (username: string): string => {
  return username
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

export default function MessageItem({ message, isOwn, livekit, currentUserId, username }: MessageItemProps) {
  const { reactions } = useChatStore();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [messageRead, setMessageRead] = useState(false);

  const messageReactions = reactions[message.id] || {};
  const hasReactions = Object.keys(messageReactions).length > 0;

  // Format timestamp
  const timeAgo = formatDistanceToNow(new Date(message.timestamp), { addSuffix: true });

  // Get replied message (if any)
  const { messages } = useChatStore();
  const repliedMessage = message.reply_to_id
    ? messages.find((m) => m.id === message.reply_to_id)
    : null;

  // Mark message as read when it's visible
  const messageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOwn || messageRead) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setMessageRead(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    
    if (messageRef.current) {
      observer.observe(messageRef.current);
    }
    
    return () => observer.disconnect();
  }, [isOwn, messageRead]);

  const userColor = getUserColor(message.user_id);
  const userInitials = getUserInitials(message.username);

  return (
    <div
      ref={messageRef}
      className={cn(
        'flex gap-3 px-4 py-2 transition-all duration-200',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        isHovered && 'bg-muted/30'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* User Avatar */}
      <div className="flex-shrink-0 relative">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm',
            userColor
          )}
        >
          {userInitials}
        </div>
        {isOwn && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
            {messageRead ? (
              <CheckCheck className="w-3 h-3 text-primary-foreground" />
            ) : (
              <Check className="w-3 h-3 text-primary-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className={cn('flex flex-col max-w-[80%]', isOwn && 'items-end')}>
        {/* Username & Time */}
        <div className={cn('flex items-center gap-2 mb-1', isOwn && 'flex-row-reverse')}>
          <span className="text-sm font-medium text-foreground">{message.username}</span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>

        {/* Reply Preview */}
        {repliedMessage && (
          <div
            className={cn(
              'p-2 rounded-lg mb-1 border-l-2 bg-muted/50 text-xs',
              isOwn ? 'border-r-2 border-l-0' : 'border-l-2 border-r-0'
            )}
            style={{
              borderColor: `hsl(var(--accent))`,
            }}
          >
            <p className="font-medium text-muted-foreground">
              Replying to {repliedMessage.username}
            </p>
            <p className="text-muted-foreground truncate mt-1">
              {repliedMessage.message}
            </p>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={cn(
            'relative group px-4 py-2 rounded-2xl shadow-sm transition-all duration-200',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted text-foreground rounded-bl-md',
            isHovered && 'shadow-md'
          )}
        >
          <p className="text-sm break-words whitespace-pre-wrap">
            {message.message}
          </p>

          {/* Reaction Button */}
          <button
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className={cn(
              'absolute opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-background border border-border rounded-full hover:bg-muted',
              isOwn ? '-left-2 -bottom-2' : '-right-2 -bottom-2'
            )}
          >
            <Smile className="h-3 w-3" />
          </button>

          {/* Reaction Picker */}
          {showReactionPicker && (
            <div className={cn('absolute z-10', isOwn ? 'right-0' : 'left-0', 'bottom-full mb-2')}>
              <ReactionPicker
                messageId={message.id}
                livekit={livekit}
                onClose={() => setShowReactionPicker(false)}
                username={username}
              />
            </div>
          )}
        </div>

        {/* Reactions */}
        {hasReactions && (
          <div className={cn('flex flex-wrap gap-1 mt-1', isOwn && 'justify-end')}>
            {Object.entries(messageReactions).map(([emoji, userIds]) => {
              const isReacted = userIds.includes(currentUserId);

              return (
                <button
                  key={emoji}
                  onClick={() => {
                    livekit.sendReaction(
                      message.id,
                      emoji,
                      isReacted ? 'remove' : 'add',
                      username
                    );
                  }}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all duration-200',
                    isReacted
                      ? 'bg-primary/20 border border-primary/50 scale-105'
                      : 'bg-muted/70 border border-border hover:bg-muted'
                  )}
                >
                  <span>{emoji}</span>
                  <span className="text-muted-foreground">{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}