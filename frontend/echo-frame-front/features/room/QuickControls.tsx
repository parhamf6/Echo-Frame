'use client';

import { useState } from 'react';
import { Room } from 'livekit-client';
import { Button } from '@/components/ui/button';

interface QuickControlsProps {
  room: Room | null;
  onLeave?: () => void;
}

export function QuickControls({ room, onLeave }: QuickControlsProps) {
  const [muted, setMuted] = useState(false);

  const toggleMute = async () => {
    if (!room) return;
    const next = !muted;
    setMuted(next);
    await room.localParticipant.setMicrophoneEnabled(!next);
  };

  return (
    <div className="flex gap-2 justify-end">
      <Button variant={muted ? 'destructive' : 'outline'} size="sm" onClick={toggleMute} disabled={!room}>
        {muted ? 'Unmute' : 'Mute'}
      </Button>
      <Button variant="outline" size="sm" onClick={onLeave}>
        Leave Room
      </Button>
    </div>
  );
}

