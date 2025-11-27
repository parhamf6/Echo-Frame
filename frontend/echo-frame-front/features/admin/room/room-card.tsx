// components/RoomStatCard.tsx
import { useRoomStore } from '@/lib/stores/room-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, RefreshCw, Users, Calendar, Trash2, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const item = {
  hidden: { y: 10, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
};

export function RoomStatCard() {
  const { room, isLoading, error, fetchRoomStatus, createRoom, deleteRoom } = useRoomStore();
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
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy room ID');
    }
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold tracking-tight">Room Status</CardTitle>
        <motion.div
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchRoomStatus}
            disabled={isLoading}
            className="rounded-md"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </motion.div>
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 text-destructive mb-5 p-2 bg-destructive/5 rounded-lg"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </motion.div>
          )}

          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-8"
            >
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </motion.div>
          ) : room ? (
            <motion.div
              key="room-active"
              variants={container}
              initial="hidden"
              animate="show"
              className="space-y-5"
            >
              <motion.div variants={item} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="default"
                    className="bg-success text-success-foreground px-2.5 py-0.5 text-xs font-semibold tracking-wide"
                  >
                    Active
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                    {room.id}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyRoomId}
                      className="h-8 px-2"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </motion.div>

                  {isAuthenticated && (
                    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                      <DialogTrigger asChild>
                        <motion.div
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5 transition-colors h-8"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </motion.div>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="text-lg">Confirm Room Deletion</DialogTitle>
                          <DialogDescription>
                            This room will be deactivated immediately. This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex justify-between">
                          <Button
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                            className="w-full sm:w-auto"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleDeleteRoom}
                            disabled={isLoading}
                            className="w-full sm:w-auto"
                          >
                            {isLoading ? 'Deleting...' : 'Delete Room'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </motion.div>

              {copySuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-success font-medium"
                >
                  Copied!
                </motion.div>
              )}

              <motion.div variants={item} className="grid grid-cols-2 gap-4">
                <StatItem icon={<Users className="h-4 w-4" />} label="Users" value={room.current_users_count} />
                <StatItem
                  icon={<Calendar className="h-4 w-4" />}
                  label="Created"
                  value={format(new Date(room.created_at), 'MMM d, yyyy')}
                />
              </motion.div>

              {room.ended_at && (
                <motion.div variants={item} className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ends At</p>
                    <p className="font-medium text-sm">
                      {format(new Date(room.ended_at), 'MMM d, yyyy, HH:mm')}
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="no-room"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="flex flex-col items-center justify-center py-8 space-y-4 text-center"
            >
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-1">No active room</p>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  Create a new room to start collaborating in real time.
                </p>
              </motion.div>

              {isAuthenticated && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Button
                    onClick={createRoom}
                    disabled={isLoading}
                    size="lg"
                    className="px-6 py-2 font-medium rounded-md shadow-sm hover:shadow-md transition-shadow"
                  >
                    {isLoading ? 'Creating...' : 'Create Room'}
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// Reusable Stat Item Component
const StatItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="flex items-center gap-2">
    <div className="p-2 bg-muted/30 rounded-lg text-muted-foreground">{icon}</div>
    <div>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  </div>
);