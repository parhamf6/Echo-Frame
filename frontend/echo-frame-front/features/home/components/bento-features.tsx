"use client";

import { Video, Users, MessageSquare, Mic, Shield, Zap, Play, Clock, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BentoGrid() {
  const cards = [
    {
      id: 1,
      title: "Smooth Streaming",
      description: "Netflix-quality HLS video streaming with adaptive bitrate for seamless playback",
      icon: Video,
      gradient: "from-primary/20 to-primary/5",
      size: "large", // Takes 2 columns
    },
    {
      id: 2,
      title: "Real-Time Sync",
      description: "Watch together with perfect video synchronization across all devices",
      icon: Zap,
      gradient: "from-accent/20 to-accent/5",
      size: "medium",
    },
    {
      id: 3,
      title: "Voice Chat",
      description: "Crystal clear WebRTC voice communication",
      icon: Mic,
      gradient: "from-primary/15 to-primary/5",
      size: "small",
    },
    {
      id: 4,
      title: "Live Chat",
      description: "Message history, reactions, and typing indicators",
      icon: MessageSquare,
      gradient: "from-accent/15 to-accent/5",
      size: "small",
    },
    {
      id: 5,
      title: "Self-Hosted",
      description: "Full control over your data and privacy. Deploy on your own server",
      icon: Shield,
      gradient: "from-primary/20 to-primary/5",
      size: "medium",
    },
    {
      id: 6,
      title: "Up to 100 Users",
      description: "Watch together with friends and family",
      icon: Users,
      gradient: "from-accent/20 to-accent/5",
      size: "large",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.34, 1.56, 0.64, 1],
      },
    },
  };

  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-7xl mx-auto "
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Card 1 - Large (spans 2 columns) */}
      <motion.div
        variants={itemVariants}
        className="md:col-span-2 row-span-1"
      >
        <div className="group relative h-full min-h-[280px] rounded-3xl bg-card border border-border shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${cards[0].gradient} opacity-50 group-hover:opacity-70 transition-opacity duration-500`} />
          
          <div className="relative h-full p-8 flex flex-col justify-between">
            <div>
              <div className="inline-flex p-3 rounded-2xl bg-primary/10 border border-primary/20 mb-4 group-hover:scale-110 transition-transform duration-300">
                {(() => {
                  const Icon = cards[0].icon;
                  return <Icon className="w-8 h-8 text-primary" />;
                })()}
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-3">{cards[0].title}</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">{cards[0].description}</p>
            </div>
            
            {/* Decorative element */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Play className="w-4 h-4" />
              <span>1080p • 720p • 480p • 360p</span>
            </div>
          </div>

          {/* Hover effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </div>
      </motion.div>

      {/* Card 2 - Medium */}
      <motion.div
        variants={itemVariants}
        className="md:col-span-1 row-span-1"
      >
        <div className="group relative h-full min-h-[280px] rounded-3xl bg-card border border-border shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${cards[1].gradient} opacity-50 group-hover:opacity-70 transition-opacity duration-500`} />
          
          <div className="relative h-full p-6 flex flex-col justify-between">
            <div>
              <div className="inline-flex p-3 rounded-2xl bg-accent/10 border border-accent/20 mb-4 group-hover:scale-110 transition-transform duration-300">
                {(() => {
                  const Icon = cards[1].icon;
                  return <Icon className="w-7 h-7 text-accent-foreground" />;
                })()}
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">{cards[1].title}</h3>
              <p className="text-muted-foreground leading-relaxed">{cards[1].description}</p>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Real-time</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Card 3 - Small */}
      <motion.div
        variants={itemVariants}
        className="md:col-span-1 row-span-1"
      >
        <div className="group relative h-full min-h-[280px] rounded-3xl bg-card border border-border shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${cards[2].gradient} opacity-50 group-hover:opacity-70 transition-opacity duration-500`} />
          
          <div className="relative h-full p-6 flex flex-col justify-between">
            <div>
              <div className="inline-flex p-3 rounded-2xl bg-primary/10 border border-primary/20 mb-4 group-hover:scale-110 transition-transform duration-300">
                {(() => {
                  const Icon = cards[2].icon;
                  return <Icon className="w-7 h-7 text-primary" />;
                })()}
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">{cards[2].title}</h3>
              <p className="text-muted-foreground leading-relaxed">{cards[2].description}</p>
            </div>

            <div className="w-full h-1 bg-primary/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: "0%" }}
                whileInView={{ width: "80%" }}
                transition={{ duration: 1, delay: 0.5 }}
                viewport={{ once: true }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Card 4 - Small */}
      <motion.div
        variants={itemVariants}
        className="md:col-span-1 row-span-1"
      >
        <div className="group relative h-full min-h-[280px] rounded-3xl bg-card border border-border shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${cards[3].gradient} opacity-50 group-hover:opacity-70 transition-opacity duration-500`} />
          
          <div className="relative h-full p-6 flex flex-col justify-between">
            <div>
              <div className="inline-flex p-3 rounded-2xl bg-accent/10 border border-accent/20 mb-4 group-hover:scale-110 transition-transform duration-300">
                {(() => {
                  const Icon = cards[3].icon;
                  return <Icon className="w-7 h-7 text-accent-foreground" />;
                })()}
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">{cards[3].title}</h3>
              <p className="text-muted-foreground leading-relaxed">{cards[3].description}</p>
            </div>

            {/* Chat bubbles animation */}
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-accent-foreground"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Card 5 - Medium */}
      <motion.div
        variants={itemVariants}
        className="md:col-span-1 row-span-1"
      >
        <div className="group relative h-full min-h-[280px] rounded-3xl bg-card border border-border shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${cards[4].gradient} opacity-50 group-hover:opacity-70 transition-opacity duration-500`} />
          
          <div className="relative h-full p-6 flex flex-col justify-between">
            <div>
              <div className="inline-flex p-3 rounded-2xl bg-primary/10 border border-primary/20 mb-4 group-hover:scale-110 transition-transform duration-300">
                {(() => {
                  const Icon = cards[4].icon;
                  return <Icon className="w-7 h-7 text-primary" />;
                })()}
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">{cards[4].title}</h3>
              <p className="text-muted-foreground leading-relaxed">{cards[4].description}</p>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="w-3.5 h-3.5" />
              <span>100% Private</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Card 6 - Large (spans 2 columns) */}
      <motion.div
        variants={itemVariants}
        className="md:col-span-2 row-span-1"
      >
        <div className="group relative h-full min-h-[280px] rounded-3xl bg-card border border-border shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${cards[5].gradient} opacity-50 group-hover:opacity-70 transition-opacity duration-500`} />
          
          <div className="relative h-full p-8 flex flex-col justify-between">
            <div>
              <div className="inline-flex p-3 rounded-2xl bg-accent/10 border border-accent/20 mb-4 group-hover:scale-110 transition-transform duration-300">
                {(() => {
                  const Icon = cards[5].icon;
                  return <Icon className="w-8 h-8 text-accent-foreground" />;
                })()}
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-3">{cards[5].title}</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">{cards[5].description}</p>
            </div>
            
            {/* User avatars */}
            <div className="flex items-center gap-2">
              <div className="flex -space-x-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      className="w-10 h-10 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center"
                      initial={{ scale: 0, rotate: -180 }}
                      whileInView={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        delay: i * 0.1,
                        type: "spring",
                        stiffness: 200,
                      }}
                      viewport={{ once: true }}
                    >
                      <Users className="w-5 h-5 text-primary" />
                    </motion.div>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground ml-2">+195 more</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}