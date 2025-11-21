// src/components/ThemeTransition.tsx
"use client";

import { useTheme } from 'next-themes';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function ThemeTransition() {
  const { theme } = useTheme();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [displayedTheme, setDisplayedTheme] = useState(theme);
  const transitionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme !== displayedTheme) {
      setIsTransitioning(true);
      
      // Update position to the toggle button's location
      const toggle = document.querySelector('[aria-label="Toggle theme"]');
      if (toggle) {
        const rect = toggle.getBoundingClientRect();
        setPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        });
      }
      
      // After animation completes, update the displayed theme
      const timer = setTimeout(() => {
        setDisplayedTheme(theme);
        setIsTransitioning(false);
      }, 1000); // Extended for elegant feel
      
      return () => clearTimeout(timer);
    }
  }, [theme, displayedTheme]);

  const nextBgColor = theme === 'dark' 
    ? 'hsl(222.2, 84%, 4.9%)'  // Dark background
    : 'hsl(0, 0%, 100%)';     // Light background

  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          ref={transitionRef}
          className="fixed inset-0 z-50 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
        >
          {/* Elegant soft vignette fade - subtle darkening/lightening at edges */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 0.8,
              ease: "easeInOut"
            }}
            style={{
              background: theme === 'dark'
                ? 'radial-gradient(ellipse at center, rgba(0,0,0,0), rgba(0,0,0,0.15) 100%)'
                : 'radial-gradient(ellipse at center, rgba(255,255,255,0), rgba(0,0,0,0.08) 100%)',
            }}
          />

          {/* Smooth color wash from toggle position */}
          <motion.div
            className="absolute inset-0"
            initial={{ 
              clipPath: `circle(0px at ${position.x}px ${position.y}px)`,
              opacity: 0
            }}
            animate={{ 
              clipPath: `circle(100vmax at ${position.x}px ${position.y}px)`,
              opacity: 1
            }}
            transition={{ 
              duration: 0.9,
              ease: [0.25, 0.46, 0.45, 0.94] // Smooth easeInOutQuad
            }}
            style={{
              backgroundColor: nextBgColor,
            }}
          />

          {/* Delicate luminous glow that expands and fades */}
          <motion.div
            className="absolute inset-0"
            initial={{ 
              clipPath: `circle(0px at ${position.x}px ${position.y}px)`,
              opacity: 0
            }}
            animate={{ 
              clipPath: `circle(100vmax at ${position.x}px ${position.y}px)`,
              opacity: [0, 0.15, 0]
            }}
            transition={{ 
              duration: 0.95,
              ease: [0.25, 0.46, 0.45, 0.94],
              opacity: { 
                duration: 0.8,
                times: [0, 0.5, 1],
                ease: "easeInOut"
              }
            }}
            style={{
              background: theme === 'dark'
                ? 'radial-gradient(circle at center, rgba(255,255,255,0.2), transparent 60%)'
                : 'radial-gradient(circle at center, rgba(0,0,0,0.1), transparent 60%)',
            }}
          />

          {/* Subtle shimmer accent for premium feel */}
          <motion.div
            className="absolute inset-0"
            initial={{ 
              clipPath: `circle(0px at ${position.x}px ${position.y}px)`,
              opacity: 0
            }}
            animate={{ 
              clipPath: `circle(100vmax at ${position.x}px ${position.y}px)`,
              opacity: [0, 0.08, 0]
            }}
            transition={{ 
              duration: 1,
              ease: [0.25, 0.46, 0.45, 0.94],
              opacity: { 
                duration: 0.7,
                delay: 0.15,
                ease: "easeInOut"
              }
            }}
            style={{
              background: theme === 'dark'
                ? 'radial-gradient(circle at center, rgba(255,255,255,0.08), transparent 70%)'
                : 'radial-gradient(circle at center, rgba(0,0,0,0.04), transparent 70%)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}