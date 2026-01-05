'use client';

import { useChatStore } from '@/lib/stores/chat-store';

interface TypingIndicatorProps {
  currentUserId: string;
}

export default function TypingIndicator({ currentUserId }: TypingIndicatorProps) {
  const { typingUsers } = useChatStore();

  // Filter out current user
  const othersTyping = Array.from(typingUsers.values()).filter(
    (user) => user.user_id !== currentUserId
  );

  if (othersTyping.length === 0) {
    return null;
  }

  const names = othersTyping.map((u) => u.username);
  const displayText =
    names.length === 1
      ? `${names[0]} is typing...`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing...`
      : `${names[0]} and ${names.length - 1} others are typing...`;

  return (
    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
      <div className="flex space-x-1">
        <span className="animate-bounce">●</span>
        <span className="animate-bounce animation-delay-200">●</span>
        <span className="animate-bounce animation-delay-400">●</span>
      </div>
      <span>{displayText}</span>
    </div>
  );
}