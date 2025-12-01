'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Server, Users, Video, MessageSquare, Database, Wifi } from 'lucide-react';

export default function ArchitectureDiagramFramer() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  return (
    <div className="w-full py-12 sm:py-20">
      <div className="max-w-7xl mx-auto px-4">
        {/* Title */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            How It Works
          </h3>
          <p className="text-muted-foreground">Self-hosted architecture for complete control</p>
        </motion.div>

        {/* Desktop: Horizontal Layout */}
        <div className="hidden lg:block">
          <svg viewBox="0 0 1200 500" className="w-full h-auto">
            <defs>
              {/* Gradients */}
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Connection Lines */}
            {/* Nginx to Server */}
            <motion.path
              d="M 250 180 L 500 250"
              stroke="url(#grad1)"
              strokeWidth="3"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.5 }}
            />
            
            {/* LiveKit to Server */}
            <motion.path
              d="M 250 320 L 500 250"
              stroke="url(#grad2)"
              strokeWidth="3"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.7 }}
            />

            {/* Server to Users - Video Stream (top line) */}
            <motion.path
              d="M 700 250 L 950 180"
              stroke="url(#grad3)"
              strokeWidth="3"
              fill="none"
              strokeDasharray="8,4"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.9 }}
            />

            {/* Server to Users - Chat/Voice (bottom line) */}
            <motion.path
              d="M 700 250 L 950 320"
              stroke="url(#grad4)"
              strokeWidth="3"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 1.1 }}
            />

            {/* Animated particles on lines */}
            {[...Array(3)].map((_, i) => (
              <motion.circle
                key={`p1-${i}`}
                r="4"
                fill="currentColor"
                className="text-primary"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 2,
                  delay: 1.5 + i * 0.6,
                  repeat: Infinity,
                  repeatDelay: 0.2,
                }}
              >
                <animateMotion
                  dur="2s"
                  repeatCount="indefinite"
                  begin={`${1.5 + i * 0.6}s`}
                  path="M 250 180 L 500 250"
                />
              </motion.circle>
            ))}

            {[...Array(3)].map((_, i) => (
              <motion.circle
                key={`p2-${i}`}
                r="4"
                fill="currentColor"
                className="text-accent"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 2,
                  delay: 1.7 + i * 0.6,
                  repeat: Infinity,
                  repeatDelay: 0.2,
                }}
              >
                <animateMotion
                  dur="2s"
                  repeatCount="indefinite"
                  begin={`${1.7 + i * 0.6}s`}
                  path="M 250 320 L 500 250"
                />
              </motion.circle>
            ))}

            {[...Array(4)].map((_, i) => (
              <motion.circle
                key={`p3-${i}`}
                r="4"
                fill="currentColor"
                className="text-primary"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 2,
                  delay: 1.9 + i * 0.5,
                  repeat: Infinity,
                  repeatDelay: 0.2,
                }}
              >
                <animateMotion
                  dur="2s"
                  repeatCount="indefinite"
                  begin={`${1.9 + i * 0.5}s`}
                  path="M 700 250 L 950 180"
                />
              </motion.circle>
            ))}

            {[...Array(4)].map((_, i) => (
              <motion.circle
                key={`p4-${i}`}
                r="4"
                fill="currentColor"
                className="text-accent"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 2,
                  delay: 2.1 + i * 0.5,
                  repeat: Infinity,
                  repeatDelay: 0.2,
                }}
              >
                <animateMotion
                  dur="2s"
                  repeatCount="indefinite"
                  begin={`${2.1 + i * 0.5}s`}
                  path="M 700 250 L 950 320"
                />
              </motion.circle>
            ))}

            {/* LEFT SIDE: Nginx & LiveKit */}
            <g>
              {/* Nginx Node */}
              <motion.g
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                onHoverStart={() => setHoveredNode('nginx')}
                onHoverEnd={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                <motion.rect
                  x="50"
                  y="130"
                  width="200"
                  height="100"
                  rx="16"
                  className="fill-card stroke-border"
                  strokeWidth="2"
                  whileHover={{ scale: 1.05 }}
                  animate={hoveredNode === 'nginx' ? { scale: 1.05 } : {}}
                />
                <foreignObject x="50" y="130" width="200" height="100">
                  <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
                    <Database className="w-8 h-8 text-primary" />
                    <span className="font-bold text-sm text-foreground">Nginx</span>
                    <span className="text-xs text-muted-foreground text-center">Video Proxy</span>
                  </div>
                </foreignObject>
              </motion.g>

              {/* LiveKit Node */}
              <motion.g
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                onHoverStart={() => setHoveredNode('livekit')}
                onHoverEnd={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                <motion.rect
                  x="50"
                  y="270"
                  width="200"
                  height="100"
                  rx="16"
                  className="fill-card stroke-border"
                  strokeWidth="2"
                  whileHover={{ scale: 1.05 }}
                  animate={hoveredNode === 'livekit' ? { scale: 1.05 } : {}}
                />
                <foreignObject x="50" y="270" width="200" height="100">
                  <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
                    <Wifi className="w-8 h-8 text-accent" />
                    <span className="font-bold text-sm text-foreground">LiveKit</span>
                    <span className="text-xs text-muted-foreground text-center">WebRTC Server</span>
                  </div>
                </foreignObject>
              </motion.g>
            </g>

            {/* CENTER: Server */}
            <motion.g
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
              onHoverStart={() => setHoveredNode('server')}
              onHoverEnd={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              <motion.circle
                cx="600"
                cy="250"
                r="80"
                className="fill-card stroke-primary"
                strokeWidth="3"
                whileHover={{ scale: 1.1 }}
                animate={hoveredNode === 'server' ? { 
                  scale: 1.1,
                  boxShadow: "0 0 20px var(--primary)"
                } : {}}
              />
              <motion.circle
                cx="600"
                cy="250"
                r="70"
                className="fill-primary/10"
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0.6, 0.3]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <foreignObject x="520" y="190" width="160" height="120">
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Server className="w-12 h-12 text-primary" />
                  <span className="font-bold text-foreground">EchoFrame</span>
                  <span className="text-xs text-muted-foreground">Server</span>
                </div>
              </foreignObject>
            </motion.g>

            {/* RIGHT SIDE: Users */}
            <motion.g
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.7 }}
              onHoverStart={() => setHoveredNode('users')}
              onHoverEnd={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              <motion.rect
                x="950"
                y="130"
                width="200"
                height="240"
                rx="16"
                className="fill-card stroke-border"
                strokeWidth="2"
                whileHover={{ scale: 1.05 }}
                animate={hoveredNode === 'users' ? { scale: 1.05 } : {}}
              />
              <foreignObject x="950" y="130" width="200" height="240">
                <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
                  <Users className="w-10 h-10 text-primary" />
                  <span className="font-bold text-foreground">Watch Party</span>
                  
                  <div className="w-full space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Video className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">HLS Video Stream</span>
                    </div>
                    <div className="h-px bg-border w-full" />
                    <div className="flex items-center gap-2 text-xs">
                      <MessageSquare className="w-4 h-4 text-accent" />
                      <span className="text-muted-foreground">Live Chat</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Wifi className="w-4 h-4 text-accent" />
                      <span className="text-muted-foreground">Voice Chat</span>
                    </div>
                  </div>
                </div>
              </foreignObject>
            </motion.g>

            {/* Labels on connections */}
            <motion.text
              x="375"
              y="210"
              className="text-xs fill-primary font-medium"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.2 }}
            >
              Video Upload
            </motion.text>
            
            <motion.text
              x="375"
              y="290"
              className="text-xs fill-accent font-medium"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.4 }}
            >
              WebRTC
            </motion.text>

            <motion.text
              x="825"
              y="210"
              className="text-xs fill-primary font-medium"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.6 }}
            >
              Streaming
            </motion.text>

            <motion.text
              x="825"
              y="290"
              className="text-xs fill-accent font-medium"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.8 }}
            >
              Chat & Voice
            </motion.text>
          </svg>
        </div>

        {/* Mobile: Vertical Layout */}
        <div className="lg:hidden">
          <svg viewBox="0 0 400 1000" className="w-full h-auto max-w-md mx-auto">
            <defs>
              <linearGradient id="gradV1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="gradV2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Vertical Connection Lines */}
            <motion.path
              d="M 120 150 L 200 280"
              stroke="url(#gradV1)"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            />
            
            <motion.path
              d="M 280 150 L 200 280"
              stroke="url(#gradV2)"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            />

            <motion.path
              d="M 200 400 L 120 520"
              stroke="url(#gradV1)"
              strokeWidth="2"
              fill="none"
              strokeDasharray="4,4"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
            />

            <motion.path
              d="M 200 400 L 280 520"
              stroke="url(#gradV2)"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.6 }}
            />

            {/* Nginx */}
            <motion.g
              initial={{ opacity: 0, y: -30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <rect x="40" y="50" width="140" height="100" rx="12" className="fill-card stroke-border" strokeWidth="2" />
              <foreignObject x="40" y="50" width="140" height="100">
                <div className="flex flex-col items-center justify-center h-full gap-1">
                  <Database className="w-6 h-6 text-primary" />
                  <span className="font-bold text-xs">Nginx</span>
                  <span className="text-[10px] text-muted-foreground">Video Proxy</span>
                </div>
              </foreignObject>
            </motion.g>

            {/* LiveKit */}
            <motion.g
              initial={{ opacity: 0, y: -30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <rect x="220" y="50" width="140" height="100" rx="12" className="fill-card stroke-border" strokeWidth="2" />
              <foreignObject x="220" y="50" width="140" height="100">
                <div className="flex flex-col items-center justify-center h-full gap-1">
                  <Wifi className="w-6 h-6 text-accent" />
                  <span className="font-bold text-xs">LiveKit</span>
                  <span className="text-[10px] text-muted-foreground">WebRTC</span>
                </div>
              </foreignObject>
            </motion.g>

            {/* Server */}
            <motion.g
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              <circle cx="200" cy="340" r="60" className="fill-card stroke-primary" strokeWidth="2" />
              <circle cx="200" cy="340" r="50" className="fill-primary/10" />
              <foreignObject x="140" y="300" width="120" height="80">
                <div className="flex flex-col items-center justify-center h-full gap-1">
                  <Server className="w-8 h-8 text-primary" />
                  <span className="font-bold text-xs">EchoFrame</span>
                </div>
              </foreignObject>
            </motion.g>

            {/* Users */}
            <motion.g
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              <rect x="50" y="570" width="300" height="180" rx="12" className="fill-card stroke-border" strokeWidth="2" />
              <foreignObject x="50" y="570" width="300" height="180">
                <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
                  <Users className="w-8 h-8 text-primary" />
                  <span className="font-bold text-sm">Watch Party</span>
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-2 text-[10px]">
                      <Video className="w-3 h-3 text-primary" />
                      <span className="text-muted-foreground">Video Stream</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <MessageSquare className="w-3 h-3 text-accent" />
                      <span className="text-muted-foreground">Chat</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <Wifi className="w-3 h-3 text-accent" />
                      <span className="text-muted-foreground">Voice</span>
                    </div>
                  </div>
                </div>
              </foreignObject>
            </motion.g>
          </svg>
        </div>
      </div>
    </div>
  );
}