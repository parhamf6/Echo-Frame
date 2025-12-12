'use client';

import { Room } from 'livekit-client';
import { Card } from '@/components/ui/card';

interface VoiceTabProps {
  room: Room | null;
}

export function VoiceTab({ room }: VoiceTabProps) {
  const participants = room ? [room.localParticipant, ...room.participants.values()] : [];

  const displayName = (p: any) => {
    try {
      if (p.name) return p.name;
      if (p.metadata) {
        const meta = JSON.parse(p.metadata);
        if (meta.username) return meta.username;
      }
    } catch (_) {}
    return p.identity;
  };

  if (!room) {
    return <Card className="p-3 text-sm text-muted-foreground">Not connected to LiveKit.</Card>;
  }

  return (
    <Card className="p-3 space-y-2">
      {participants.map((p) => {
        const name = displayName(p);
        return (
          <div key={p.sid} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
            <div className="text-sm">{name}</div>
            <div className="text-xs text-muted-foreground">{p.isSpeaking ? 'Speaking' : 'Idle'}</div>
          </div>
        );
      })}
    </Card>
  );
}

