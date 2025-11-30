'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function RoomEntryPage() {
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  const handleJoin = () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(roomId)) {
      toast.error('Please enter a valid room code');
      return;
    }

    router.push(`/room/${roomId}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
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
            className="text-center font-mono"
          />
          
          <Button onClick={handleJoin} className="w-full">
            Join Room
          </Button>
        </div>
      </div>
    </div>
  );
}