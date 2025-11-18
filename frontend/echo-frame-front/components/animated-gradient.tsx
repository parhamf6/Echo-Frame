// src/components/AnimatedGradient.tsx
"use client";

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedGradientProps {
  variant?: 'mesh' | 'wave' | 'spotlight' | 'pulse' | 'radial' | 'beam';
  colors?: string[];
  speed?: 'slow' | 'normal' | 'fast';
  className?: string;
  children?: ReactNode;
}

export function AnimatedGradient({ 
  variant = 'mesh', 
  colors = ['primary', 'accent'],
  speed = 'normal',
  className = '',
  children 
}: AnimatedGradientProps) {
  
  const speedMap = {
    slow: 20,
    normal: 10,
    fast: 5,
  };

  const duration = speedMap[speed];

  // Mesh Gradient (multiple moving blobs)
  if (variant === 'mesh') {
    return (
      <div className={`absolute inset-0 overflow-hidden ${className}`}>
        <motion.div
          className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full blur-3xl opacity-30"
          style={{ background: `var(--${colors[0]})` }}
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-3xl opacity-30"
          style={{ background: `var(--${colors[1] || colors[0]})` }}
          animate={{
            x: [0, -80, 0],
            y: [0, -60, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: duration * 1.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-[350px] h-[350px] rounded-full blur-3xl opacity-20"
          style={{ background: `var(--${colors[0]})` }}
          animate={{
            x: [-100, 100, -100],
            y: [-50, 50, -50],
            scale: [1.1, 1, 1.1],
          }}
          transition={{
            duration: duration * 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {children}
      </div>
    );
  }

  // Wave Gradient (horizontal moving gradient)
  if (variant === 'wave') {
    return (
      <div className={`absolute inset-0 overflow-hidden ${className}`}>
        <motion.div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, 
              transparent 0%, 
              var(--${colors[0]}) 25%, 
              var(--${colors[1] || colors[0]}) 50%, 
              var(--${colors[0]}) 75%, 
              transparent 100%)`,
            opacity: 0.3,
          }}
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        {children}
      </div>
    );
  }

  // Spotlight (follows cursor effect)
  if (variant === 'spotlight') {
    return (
      <motion.div 
        className={`absolute inset-0 overflow-hidden ${className}`}
        whileHover="hover"
      >
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-3xl opacity-0"
          style={{ 
            background: `radial-gradient(circle, var(--${colors[0]}) 0%, transparent 70%)`,
          }}
          variants={{
            hover: {
              opacity: 0.4,
            }
          }}
          transition={{
            duration: 0.3,
          }}
        />
        {children}
      </motion.div>
    );
  }

  // Pulse (breathing effect)
  if (variant === 'pulse') {
    return (
      <div className={`absolute inset-0 overflow-hidden ${className}`}>
        <motion.div
          className="absolute inset-0 rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle at 50% 50%, 
              var(--${colors[0]}) 0%, 
              var(--${colors[1] || colors[0]}) 50%, 
              transparent 100%)`,
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: duration / 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {children}
      </div>
    );
  }

  // Radial (rotating gradient)
  if (variant === 'radial') {
    return (
      <div className={`absolute inset-0 overflow-hidden ${className}`}>
        <motion.div
          className="absolute inset-0"
          style={{
            background: `conic-gradient(from 0deg at 50% 50%, 
              transparent 0deg, 
              var(--${colors[0]}) 90deg, 
              var(--${colors[1] || colors[0]}) 180deg, 
              var(--${colors[0]}) 270deg, 
              transparent 360deg)`,
            opacity: 0.3,
          }}
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: duration * 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        {children}
      </div>
    );
  }

  // Beam (diagonal moving light)
  if (variant === 'beam') {
    return (
      <div className={`absolute inset-0 overflow-hidden ${className}`}>
        <motion.div
          className="absolute inset-0 opacity-40"
          style={{
            background: `linear-gradient(135deg, 
              transparent 0%, 
              var(--${colors[0]}) 45%, 
              var(--${colors[1] || colors[0]}) 50%, 
              var(--${colors[0]}) 55%, 
              transparent 100%)`,
          }}
          animate={{
            x: ['-200%', '200%'],
            y: ['-200%', '200%'],
          }}
          transition={{
            duration: duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        {children}
      </div>
    );
  }

  return null;
}


// USAGE EXAMPLES:

// Example 1: Mesh Gradient Card
export function MeshGradientCard() {
  return (
    <div className="relative h-64 rounded-3xl bg-card border border-border overflow-hidden">
      <AnimatedGradient 
        variant="mesh" 
        colors={['primary', 'accent']} 
        speed="slow" 
      />
      <div className="relative z-10 p-6">
        <h3 className="text-2xl font-bold">Mesh Gradient</h3>
        <p className="text-muted-foreground">Multiple floating blobs</p>
      </div>
    </div>
  );
}

// Example 2: Wave Gradient Card
export function WaveGradientCard() {
  return (
    <div className="relative h-64 rounded-3xl bg-card border border-border overflow-hidden">
      <AnimatedGradient 
        variant="wave" 
        colors={['primary']} 
        speed="normal" 
      />
      <div className="relative z-10 p-6">
        <h3 className="text-2xl font-bold">Wave Gradient</h3>
        <p className="text-muted-foreground">Horizontal moving wave</p>
      </div>
    </div>
  );
}

// Example 3: Spotlight (hover effect)
export function SpotlightCard() {
  return (
    <div className="relative h-64 rounded-3xl bg-card border border-border overflow-hidden group">
      <AnimatedGradient 
        variant="spotlight" 
        colors={['primary']} 
      />
      <div className="relative z-10 p-6">
        <h3 className="text-2xl font-bold">Spotlight</h3>
        <p className="text-muted-foreground">Hover to see effect</p>
      </div>
    </div>
  );
}

// Example 4: Pulse
export function PulseCard() {
  return (
    <div className="relative h-64 rounded-3xl bg-card border border-border overflow-hidden">
      <AnimatedGradient 
        variant="pulse" 
        colors={['primary', 'accent']} 
        speed="fast" 
      />
      <div className="relative z-10 p-6">
        <h3 className="text-2xl font-bold">Pulse</h3>
        <p className="text-muted-foreground">Breathing effect</p>
      </div>
    </div>
  );
}

// Example 5: Radial (rotating)
export function RadialCard() {
  return (
    <div className="relative h-64 rounded-3xl bg-card border border-border overflow-hidden">
      <AnimatedGradient 
        variant="radial" 
        colors={['primary', 'accent']} 
        speed="slow" 
      />
      <div className="relative z-10 p-6">
        <h3 className="text-2xl font-bold">Radial</h3>
        <p className="text-muted-foreground">Rotating gradient</p>
      </div>
    </div>
  );
}

// Example 6: Beam (diagonal light)
export function BeamCard() {
  return (
    <div className="relative h-64 rounded-3xl bg-card border border-border overflow-hidden">
      <AnimatedGradient 
        variant="beam" 
        colors={['primary']} 
        speed="normal" 
      />
      <div className="relative z-10 p-6">
        <h3 className="text-2xl font-bold">Beam</h3>
        <p className="text-muted-foreground">Diagonal moving light</p>
      </div>
    </div>
  );
}


// HOW TO USE IN YOUR BENTO CARDS:

/*
import { AnimatedGradient } from '@/components/AnimatedGradient';

// Replace the static gradient background with animated one:
<div className="group relative h-full min-h-[280px] rounded-3xl bg-card border border-border shadow-lg overflow-hidden">
  <AnimatedGradient 
    variant="mesh"        // Choose: mesh, wave, spotlight, pulse, radial, beam
    colors={['primary', 'accent']}  // Use your theme colors
    speed="slow"          // Choose: slow, normal, fast
  />
  
  <div className="relative z-10 p-6">
    {/* Your card content here }
  </div>
</div>
*/