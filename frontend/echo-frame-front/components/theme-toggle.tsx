// // src/components/ThemeToggle.tsx
// "use client";

// import { Moon, Sun } from 'lucide-react';
// import { useTheme } from 'next-themes';
// import { useEffect, useState } from 'react';

// export function ThemeToggle() {
//   const [mounted, setMounted] = useState(false);
//   const { theme, setTheme } = useTheme();

//   useEffect(() => {
//     setMounted(true);
//   }, []);

//   if (!mounted) {
//     return (
//       <div className="w-10 h-10 rounded-lg bg-card border border-border" />
//     );
//   }

//   return (
//     <button
//       onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
//       className="relative w-10 h-10 rounded-lg bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 flex items-center justify-center group"
//       aria-label="Toggle theme"
//     >
//       <Sun className="w-5 h-5 text-foreground absolute transition-all duration-300 rotate-0 scale-100 dark:-rotate-90 dark:scale-0" />
//       <Moon className="w-5 h-5 text-foreground absolute transition-all duration-300 rotate-90 scale-0 dark:rotate-0 dark:scale-100" />
//     </button>
//   );
// }


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
      {/* Background glow effect */}
      <motion.div
        className="absolute inset-0 bg-primary/10 rounded-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: isDark ? 1 : 0 }}
        transition={{ duration: 0.3 }}
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
              duration: 0.4,
              ease: [0.34, 1.56, 0.64, 1]
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
              duration: 0.4,
              ease: [0.34, 1.56, 0.64, 1]
            }}
            className="absolute"
          >
            <Moon className="w-5 h-5 text-foreground" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Particle effects on click */}
      {mounted && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={false}
        >
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary"
              style={{
                left: '50%',
                top: '50%',
              }}
              animate={{
                x: [0, Math.cos((i * Math.PI * 2) / 6) * 20],
                y: [0, Math.sin((i * Math.PI * 2) / 6) * 20],
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
              }}
              transition={{
                duration: 0.6,
                ease: "easeOut",
                times: [0, 0.3, 1],
              }}
            />
          ))}
        </motion.div>
      )}
    </motion.button>
  );
}


// ALTERNATIVE VERSION: Slider Toggle
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
      className="relative w-14 h-8 rounded-full bg-card border border-border shadow-sm hover:shadow-md transition-all duration-300 flex items-center px-1"
      aria-label="Toggle theme"
      whileTap={{ scale: 0.95 }}
    >
      {/* Background gradient */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          background: isDark 
            ? 'linear-gradient(to right, rgba(var(--primary), 0.1), rgba(var(--primary), 0.2))' 
            : 'linear-gradient(to right, rgba(var(--primary), 0.05), rgba(var(--primary), 0.1))'
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Sliding circle */}
      <motion.div
        className="relative w-6 h-6 rounded-full bg-primary shadow-md flex items-center justify-center"
        animate={{
          x: isDark ? 24 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
      >
        <AnimatePresence mode="wait">
          {!isDark ? (
            <motion.div
              key="sun"
              initial={{ rotate: -180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 180, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Sun className="w-3.5 h-3.5 text-primary-foreground" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ rotate: 180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -180, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Moon className="w-3.5 h-3.5 text-primary-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Icons in background */}
      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
        <motion.div
          animate={{ opacity: isDark ? 0.3 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Sun className="w-3 h-3 text-muted-foreground" />
        </motion.div>
        <motion.div
          animate={{ opacity: isDark ? 0 : 0.3 }}
          transition={{ duration: 0.2 }}
        >
          <Moon className="w-3 h-3 text-muted-foreground" />
        </motion.div>
      </div>
    </motion.button>
  );
}


