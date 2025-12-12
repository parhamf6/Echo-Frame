'use client';

import { useState } from 'react';
import { ChatTab } from './tabs/ChatTab';
import { VoiceTab } from './tabs/VoiceTab';
import { UsersTab } from './tabs/UsersTab';
import { QuickActionsTab } from './tabs/QuickActionsTab';
import { Room } from 'livekit-client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RoomTabsProps {
  roomId: string;
  canChat: boolean;
  currentUserId?: string;
  livekitRoom: Room | null;
  onSendMessage: (text: string, replyToId?: string | null) => Promise<void> | void;
  onReact: (messageId: string, emoji: string, action: 'add' | 'remove') => Promise<void> | void;
  onTyping?: () => Promise<void> | void;
  onRequestPause?: () => void;
  onRequestRewind?: (seconds: number) => void;
}

export function RoomTabs({
  roomId,
  canChat,
  currentUserId,
  livekitRoom,
  onSendMessage,
  onReact,
  onTyping,
  onRequestPause,
  onRequestRewind,
}: RoomTabsProps) {
  const [tab, setTab] = useState('chat');

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="mb-3">
        <TabsTrigger value="chat">Text</TabsTrigger>
        <TabsTrigger value="voice">Voice</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="actions">Quick Actions</TabsTrigger>
      </TabsList>
      <TabsContent value="chat">
        <ChatTab
          roomId={roomId}
          canChat={canChat}
          currentUserId={currentUserId}
          onSendMessage={onSendMessage}
          onReact={onReact}
          onTyping={onTyping}
        />
      </TabsContent>
      <TabsContent value="voice">
        <VoiceTab room={livekitRoom} />
      </TabsContent>
      <TabsContent value="users">
        <UsersTab roomId={roomId} />
      </TabsContent>
      <TabsContent value="actions">
        <QuickActionsTab onRequestPause={onRequestPause} onRequestRewind={onRequestRewind} />
      </TabsContent>
    </Tabs>
  );
}

