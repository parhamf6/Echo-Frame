'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ReactionPickerProps {
  messageId: string;
  livekit: any;
  onClose: () => void;
  username: string;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];

export default function ReactionPicker({ messageId, livekit, onClose, username }: ReactionPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleReaction = (emoji: string) => {
    livekit.sendReaction(messageId, emoji, 'add', username);
    onClose();
  };

  return (
    <div
      ref={pickerRef}
      className="flex items-center gap-1 p-2 bg-background border border-border rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {QUICK_REACTIONS.map((emoji, index) => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          className={cn(
            'p-2 rounded-lg text-xl transition-all duration-200 hover:scale-125 hover:bg-muted',
            // Add a staggered animation for each emoji
            `animate-in fade-in slide-in-from-bottom-2 duration-200`,
            `delay-[${index * 30}ms]`
          )}
          style={{
            animationDelay: `${index * 30}ms`,
            animationFillMode: 'both'
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}