'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Smile, Mic, MicOff, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useChatStore } from '@/lib/stores/chat-store';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  livekit: any;
  canChat: boolean;
  username: string;
  userId: string;
}

export default function MessageInput({ livekit, canChat, username, userId }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Get addMessage from store to add message immediately
  const { addMessage } = useChatStore();

  // Handle typing indicator
  useEffect(() => {
    if (message.trim() && !isTyping) {
      setIsTyping(true);
      livekit.sendTyping(true, username);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        livekit.sendTyping(false, username);
      }
    }, 3000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message, isTyping, livekit, username]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current && 
        !emojiPickerRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest('.emoji-picker-button')
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    if (!canChat) {
      console.warn('[MessageInput] ⚠️ Cannot send: canChat is', canChat, 'userId:', userId);
      toast.error('You do not have permission to send messages');
      return;
    }

    const trimmed = message.trim();
    if (!trimmed) return;

    if (trimmed.length > 1000) {
      toast.error('Message is too long (max 1000 characters)');
      return;
    }

    // Generate message ID and timestamp (must match what's sent via LiveKit)
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    console.log('[MessageInput] 📤 Sending message:', {
      messageId,
      userId,
      username,
      message: trimmed.substring(0, 50),
      canChat,
      liveKitConnected: livekit?.isConnected,
    });

    // Add message to local store IMMEDIATELY
    const messageToAdd = {
      id: messageId,
      user_id: userId,
      username: username,
      message: trimmed,
      timestamp: timestamp,
      reply_to_id: null,
    };

    addMessage(messageToAdd);
    console.log('[MessageInput] ✅ Message added to local store:', messageId);

    // Then send via LiveKit
    const success = livekit.sendChatMessage(trimmed, null, username);

    if (success) {
      console.log('[MessageInput] ✅ Message sent via LiveKit:', messageId);
      setMessage('');
      setIsTyping(false);
      livekit.sendTyping(false, username);
      textareaRef.current?.focus();
    } else {
      console.error('[MessageInput] ❌ Failed to send via LiveKit, but message is in local store');
      toast.error('Failed to send message. Please check your connection.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setMessage((prev) => prev + emoji.native);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleAttachment = () => {
    toast.info('File attachments will be available soon');
  };

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      toast.info('Voice recording will be available soon');
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  return (
    <div className="space-y-2 relative">
      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="absolute bottom-20 right-4 z-50">
          <Picker
            data={data}
            onEmojiSelect={handleEmojiSelect}
            theme="auto"
            previewPosition="none"
            skinTonePosition="none"
          />
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2">
        {/* Attachment Button */}
        <button
          onClick={handleAttachment}
          disabled={!canChat}
          className={cn(
            "p-2.5 rounded-lg transition-all duration-200",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Paperclip className="h-5 w-5" />
        </button>

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={canChat ? 'Type a message...' : 'You cannot send messages'}
            disabled={!canChat || !livekit?.isConnected}
            rows={1}
            className={cn(
              "w-full px-4 py-3 pr-12 bg-muted/50 border border-border rounded-lg",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
              "disabled:opacity-50 disabled:cursor-not-allowed resize-none",
              "transition-all duration-200",
              "placeholder:text-muted-foreground/70"
            )}
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />

          {/* Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={!canChat}
            className={cn(
              "absolute right-3 bottom-3 emoji-picker-button",
              "p-1.5 rounded-lg transition-all duration-200",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>

        {/* Voice Record Button */}
        <button
          onClick={handleVoiceRecord}
          disabled={!canChat}
          className={cn(
            "p-2.5 rounded-lg transition-all duration-200",
            isRecording 
              ? "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!canChat || !message.trim() || !livekit?.isConnected}
          className={cn(
            "p-2.5 bg-primary text-primary-foreground rounded-lg",
            "hover:bg-primary/90 transition-all duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            message.trim() && "animate-pulse"
          )}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>

      {/* Character Count */}
      {message.length > 800 && (
        <div className="flex justify-between items-center">
          <p className={cn(
            "text-xs",
            message.length > 950 
              ? "text-destructive" 
              : "text-muted-foreground"
          )}>
            {message.length} / 1000
          </p>
          
          {isTyping && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}