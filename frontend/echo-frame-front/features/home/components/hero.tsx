"use client";

import React, { useState, useEffect } from 'react';
import { Play, Users, Video, MessageSquare, Mic, Github, LogIn, Link2, Sparkles, Radio, Clock, Shield } from 'lucide-react';
import BentoGrid from './bento-features';
import { SliderHeroText } from './slider-text';
import { AnimatedGradient } from '@/components/animated-gradient';

export default function Hero() {
  const [activeRooms, setActiveRooms] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [hoursWatched, setHoursWatched] = useState(0);
  const [roomCode, setRoomCode] = useState('');
  const [isVisible, setIsVisible] = useState(false);

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
    { icon: Users, title: "Watch Together", desc: "Up to 20 people per room" },
    { icon: MessageSquare, title: "Live Chat", desc: "Reactions & message history" },
    { icon: Mic, title: "Voice Chat", desc: "Crystal clear WebRTC audio" },
    { icon: Shield, title: "Self-Hosted", desc: "Your data, your control" },
    { icon: Github, title: "Open Source", desc: "Free & community-driven" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground mt-20">
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        <section className={`text-center mb-20 transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-pulse-soft">
            <Radio className="w-4 h-4 text-primary animate-ping-slow" />
            <span className="text-sm font-medium text-primary">Live & Self-Hosted</span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-foreground">
            Movie night — <span><SliderHeroText/></span>
          </h2>
          

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
            Self-hosted watch party platform with real-time video sync, voice chat, and live messaging. 
            <span className="text-foreground font-medium"> Privacy-first, open source, built for communities.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative group">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter room code..."
                  className="relative w-full sm:w-64 px-6 py-3.5 rounded-lg bg-card border border-border shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-md outline-none transition-all duration-300 placeholder:text-muted-foreground"
                  maxLength={8}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                />
              </div>
              <button
                onClick={handleJoinRoom}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 group"
              >
                <Link2 className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                Join Room
              </button>
            </div>
          </div>

          {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { label: "Active Rooms", value: activeRooms, icon: Video },
              { label: "Users Online", value: totalUsers, icon: Users },
              { label: "Hours Watched", value: hoursWatched, icon: Clock },
            ].map((stat, idx) => (
              <div
                key={stat.label}
                className="relative group"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="p-6 rounded-2xl bg-card border border-border shadow-md hover:shadow-xl hover:border-primary/30 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center justify-center mb-3">
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/15 transition-colors duration-300">
                      <stat.icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold mb-1 text-foreground">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div> */}
        </section>
        <BentoGrid/>
        <section className={`transition-all duration-1000 delay-800 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} mt-10`}>
          <div className="relative overflow-hidden rounded-3xl border border-border shadow-xl">
            {/* <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]"></div> */}
            <AnimatedGradient 
              variant="mesh" 
              colors={['accent-2']} 
              speed="normal" 
            />
            <div className="p-12 text-center">
              <h3 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
                Ready to host your own
                <span className="text-primary"> watch parties?</span>
              </h3>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-8 text-lg">
                Self-host Echo Room on your server. Free, open source, and privacy-focused.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="https://github.com/yourusername/echo-room"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-8 py-4 rounded-xl bg-foreground text-background font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 group"
                >
                  <Github className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                  View on GitHub
                </a>
                <a
                  href="/docs"
                  className="flex items-center gap-2 px-8 py-4 rounded-xl bg-card border border-border shadow-md hover:shadow-lg hover:border-primary/30 font-medium hover:scale-105 transition-all duration-300"
                >
                  Read Docs
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}