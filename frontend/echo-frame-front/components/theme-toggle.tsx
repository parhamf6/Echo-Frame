// src/components/ThemeToggle.tsx
"use client";

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-lg bg-card border border-border" />
    );
  }

  const isDark = theme === 'dark';

  return (
    <motion.button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative w-10 h-10 rounded-lg bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 flex items-center justify-center overflow-hidden group"
      aria-label="Toggle theme"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Subtle background glow */}
      <motion.div
        className="absolute inset-0 rounded-lg"
        animate={{
          background: isDark 
            ? 'radial-gradient(circle at center, rgba(var(--primary), 0.15), transparent 70%)' 
            : 'radial-gradient(circle at center, rgba(var(--primary), 0.08), transparent 70%)'
        }}
        transition={{ duration: 0.5 }}
      />

      {/* Sun icon */}
      <AnimatePresence mode="wait">
        {!isDark && (
          <motion.div
            key="sun"
            initial={{ rotate: -90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0, opacity: 0 }}
            transition={{ 
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1]
            }}
            className="absolute"
          >
            <Sun className="w-5 h-5 text-foreground" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Moon icon */}
      <AnimatePresence mode="wait">
        {isDark && (
          <motion.div
            key="moon"
            initial={{ rotate: 90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: -90, scale: 0, opacity: 0 }}
            transition={{ 
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1]
            }}
            className="absolute"
          >
            <Moon className="w-5 h-5 text-foreground" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle ripple effect */}
      <motion.div
        className="absolute inset-0 rounded-lg border-2 border-primary/30"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{ 
          duration: 1.5,
          repeat: Infinity,
          repeatType: "reverse"
        }}
      />
    </motion.button>
  );
}

// Slider version with enhanced animations
export function ThemeToggleSlider() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-14 h-8 rounded-full bg-card border border-border" />
    );
  }

  const isDark = theme === 'dark';

  return (
    <motion.button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative w-14 h-8 rounded-full bg-card border border-border shadow-sm hover:shadow-md transition-all duration-300 flex items-center px-1 overflow-hidden"
      aria-label="Toggle theme"
      whileTap={{ scale: 0.95 }}
    >
      {/* Animated background */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          background: isDark 
            ? 'linear-gradient(to right, rgba(var(--primary), 0.15), rgba(var(--primary), 0.25))' 
            : 'linear-gradient(to right, rgba(var(--primary), 0.05), rgba(var(--primary), 0.1))'
        }}
        transition={{ duration: 0.5 }}
      />

      {/* Sliding circle with enhanced animation */}
      <motion.div
        className="relative w-6 h-6 rounded-full bg-primary shadow-md flex items-center justify-center z-10"
        animate={{
          x: isDark ? 24 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
        }}
      >
        <AnimatePresence mode="wait">
          {!isDark ? (
            <motion.div
              key="sun"
              initial={{ rotate: -180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 180, opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Sun className="w-3.5 h-3.5 text-primary-foreground" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ rotate: 180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -180, opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Moon className="w-3.5 h-3.5 text-primary-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Subtle track indicators */}
      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
        <motion.div
          animate={{ opacity: isDark ? 0.2 : 0.4 }}
          transition={{ duration: 0.3 }}
        >
          <Sun className="w-3 h-3 text-muted-foreground" />
        </motion.div>
        <motion.div
          animate={{ opacity: isDark ? 0.4 : 0.2 }}
          transition={{ duration: 0.3 }}
        >
          <Moon className="w-3 h-3 text-muted-foreground" />
        </motion.div>
      </div>

      {/* Subtle glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full opacity-30"
        animate={{
          background: isDark 
            ? 'radial-gradient(circle at center, rgba(var(--primary), 0.4), transparent 70%)' 
            : 'radial-gradient(circle at center, rgba(var(--primary), 0.2), transparent 70%)'
        }}
        transition={{ duration: 0.5 }}
      />
    </motion.button>
  );
}