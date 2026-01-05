'use client';

import { useState } from 'react';
import { MessageSquare, Mic, Users, Zap, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import ChatTab from './tabs/ChatTab';
import VoiceTab from './tabs/VoiceTab';
import UsersTab from './tabs/UsersTab';
import QuickActionsTab from './tabs/QuickActionsTab';
import JoinRequestsTab from './tabs/JoinRequestsTab';

interface RoomTabsProps {
  roomId: string;
  livekit: any;
  guest: any;
  audioLevel?: any;
}

type TabType = 'chat' | 'voice' | 'users' | 'actions' | 'requests';

export default function RoomTabs({ roomId, livekit, guest, audioLevel }: RoomTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const isAdminOrMod = guest?.role === 'admin' || guest?.role === 'moderator';

  const tabs = [
    { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare },
    { id: 'voice' as TabType, label: 'Voice', icon: Mic },
    { id: 'users' as TabType, label: 'Users', icon: Users },
    { id: 'actions' as TabType, label: 'Actions', icon: Zap },
    ...(isAdminOrMod ? [{ id: 'requests' as TabType, label: 'Requests', icon: LogIn }] : []),
  ];

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col h-[600px]">
      {/* Tab Headers */}
      <div className="flex border-b border-border bg-muted/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center space-x-2 px-4 py-3
                transition-colors relative
                ${isActive 
                  ? 'text-primary bg-background' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">
                {tab.label}
              </span>
              
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <ChatTab roomId={roomId} livekit={livekit} guest={guest} />
        )}
        {activeTab === 'voice' && (
          <VoiceTab livekit={livekit} guest={guest} audioLevel={audioLevel} />
        )}
        {activeTab === 'users' && (
          <UsersTab roomId={roomId} guest={guest} />
        )}
        {activeTab === 'actions' && (
          <QuickActionsTab roomId={roomId} guest={guest} />
        )}
        {activeTab === 'requests' && isAdminOrMod && (
          <JoinRequestsTab canModerate={isAdminOrMod} />
        )}
      </div>
    </div>
  );
}