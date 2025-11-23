'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Github, Menu, X, Home, BookOpen, Shield, DoorOpen , LogIn } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { ThemeToggleSlider } from './theme-toggle';

const GlassmorphicNavbar = () => {
  const [isDark, setIsDark] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState('Home');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const navLinks = [
    { name: 'Home', icon: Home, href: '/home' },
    { name: 'Learn', icon: BookOpen, href: '/learn' },
    { name: 'Admin', icon: Shield, href: '/admin' },
    { name: 'Room', icon: DoorOpen, href: '/room' },
  ];

  const glassStyle = `backdrop-blur-xl bg-background/30 border border-border/40 shadow-lg`;
  
  const islandVariants = {
    hidden: { y: -100, opacity: 0 },
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      transition: {
        delay: i * 0.1,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      },
    }),
  };

  const menuVariants = {
    closed: {
      x: '100%',
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 40,
      },
    },
    open: {
      x: 0,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 40,
      },
    },
  };

  const menuItemVariants = {
    closed: { x: 50, opacity: 0 },
    open: (i: number) => ({
      x: 0,
      opacity: 1,
      transition: {
        delay: i * 0.1,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      },
    }),
  };

  const iconVariants = {
    initial: { scale: 1, rotate: 0 },
    hover: { 
      scale: 1.2, 
      rotate: [0, -10, 10, -10, 0],
      transition: { 
        rotate: {
          duration: 0.5,
          ease: "easeInOut"
        },
        scale: {
          duration: 0.2
        }
      }
    },
    tap: { scale: 0.9 }
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:block fixed top-0 left-0 right-0 z-50 px-6 pt-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between gap-4">
            {/* Left Island - Project Name */}
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={islandVariants}
              className={`${glassStyle} rounded-2xl px-6 py-4 group hover:bg-background/40 transition-all duration-300 cursor-pointer`}
            >
              <a className='text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient-text'>EchoFrame</a>
            </motion.div>
            {/* <div className="flex items-center gap-3 group cursor-pointer">
                          <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-all duration-300" />
                            <div className="relative bg-primary/10 p-2.5 rounded-xl border border-primary/20 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                              <Play className="w-6 h-6 text-primary fill-primary" />
                            </div>
                          </div>
                          <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient-text">
                              Echo Room
                            </h1>
                            <p className="text-xs text-muted-foreground">Watch Together, Anywhere</p>
                          </div>
                        </div> */}
            

            {/* Center Island - Navigation Links */}
            <motion.div
              custom={1}
              initial="hidden"
              animate="visible"
              variants={islandVariants}
              className={`${glassStyle} rounded-2xl px-2 py-2 flex items-center gap-1 relative`}
            >
              {navLinks.map((link, index) => {
                const isActive = activeLink === link.name;
                return (
                  <motion.a
                    key={link.name}
                    href={link.href}
                    onClick={() => setActiveLink(link.name)}
                    className="relative px-5 py-3 rounded-xl text-foreground/80 hover:text-foreground transition-colors duration-200 flex items-center gap-2 group overflow-hidden"
                    initial="initial"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-xl"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-xl opacity-0 group-hover:opacity-100"
                      transition={{ duration: 0.3 }}
                    />
                    
                    <motion.div
                      variants={iconVariants}
                      className="relative z-10"
                    >
                      <link.icon className={`w-4 h-4 transition-colors duration-200 ${isActive ? 'text-primary' : ''}`} />
                    </motion.div>
                    
                    <motion.span 
                      className={`font-medium relative z-10 transition-colors duration-200 ${isActive ? 'text-primary' : ''}`}
                      animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      {link.name}
                    </motion.span>

                    {isActive && (
                      <motion.div
                        className="absolute bottom-1 left-1/2 w-1 h-1 bg-primary rounded-full"
                        layoutId="indicator"
                        initial={{ x: '-50%', scale: 0 }}
                        animate={{ x: '-50%', scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </motion.a>
                );
              })}
            </motion.div>

            {/* Right Island - Theme & GitHub */}
            <motion.div
              custom={2}
              initial="hidden"
              animate="visible"
              variants={islandVariants}
              className={`${glassStyle} rounded-2xl px-2 py-2 flex items-center gap-2`}
            >
              {/* <motion.button
                onClick={() => setIsDark(!isDark)}
                className="relative p-3 rounded-xl hover:bg-accent/20 transition-colors duration-200 overflow-hidden group"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl opacity-0 group-hover:opacity-100"
                  transition={{ duration: 0.3 }}
                />
                <AnimatePresence mode="wait">
                  {isDark ? (
                    <motion.div
                      key="moon"
                      initial={{ rotate: -90, scale: 0, opacity: 0 }}
                      animate={{ rotate: 0, scale: 1, opacity: 1 }}
                      exit={{ rotate: 90, scale: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <Moon className="w-5 h-5 text-foreground relative z-10" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="sun"
                      initial={{ rotate: 90, scale: 0, opacity: 0 }}
                      animate={{ rotate: 0, scale: 1, opacity: 1 }}
                      exit={{ rotate: -90, scale: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <Sun className="w-5 h-5 text-foreground relative z-10" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button> */}
              {/* <ThemeToggle /> */}
              <ThemeToggleSlider />

              <motion.a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="relative p-3 rounded-xl hover:bg-accent/20 transition-colors duration-200 overflow-hidden group"
                whileHover={{ scale: 1.1, rotate: [0, -5, 5, -5, 0] }}
                whileTap={{ scale: 0.9 }}
                transition={{ rotate: { duration: 0.5 } }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl opacity-0 group-hover:opacity-100"
                  transition={{ duration: 0.3 }}
                />
                <Github className="w-5 h-5 text-foreground relative z-10" />
              </motion.a>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-50 p-4">
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`${glassStyle} rounded-2xl px-4 py-3 flex items-center justify-between`}
        >
          <motion.h1 
            className="text-xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_auto]"
            animate={{
              backgroundPosition: ['0%', '100%', '0%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            ProjectName
          </motion.h1>

          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg hover:bg-accent/20 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <AnimatePresence mode="wait">
                {isDark ? (
                  <motion.div
                    key="moon"
                    initial={{ rotate: -90, scale: 0, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    exit={{ rotate: 90, scale: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Moon className="w-5 h-5 text-foreground" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="sun"
                    initial={{ rotate: 90, scale: 0, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    exit={{ rotate: -90, scale: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Sun className="w-5 h-5 text-foreground" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            <motion.button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg hover:bg-accent/20 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <AnimatePresence mode="wait">
                {isMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                  >
                    <X className="w-6 h-6 text-foreground" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                  >
                    <Menu className="w-6 h-6 text-foreground" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div
              variants={menuVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className={`lg:hidden fixed top-[88px] right-4 bottom-4 w-72 ${glassStyle} rounded-2xl p-6 z-50 overflow-y-auto`}
            >
              <div className="flex flex-col gap-2">
                {navLinks.map((link, index) => {
                  const isActive = activeLink === link.name;
                  return (
                    <motion.a
                      key={link.name}
                      custom={index}
                      variants={menuItemVariants}
                      href={link.href}
                      onClick={() => {
                        setActiveLink(link.name);
                        setIsMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 px-4 py-4 rounded-xl transition-colors group relative overflow-hidden ${
                        isActive ? 'bg-primary/20' : 'hover:bg-primary/10'
                      }`}
                      whileHover={{ x: 8, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20"
                          layoutId="mobileActiveTab"
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                      
                      <motion.div
                        whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.2 }}
                        transition={{ duration: 0.5 }}
                        className="relative z-10"
                      >
                        <link.icon className={`w-5 h-5 transition-colors ${
                          isActive ? 'text-primary' : 'text-primary group-hover:text-accent'
                        }`} />
                      </motion.div>
                      
                      <span className={`font-medium text-lg relative z-10 ${
                        isActive ? 'text-primary' : 'text-foreground'
                      }`}>
                        {link.name}
                      </span>

                      {isActive && (
                        <motion.div
                          className="absolute right-4 w-2 h-2 bg-primary rounded-full"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                    </motion.a>
                  );
                })}
                
                <motion.div
                  custom={navLinks.length}
                  variants={menuItemVariants}
                  className="mt-6 pt-6 border-t border-border/40"
                >
                  <motion.a
                    href="https://github.com/parhamf6/Echo-Frame"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-4 rounded-xl hover:bg-primary/10 transition-colors group"
                    whileHover={{ x: 8, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div
                      whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.2 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Github className="w-5 h-5 text-primary group-hover:text-accent transition-colors" />
                    </motion.div>
                    <span className="font-medium text-foreground text-lg">View on GitHub</span>
                  </motion.a>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlassmorphicNavbar;