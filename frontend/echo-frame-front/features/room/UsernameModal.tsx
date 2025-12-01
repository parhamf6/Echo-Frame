'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useGuestStore } from '@/lib/stores/guest-store';
import { User, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
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
  const [isFocused, setIsFocused] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const { joinAsGuest } = useGuestStore();

  useEffect(() => {
    setCharCount(username.trim().length);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

  const isValid = charCount >= 2 && charCount <= 50;

  return (
    <Dialog open={true} modal>
      <DialogContent className="sm:max-w-md [&>button]:hidden border-border bg-card p-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          {/* Animated background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-50" />
          
          <div className="relative p-6 space-y-6">
            <DialogHeader className="space-y-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="mx-auto w-fit"
              >
                <div className="relative">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute inset-0 bg-primary/20 rounded-full blur-xl"
                  />
                  <div className="relative bg-primary/10 p-4 rounded-full">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <DialogTitle className="text-2xl font-bold text-center text-foreground">
                  Join the Party
                </DialogTitle>
                <DialogDescription className="text-center text-muted-foreground mt-2">
                  Choose a username to join the watch party
                </DialogDescription>
              </motion.div>
            </DialogHeader>

            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="space-y-2">
                <div className="relative">
                  <motion.div
                    animate={isFocused ? { scale: 1.02 } : { scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Input
                      placeholder="Your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      maxLength={50}
                      disabled={isLoading}
                      autoFocus
                      className="h-12 pl-4 pr-12 text-base bg-background border-2 transition-all duration-200 focus:border-primary"
                    />
                  </motion.div>

                  <AnimatePresence>
                    {username && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {isValid ? (
                          <motion.div
                            initial={{ rotate: -180 }}
                            animate={{ rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200 }}
                          >
                            <Sparkles className="h-5 w-5 text-green-500" />
                          </motion.div>
                        ) : (
                          <AlertCircle className="h-5 w-5 text-amber-500" />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <AnimatePresence mode="wait">
                    {charCount > 0 && charCount < 2 && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="text-amber-600 dark:text-amber-400"
                      >
                        At least 2 characters needed
                      </motion.span>
                    )}
                    {charCount >= 2 && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="text-green-600 dark:text-green-400"
                      >
                        Looking good!
                      </motion.span>
                    )}
                  </AnimatePresence>

                  <motion.span
                    animate={{ 
                      color: charCount > 45 ? 'rgb(239, 68, 68)' : 'rgb(156, 163, 175)'
                    }}
                    className="text-muted-foreground"
                  >
                    {charCount}/50
                  </motion.span>
                </div>
              </div>

              <motion.div
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
              >
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold relative overflow-hidden group"
                  disabled={isLoading || !isValid}
                >
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                        </motion.div>
                        Joining...
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        Join Room
                        <motion.div
                          animate={{ x: [0, 3, 0] }}
                          transition={{ 
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </motion.div>
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Shimmer effect on hover */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.6 }}
                  />
                </Button>
              </motion.div>
            </motion.form>

            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10" />
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}