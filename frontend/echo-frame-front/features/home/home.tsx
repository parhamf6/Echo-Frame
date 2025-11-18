'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/app-navbar'
import Prism from '@/components/background/prism'
import Hero from './components/hero'
export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      {/* <Features />
      <About />
      <Footer /> */}
    </div>
  )
}
