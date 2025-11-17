'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check localStorage
    const stored = localStorage.getItem('theme') as Theme | null
    
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    const initialTheme = stored || (prefersDark ? 'dark' : 'light')
    setTheme(initialTheme)
    
    // Apply theme
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return { theme: mounted ? theme : 'dark', toggleTheme, mounted }
}
