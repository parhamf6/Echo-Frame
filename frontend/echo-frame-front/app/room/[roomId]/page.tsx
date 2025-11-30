'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useGuestStore } from '@/lib/stores/guest-store';
import UsernameModal from '@/features/room/UsernameModal';
import RoomView from '@/features/room/RoomView';
import { toast } from 'sonner';

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  
  const { isAuthenticated, admin } = useAuthStore();
  const { guest, joinStatus, isKicked, joinAsAdmin } = useGuestStore();
  
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initRoom = async () => {
      const kickedFlag = localStorage.getItem(`kicked_${roomId}`);
      if (kickedFlag === 'true') {
        toast.error('You were removed from this room');
        router.push('/room');
        return;
      }

      if (isAuthenticated && admin) {
        try {
          await joinAsAdmin(roomId);
        } catch (error: any) {
          if (error.response?.status === 404) {
            toast.error('This room does not exist or has ended');
            router.push('/room');
          } else {
            toast.error('Failed to join room as admin');
          }
        } finally {
          setIsLoading(false);
        }
        return;
      }

      const sessionToken = localStorage.getItem(`session_${roomId}`);
      if (sessionToken) {
        try {
          await useGuestStore.getState().restoreSession(roomId, sessionToken);
        } catch (error: any) {
          console.log('Session restore failed, showing username modal:', error.message);
          setShowUsernameModal(true);
        } finally {
          setIsLoading(false);
        }
      } else {
        setShowUsernameModal(true);
        setIsLoading(false);
      }
    };

    initRoom();
  }, [roomId, isAuthenticated, admin]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (showUsernameModal) {
    return (
      <UsernameModal
        roomId={roomId}
        onSuccess={() => setShowUsernameModal(false)}
      />
    );
  }

  if (joinStatus === 'pending') {
    return <div>Waiting for approval...</div>;
  }

  if (joinStatus === 'rejected') {
    toast.error('Your join request was denied');
    router.push('/room');
    return null;
  }

  if (isKicked) {
    localStorage.setItem(`kicked_${roomId}`, 'true');
    toast.error('You were kicked by a moderator');
    router.push('/room');
    return null;
  }

  return <RoomView roomId={roomId} />;
}