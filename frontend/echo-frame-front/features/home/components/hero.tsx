"use client";

import React, { useState, useEffect } from 'react';
import { Play, Users, Video, MessageSquare, Mic, Github, LogIn, Link2, Sparkles, Radio, Clock, Shield } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import BentoGrid from './bento-features';
import { SliderHeroText } from './slider-text';
import { AnimatedGradient } from '@/components/animated-gradient';

export default function Hero() {
  const [activeRooms, setActiveRooms] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [hoursWatched, setHoursWatched] = useState(0);
  const [roomCode, setRoomCode] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const { scrollY } = useScroll();
  
  // Transform values for scroll animations - CTA section only
  const ctaScale = useTransform(scrollY, [700, 1000], [0.8, 1]);
  const ctaY = useTransform(scrollY, [700, 1000], [50, 0]);

  useEffect(() => {
    setIsVisible(true);
    const animateCount = (target: number, setter: (val: number) => void, duration: number) => {
      let start = 0;
      const increment = target / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
          setter(target);
          clearInterval(timer);
        } else {
          setter(Math.floor(start));
        }
      }, 16);
    };

    animateCount(12, setActiveRooms, 1000);
    animateCount(47, setTotalUsers, 1200);
    animateCount(1284, setHoursWatched, 1500);
  }, []);

  const handleJoinRoom = () => {
    if (roomCode.trim()) {
      window.location.href = `/room/${roomCode}`;
    }
  };

  const features = [
    { icon: Video, title: "Smooth Streaming", desc: "Netflix-quality HLS streaming" },
    { icon: Users, title: "Watch Together", desc: "Up to 100 people per room" },
    { icon: MessageSquare, title: "Live Chat", desc: "Reactions & message history" },
    { icon: Mic, title: "Voice Chat", desc: "Crystal clear WebRTC audio" },
    { icon: Shield, title: "Self-Hosted", desc: "Your data, your control" },
    { icon: Github, title: "Open Source", desc: "Free & community-driven" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <div className="min-h-screen bg-background text-foreground mt-20">
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        <motion.section 
          className="text-center mb-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.3 }}
          variants={containerVariants}
        >
          <motion.div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-pulse-soft"
            variants={itemVariants}
          >
            <Radio className="w-4 h-4 text-primary animate-ping-slow" />
            <span className="text-sm font-medium text-primary">Live & Self-Hosted</span>
          </motion.div>

          <motion.h2 
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-foreground"
            variants={itemVariants}
          >
            Movie night — <span><SliderHeroText/></span>
          </motion.h2>

          <motion.p 
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed flex flex-col gap-2"
            variants={itemVariants}
          >
            <span>Self-hosted watch party platform with real-time video sync, voice chat, and live messaging. </span>
            <span className='font-medium text-foreground text-xl sm:text-2xl font-display'>
              Privacy-first, Open Source ,built for communities.
            </span>
          </motion.p>

          <motion.div 
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            variants={itemVariants}
          >
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {/* <div className="relative group">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter room code..."
                  className="relative w-full sm:w-64 px-6 py-3.5 rounded-lg bg-card border border-border shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-md outline-none transition-all duration-300 placeholder:text-muted-foreground"
                  maxLength={8}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                />
              </div> */}
              <button
                onClick={handleJoinRoom}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 group"
              >
                <Link2 className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                Join Room
              </button>
              
            </div>
            
          </motion.div>
        </motion.section>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.2 }}
          variants={containerVariants}
        >
          <BentoGrid/>
        </motion.div>

        <motion.section 
          style={{ scale: ctaScale, y: ctaY, pointerEvents: 'auto' }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 1 }}
          className={`transition-all duration-1000 delay-800 mt-10`}
        >
          <div className="relative overflow-hidden rounded-3xl shadow-2xl border">
            {/* <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]"></div> */}
            <AnimatedGradient 
              variant="mesh" 
              colors={['accent']} 
              speed="normal" 
            />
            <div className="relative p-12 text-center z-10">
              <h3 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
                Ready to host your own
                <span className="text-primary"> watch parties?</span>
              </h3>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-8 text-lg">
                Self-host Echo Room on your server. Free, open source, and privacy-focused.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="https://github.com/parhamf6/Echo-Frame"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-8 py-4 rounded-xl bg-foreground text-background font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 group relative z-20"
                >
                  <Github className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                  View on GitHub
                </a>
                <a
                  href="/learn"
                  className="flex items-center gap-2 px-8 py-4 rounded-xl bg-card border border-border shadow-md hover:shadow-lg hover:border-primary/30 font-medium hover:scale-105 transition-all duration-300 relative z-20"
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}