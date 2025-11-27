// components/RoomQuickActions.tsx
import { useRoomStore } from '@/lib/stores/room-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Copy, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function RoomQuickActions() {
  const { room, isLoading, fetchRoomStatus, createRoom, deleteRoom } = useRoomStore();
  const { isAuthenticated } = useAuthStore();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    fetchRoomStatus();
  }, [fetchRoomStatus]);

  const handleDeleteRoom = async () => {
    if (room) {
      await deleteRoom(room.id);
      setIsDeleteDialogOpen(false);
    }
  };

  const copyRoomId = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.id);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 1500);
    } catch (err) {
      console.error('Failed to copy');
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Card className="bg-card border border-border shadow-2xl rounded-lg w-full max-w-[320px] overflow-hidden">
      <CardContent className="p-3">
        <AnimatePresence mode="wait">
          {room ? (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge className="bg-live text-success-foreground px-2 py-0.5 text-[10px] font-medium rounded">
                  Live
                </Badge>
                <span className="text-xs text-muted-foreground font-mono truncate">
                  {room.id}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={copyRoomId}
                  className="p-1.5 rounded-md hover:bg-muted/40 transition-colors"
                  title="Copy room ID"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </motion.button>

                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.05 }}
                      className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                      title="Delete room"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </motion.button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Delete Room?</DialogTitle>
                      <DialogDescription>
                        This will deactivate your room immediately. All users will be disconnected.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDeleteDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteRoom}
                        disabled={isLoading}
                      >
                        Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between"
            >
              <span className="text-sm text-muted-foreground">No active room</span>
              <Button
                onClick={createRoom}
                disabled={isLoading}
                size="sm"
                className="h-7 px-2.5"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User count badge — only when room exists */}
        {room && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground bg-muted/30 rounded py-1"
          >
            <Users className="h-3 w-3" />
            <span>{room.current_users_count} user{room.current_users_count !== 1 ? 's' : ''}</span>
          </motion.div>
        )}

        {/* Copied feedback */}
        <AnimatePresence>
          {copySuccess && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-2 right-2 text-[10px] font-medium text-success"
            >
              Copied!
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}