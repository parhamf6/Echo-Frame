'use client';

interface TypingIndicatorProps {
  users: string[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (!users.length) return null;
  const label =
    users.length === 1
      ? `${users[0]} is typing...`
      : `${users.slice(0, 2).join(', ')}${users.length > 2 ? ' and others' : ''} are typing...`;
  return <div className="text-xs text-muted-foreground mt-1">{label}</div>;
}

