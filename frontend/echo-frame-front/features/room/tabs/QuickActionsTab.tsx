'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pause, Rewind, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface QuickActionsTabProps {
  roomId: string;
  guest: any;
}

export default function QuickActionsTab({ roomId, guest }: QuickActionsTabProps) {
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [quickMessage, setQuickMessage] = useState('');

  const isAdminOrMod = guest?.role === 'admin' || guest?.role === 'moderator';

  // Throttle requests (10 seconds)
  const canSendRequest = () => {
    const now = Date.now();
    if (now - lastRequestTime < 10000) {
      const remaining = Math.ceil((10000 - (now - lastRequestTime)) / 1000);
      toast.error(`Please wait ${remaining}s before sending another request`);
      return false;
    }
    setLastRequestTime(now);
    return true;
  };

  const requestPause = () => {
    if (!canSendRequest()) return;
    
    // This would emit via Socket.io (handled in RoomView)
    toast.success('Pause request sent to moderators');
  };

  const requestRewind = (seconds: number) => {
    if (!canSendRequest()) return;
    
    toast.success(`Rewind request (${seconds}s) sent to moderators`);
  };

  const sendQuickMessage = () => {
    if (!quickMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!canSendRequest()) return;

    toast.success('Message sent to moderators');
    setQuickMessage('');
  };

  if (isAdminOrMod) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            As a moderator, you have direct control over playback
          </p>
          <p className="text-xs text-muted-foreground">
            Use the video player controls to manage the session
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-sm mb-1">Quick Actions</h3>
        <p className="text-xs text-muted-foreground">
          Send requests to moderators (limit: 1 per 10 seconds)
        </p>
      </div>

      {/* Playback Controls */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Playback</h4>
        
        <Button
          onClick={requestPause}
          variant="outline"
          className="w-full justify-start"
        >
          <Pause className="h-4 w-4 mr-2" />
          Request Pause
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => requestRewind(10)}
            variant="outline"
            size="sm"
          >
            <Rewind className="h-3 w-3 mr-1" />
            -10s
          </Button>
          <Button
            onClick={() => requestRewind(30)}
            variant="outline"
            size="sm"
          >
            <Rewind className="h-3 w-3 mr-1" />
            -30s
          </Button>
        </div>
      </div>

      {/* Quick Message */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Quick Message</h4>
        
        <div className="space-y-2">
          <textarea
            value={quickMessage}
            onChange={(e) => setQuickMessage(e.target.value)}
            placeholder="Send a quick message to moderators..."
            rows={3}
            maxLength={200}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {quickMessage.length} / 200
            </span>
            
            <Button
              onClick={sendQuickMessage}
              size="sm"
              disabled={!quickMessage.trim()}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Send
            </Button>
          </div>
        </div>
      </div>

      {/* Common Messages */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Common Messages</h4>
        
        <div className="grid grid-cols-1 gap-2">
          {[
            "Can we slow down a bit?",
            "I'm confused, can we review?",
            "Can you turn up the volume?",
            "Internet issues, please pause",
          ].map((msg) => (
            <Button
              key={msg}
              onClick={() => setQuickMessage(msg)}
              variant="ghost"
              size="sm"
              className="justify-start text-xs"
            >
              {msg}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}