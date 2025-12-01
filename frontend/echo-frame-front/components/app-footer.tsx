'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Github, BookOpen, Shield, Mail, ExternalLink, Heart } from 'lucide-react';

const Footer = () => {
  // Optional: Toggle this to disable all animations
  const enableAnimations = true;

  const itemVariants = enableAnimations
    ? {
        hidden: { opacity: 0, y: 20 },
        visible: (i: number) => ({
          opacity: 1,
          y: 0,
          transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
        }),
      }
    : undefined;

  const hoverPulse = enableAnimations
    ? {
        whileHover: { scale: 1.05 },
        whileTap: { scale: 0.95 },
      }
    : {};

  return (
    <footer className="relative mt-24 border-t border-border/40 bg-background/30 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-6 py-12">
        {/* Main Footer Content */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={enableAnimations ? { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } } : undefined}
        >
          {/* Brand */}
          <motion.div variants={itemVariants} custom={0}>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <motion.div
                  animate={
                    enableAnimations
                      ? {
                          backgroundPosition: ['0%', '100%', '0%'],
                        }
                      : {}
                  }
                  transition={
                    enableAnimations
                      ? {
                          duration: 4,
                          repeat: Infinity,
                          ease: 'linear',
                        }
                      : {}
                  }
                  className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] rounded-xl opacity-20 blur-sm"
                />
                <div className="relative text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                  Echo<span className="text-primary">Frame</span>
                </div>
              </div>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              A self-hosted, open-source platform for synchronized streaming, voice chat,
              and real-time community interaction.
            </p>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={itemVariants} custom={1}>
            <h4 className="font-semibold text-foreground mb-4">Platform</h4>
            <ul className="space-y-3">
              {[
                { name: 'Learn', href: '/learn', icon: BookOpen },
                { name: 'Admin', href: '/admin', icon: Shield },
                { name: 'GitHub', href: 'https://github.com/parhamf6/Echo-Frame', external: true, icon: Github },
              ].map((link, idx) => {
                const Icon = link.icon;
                return (
                  <motion.li key={link.name} variants={itemVariants} custom={1.1 + idx * 0.1}>
                    <motion.a
                      {...hoverPulse}
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className={`flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group`}
                    >
                      <Icon className="w-4 h-4 group-hover:text-primary transition-colors" />
                      <span>{link.name}</span>
                      {link.external && (
                        <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                      )}
                    </motion.a>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>

          {/* Community */}
          <motion.div variants={itemVariants} custom={2}>
            <h4 className="font-semibold text-foreground mb-4">Community</h4>
            <ul className="space-y-3">
              <motion.li variants={itemVariants} custom={2.1}>
                <motion.a
                  {...hoverPulse}
                  href="mailto:echoframe@example.com"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <Mail className="w-4 h-4 group-hover:text-accent transition-colors" />
                  <span>Feedback & Support</span>
                </motion.a>
              </motion.li>
              <motion.li variants={itemVariants} custom={2.2}>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="w-4 h-4" />
                  <span>Privacy-First Design</span>
                </span>
              </motion.li>
            </ul>
          </motion.div>

          {/* Decorative / Spirit */}
          <motion.div variants={itemVariants} custom={3} className="flex flex-col justify-end">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Heart className="w-4 h-4 text-destructive" />
              <span>
                Built with ❤️ for open communities
              </span>
            </div>
            <div className="mt-4 text-xs text-muted-foreground/70">
              © {new Date().getFullYear()} EchoFrame. MIT Licensed.
            </div>
          </motion.div>
        </motion.div>

        {/* Optional: Animated Divider or Bottom Accent */}
        {enableAnimations && (
          <motion.div
            className="mt-10 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        )}
      </div>
    </footer>
  );
};

export default Footer;