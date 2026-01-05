'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/lib/stores/chat-store';
import { Loader2 } from 'lucide-react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import { cn } from '@/lib/utils';

interface ChatTabProps {
  roomId: string;
  livekit: any;
  guest: any;
}

export default function ChatTab({ roomId, livekit, guest }: ChatTabProps) {
  const { messages, isLoadingHistory } = useChatStore();
  
  // For admins, default to true if permissions not available
  const canChat = guest?.role === 'admin' 
    ? (guest?.permissions?.can_chat !== false ? true : false) 
    : (guest?.permissions?.can_chat || false);

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center space-y-2 animate-in fade-in duration-300">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages */}
      <div className="flex-1 overflow-hidden relative">
        {/* Gradient fade at the top */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
        
        <MessageList
          messages={messages}
          currentUserId={guest?.id || ''}
          livekit={livekit}
          username={guest?.username || ''}
        />
      </div>

      {/* Typing Indicator */}
      <div className="px-4 py-2 min-h-[24px]">
        <TypingIndicator currentUserId={guest?.id || ''} />
      </div>

      {/* Input */}
      <div className={cn(
        "p-4 border-t border-border bg-background/95 backdrop-blur-sm",
        "transition-all duration-200"
      )}>
        <MessageInput
          livekit={livekit}
          canChat={canChat}
          username={guest?.username || ''}
          userId={guest?.id || ''}
        />
      </div>
    </div>
  );
}