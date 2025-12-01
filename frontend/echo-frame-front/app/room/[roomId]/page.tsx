'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Users, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useGuestStore } from '@/lib/stores/guest-store';
import UsernameModal from '@/features/room/UsernameModal';
import RoomView from '@/features/room/RoomView';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  
  const { isAuthenticated, admin } = useAuthStore();
  const { guest, joinStatus, isKicked, joinAsAdmin } = useGuestStore();
  
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Connecting to room...');

  useEffect(() => {
    const initRoom = async () => {
      try {
        setLoadingMessage('Verifying room...');
        const { data: status } = await apiClient.get('/api/v1/room/status');

        if (!status?.id || status.id !== roomId || status.is_active === false) {
          toast.error('This room does not exist or has ended');
          router.push('/room');
          return;
        }
      } catch (error) {
        toast.error('This room does not exist or has ended');
        router.push('/room');
        return;
      }

      const kickedFlag = localStorage.getItem(`kicked_${roomId}`);
      if (kickedFlag === 'true') {
        toast.error('You were removed from this room');
        router.push('/room');
        return;
      }

      if (isAuthenticated && admin) {
        try {
          setLoadingMessage('Joining as admin...');
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
          setLoadingMessage('Restoring session...');
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full shadow-lg"
        >
          <div className="flex flex-col items-center space-y-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="relative"
            >
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
              <Loader2 className="h-16 w-16 text-primary relative" />
            </motion.div>
            
            <div className="text-center space-y-2">
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xl font-semibold text-foreground"
              >
                {loadingMessage}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-sm text-muted-foreground"
              >
                Please wait a moment
              </motion.p>
            </div>

            <motion.div
              className="w-full bg-muted rounded-full h-1.5 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-card border border-border rounded-2xl p-8 max-w-md w-full shadow-lg"
        >
          <div className="flex flex-col items-center space-y-6 text-center">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="relative"
            >
              <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl" />
              <div className="relative bg-yellow-500/10 p-4 rounded-full">
                <Users className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
              </div>
            </motion.div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                Waiting for Approval
              </h2>
              <p className="text-muted-foreground">
                The host is reviewing your request to join
              </p>
            </div>

            <motion.div
              className="flex space-x-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-primary rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
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