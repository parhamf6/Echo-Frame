'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Github, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => setMounted(true), [])

  const navItems = [
    { label: 'Home', href: '#' },
    { label: 'Docs', href: '#' },
    { label: 'Admin', href: '#' },
    { label: 'Room', href: '#' },
  ]

  const menuVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.05, duration: 0.3 } },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  }

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            EchoFrmae
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-foreground/70 hover:text-foreground transition-colors duration-200 text-sm font-medium relative group"
              >
                {item.label}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
              </Link>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-secondary rounded-lg transition-colors duration-200"
            >
              <Github className="w-5 h-5" />
            </a>

            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-2 hover:bg-secondary rounded-lg transition-colors duration-200"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 hover:bg-secondary rounded-lg transition-colors duration-200"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={menuVariants}
              className="md:hidden pb-4 space-y-2 overflow-hidden"
            >
              {navItems.map((item) => (
                <motion.div key={item.label} variants={itemVariants}>
                  <Link
                    href={item.href}
                    className="block px-4 py-2 text-foreground/70 hover:text-foreground hover:bg-secondary rounded-lg transition-colors duration-200"
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  )
}
