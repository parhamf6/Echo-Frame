'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import GlassmorphicNavbar from '@/components/app-navbar';

export default function RoomEntryPage() {
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  const handleJoin = () => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(roomId)) {
      toast.error('Please enter a valid room code');
      return;
    }

    router.push(`/room/${roomId}`);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <GlassmorphicNavbar />
      <div className="w-full max-w-md space-y-6 p-8 
        bg-card/10 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl">

        <div className="text-center">
          <h1 className="text-3xl font-bold">Join Watch Party</h1>
          <p className="text-muted-foreground mt-2">
            Enter the room code to join
          </p>
        </div>

        <div className="space-y-4">
          <Input
            placeholder="Room Code (UUID)"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="text-center font-mono border-1 border-accent"
          />

          <Button onClick={handleJoin} className="w-full">
            Join Room
          </Button>
        </div>
      </div>
    </div>
  );
}
