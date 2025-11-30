'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useGuestStore } from '@/lib/stores/guest-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UsernameModalProps {
  roomId: string;
  onSuccess: () => void;
}

export default function UsernameModal({ roomId, onSuccess }: UsernameModalProps) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { joinAsGuest } = useGuestStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (username.trim().length < 2) {
      toast.error('Username must be at least 2 characters');
      return;
    }

    if (username.trim().length > 50) {
      toast.error('Username must be less than 50 characters');
      return;
    }

    setIsLoading(true);

    try {
      await joinAsGuest(roomId, username.trim());
      onSuccess();
      toast.success('Join request sent. Waiting for approval...');
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to join room';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} modal>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Enter Your Username</DialogTitle>
          <DialogDescription>
            Choose a username to join the watch party
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={50}
            disabled={isLoading}
            autoFocus
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Joining...' : 'Join Room'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}