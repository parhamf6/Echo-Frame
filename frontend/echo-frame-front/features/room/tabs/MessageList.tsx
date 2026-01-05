'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/lib/stores/chat-store';
import MessageItem from './MessageItem';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  livekit: any;
  username: string;
}

export default function MessageList({ messages, currentUserId, livekit, username }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout>();
  const prevMessagesLength = useRef(messages.length);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    // Only auto-scroll if we're not already at the bottom or if we received a new message
    if (!isUserScrolling.current || messages.length > prevMessagesLength.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  // Detect user scrolling
  const handleScroll = () => {
    isUserScrolling.current = true;

    // Reset after 2 seconds
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    scrollTimeout.current = setTimeout(() => {
      // Check if at bottom
      const container = containerRef.current;
      if (container) {
        const isAtBottom =
          container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
        isUserScrolling.current = !isAtBottom;
      }
    }, 2000);
  };

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2 animate-in fade-in duration-300">
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <p className="text-muted-foreground font-medium">No messages yet</p>
          <p className="text-sm text-muted-foreground">Be the first to say hello!</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn(
        'h-full overflow-y-auto px-2 py-4 space-y-1',
        'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent'
      )}
    >
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={cn(
            'animate-in slide-in-from-bottom-2 duration-300',
            // Stagger the animation for each message
            index > messages.length - 5 && 'delay-[50ms]'
          )}
          style={{
            animationDelay: `${Math.min(index, messages.length - 1) * 50}ms`,
            animationFillMode: 'both'
          }}
        >
          <MessageItem
            message={message}
            isOwn={message.user_id === currentUserId}
            livekit={livekit}
            currentUserId={currentUserId}
            username={username}
          />
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}