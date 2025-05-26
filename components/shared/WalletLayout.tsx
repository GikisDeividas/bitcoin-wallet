"use client"

import React from 'react'
import { Home, Settings, Wallet, History, ArrowUpDown, Wifi } from 'lucide-react'
import Image from 'next/image'

type PageType = 'home' | 'wallet' | 'send' | 'receive' | 'settings' | 'add-wallet' | 'pin-setup' | 'history' | 'swap'

interface WalletLayoutProps {
  children: React.ReactNode
  currentPage: PageType
  onNavigate: (page: PageType) => void
  title: string
  showBackButton?: boolean
  showBottomNav?: boolean
}

export default function WalletLayout({ 
  children, 
  currentPage, 
  onNavigate, 
  title, 
  showBackButton = false,
  showBottomNav = true 
}: WalletLayoutProps) {
  const [currentTime, setCurrentTime] = React.useState('')

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const timeString = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: false 
      })
      setCurrentTime(timeString)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-[375px] h-[812px] bg-white rounded-[2.5rem] shadow-2xl border border-gray-200 relative overflow-hidden">
        <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative flex flex-col">
          {/* iPhone Notch */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-10"></div>

          {/* iPhone Status Bar */}
          <div className="flex items-center justify-between px-6 pt-3 pb-1 bg-white relative z-10">
            <div className="text-sm font-medium text-black">{currentTime || '9:41'}</div>
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5">
                <div className="w-1 h-1 bg-black rounded-full"></div>
                <div className="w-1 h-1 bg-black rounded-full"></div>
                <div className="w-1 h-1 bg-black rounded-full"></div>
                <div className="w-1 h-1 bg-black rounded-full"></div>
              </div>
              <Wifi className="w-4 h-4 text-black ml-1" />
              {/* Full Battery Icon */}
              <div className="relative ml-1">
                <div className="w-6 h-3 border border-black rounded-sm">
                  <div className="w-full h-full bg-black rounded-sm"></div>
                </div>
                <div className="absolute -right-0.5 top-0.5 w-0.5 h-2 bg-black rounded-r-sm"></div>
              </div>
            </div>
          </div>

          {/* Header - Simplified with just profile avatar */}
          <header className="flex items-center justify-between px-6 py-2 bg-white/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              {showBackButton && (
                <button
                  className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"
                  onClick={() => onNavigate('home')}
                  aria-label="Go back to home"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => onNavigate('settings')}
                className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center hover:from-cyan-600 hover:to-cyan-700 transition-all"
                aria-label="Profile settings"
              >
                <Image 
                  src="/images/rabbit-logo.svg" 
                  alt="Profile" 
                  width={16} 
                  height={16} 
                  className="text-white"
                />
              </button>
            </div>
          </header>

          {/* Main Content - Shifted up */}
          <main className="flex-1 overflow-y-auto px-6 pb-20 pt-2">
            {children}
          </main>

          {/* Bottom Navigation */}
          {showBottomNav && (
            <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-100 px-6 py-3 z-20">
              <div className="flex justify-around items-center">
                {[
                  { icon: Home, label: "Home", page: 'home' as PageType },
                  { icon: Wallet, label: "Wallet", page: 'wallet' as PageType },
                  { icon: History, label: "History", page: 'history' as PageType },
                  { icon: ArrowUpDown, label: "Swap", page: 'swap' as PageType },
                  { icon: Settings, label: "Settings", page: 'settings' as PageType },
                ].map(({ icon: Icon, label, page }) => (
                  <button
                    key={label}
                    className={`flex flex-col items-center gap-1 p-2 min-h-[52px] transition-all active:scale-95 ${
                      currentPage === page ? "text-cyan-600" : "text-gray-400 hover:text-gray-600"
                    }`}
                    onClick={() => onNavigate(page)}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 