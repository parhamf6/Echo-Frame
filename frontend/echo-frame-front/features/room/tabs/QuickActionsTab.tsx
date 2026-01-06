'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Pause, Rewind, MessageSquare, XCircle, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useRoomStore } from '@/lib/stores/room-store';

interface QuickActionsTabProps {
  roomId: string;
  guest: any;
  socket?: any;
}

export default function QuickActionsTab({ roomId, guest, socket }: QuickActionsTabProps) {
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [quickMessage, setQuickMessage] = useState('');
  const {
    viewerRequests,
    viewerRequestsVersion,
    removeViewerRequest,
  } = useRoomStore();

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
    if (!socket) {
      toast.error('Not connected to room');
      return;
    }

    socket.emit?.('request:pause', {
      room_id: roomId,
      guest_id: guest?.id,
      username: guest?.username,
    });
  };

  const requestRewind = (seconds: number) => {
    if (!canSendRequest()) return;
    if (!socket) {
      toast.error('Not connected to room');
      return;
    }

    socket.emit?.('request:rewind', {
      room_id: roomId,
      guest_id: guest?.id,
      username: guest?.username,
      seconds,
    });
  };

  const sendQuickMessage = () => {
    if (!quickMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!canSendRequest()) return;
    if (!socket) {
      toast.error('Not connected to room');
      return;
    }

    socket.emit?.('request:message', {
      room_id: roomId,
      guest_id: guest?.id,
      username: guest?.username,
      message: quickMessage.trim(),
    });
    setQuickMessage('');
  };

  if (isAdminOrMod) {
    return (
      <div className="h-full flex flex-col p-4 space-y-4 overflow-y-auto">
        <div>
          <h3 className="font-semibold text-sm mb-1">Viewer Requests</h3>
          <p className="text-xs text-muted-foreground">
            When viewers request pauses or rewinds, they will appear here. You can apply or dismiss them.
          </p>
        </div>

        {viewerRequests.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">
              No active playback requests from viewers.
            </p>
          </div>
        )}

        {viewerRequests.length > 0 && (
          <div className="space-y-2">
            {viewerRequests.map((req) => (
              <div
                key={req.id || `${req.type}-${req.timestamp}-${req.username}`}
                className="border border-border rounded-lg p-3 bg-background/60 flex flex-col space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {req.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {req.type === 'pause' && 'Requested to pause playback'}
                      {req.type === 'rewind' && `Requested rewind by ${req.seconds ?? 10}s`}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {socket && (req.type === 'pause' || req.type === 'rewind') && req.id && (
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => {
                        socket.emit?.('approve:request', {
                          request_id: req.id,
                          room_id: roomId,
                          guest_id: guest?.id,
                        });
                      }}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Apply Request
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => {
                      if (socket && req.id) {
                        socket.emit?.('dismiss:request', {
                          request_id: req.id,
                          room_id: roomId,
                          guest_id: guest?.id,
                        });
                      }
                      if (req.id) {
                        removeViewerRequest(req.id);
                      }
                    }}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
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