"use client"

import React, { useState, useEffect } from 'react'
import { 
  Wallet, 
  ChevronRight, 
  Plus,
  ChevronLeft
} from 'lucide-react'
import type { WalletData } from '@/types/wallet'

interface WalletCarouselProps {
  activeWallet: WalletData | null
  wallets: WalletData[]
  onNavigate: (page: 'home' | 'wallet' | 'send' | 'receive' | 'settings' | 'add-wallet' | 'pin-setup' | 'history' | 'swap') => void
  onSelectWallet: (wallet: WalletData) => void
  showAddWallet?: boolean
  showAllWallets?: boolean
  onSelectAllWallets?: () => void
  selectedWalletId?: string
}

export default function WalletCarousel({ 
  activeWallet, 
  wallets, 
  onNavigate, 
  onSelectWallet,
  showAddWallet = true,
  showAllWallets = false,
  onSelectAllWallets,
  selectedWalletId
}: WalletCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [currentX, setCurrentX] = useState(0)

  // Find current wallet index
  useEffect(() => {
    if (selectedWalletId === 'all' && showAllWallets) {
      setCurrentIndex(0) // All wallets is first
    } else if (activeWallet) {
      const offset = showAllWallets ? 1 : 0 // Offset for "All Wallets" card
      const index = wallets.findIndex(w => w.id === activeWallet.id)
      if (index !== -1) {
        setCurrentIndex(index + offset)
      }
    }
  }, [activeWallet, wallets, selectedWalletId, showAllWallets])

  const totalCards = wallets.length + (showAllWallets ? 1 : 0) + (showAddWallet ? 1 : 0)

  const handleSwipeLeft = () => {
    if (currentIndex < totalCards - 1) {
      const newIndex = currentIndex + 1
      setCurrentIndex(newIndex)
      
      if (showAllWallets && newIndex === 0) {
        onSelectAllWallets?.()
      } else {
        const walletIndex = newIndex - (showAllWallets ? 1 : 0)
        if (walletIndex < wallets.length) {
          onSelectWallet(wallets[walletIndex])
        }
      }
    }
  }

  const handleSwipeRight = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      setCurrentIndex(newIndex)
      
      if (showAllWallets && newIndex === 0) {
        onSelectAllWallets?.()
      } else {
        const walletIndex = newIndex - (showAllWallets ? 1 : 0)
        if (walletIndex >= 0 && walletIndex < wallets.length) {
          onSelectWallet(wallets[walletIndex])
        }
      }
    }
  }

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setStartX(e.clientX)
    setCurrentX(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setCurrentX(e.clientX)
  }

  const handleMouseUp = () => {
    if (!isDragging) return
    
    const diff = startX - currentX
    const threshold = 50 // Minimum drag distance
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Dragged left, go to next
        handleSwipeLeft()
      } else {
        // Dragged right, go to previous
        handleSwipeRight()
      }
    }
    
    setIsDragging(false)
    setStartX(0)
    setCurrentX(0)
  }

  return (
    <div className="relative">
      {/* Carousel Container */}
      <div className="overflow-hidden rounded-2xl">
        <div 
          className="flex transition-transform duration-300 ease-out cursor-grab active:cursor-grabbing"
          style={{ 
            transform: `translateX(-${currentIndex * 100}%)`,
            userSelect: 'none'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* All Wallets Card */}
          {showAllWallets && (
            <div className="w-full flex-shrink-0">
              <div 
                onClick={() => onSelectAllWallets?.()}
                className="w-full relative bg-gradient-to-br from-cyan-100 via-cyan-50 to-white rounded-2xl p-4 h-20 overflow-hidden border border-gray-100/20 shadow-sm hover:from-cyan-200 hover:via-cyan-100 hover:to-cyan-50 transition-all cursor-pointer"
              >
                {/* Abstract Background Graphics */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-2 right-2 w-4 h-4 bg-cyan-600 rotate-45 rounded-sm"></div>
                  <div className="absolute top-6 right-6 w-0 h-0 border-l-3 border-r-3 border-b-4 border-l-transparent border-r-transparent border-b-cyan-600"></div>
                  <div className="absolute bottom-3 left-3 w-3 h-3 bg-cyan-600 rounded-full"></div>
                  <div className="absolute bottom-2 right-4 w-2 h-2 bg-cyan-600 rotate-12"></div>
                </div>
                
                {/* All Wallets Content */}
                <div className="relative z-10 flex items-center justify-between h-full">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-cyan-600 rounded-lg flex items-center justify-center">
                      <Wallet className="w-2.5 h-2.5 text-white" />
                    </div>
                    <div>
                      <div className="text-gray-900 font-medium text-sm">All Wallets</div>
                      <div className="text-gray-700 text-xs font-medium">
                        {wallets.reduce((sum, w) => sum + w.balance, 0).toFixed(6)} BTC
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-gray-500">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Dots Indicator on Card */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex space-x-1">
                  {Array.from({ length: totalCards }).map((_, dotIndex) => (
                    <div
                      key={dotIndex}
                      className={`w-1 h-1 rounded-full transition-all ${
                        currentIndex === dotIndex 
                          ? 'bg-cyan-600 w-2' 
                          : 'bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Wallet Cards */}
          {wallets.map((wallet, index) => (
            <div key={wallet.id} className="w-full flex-shrink-0">
              <div className="w-full relative bg-gradient-to-br from-cyan-100 via-cyan-50 to-white rounded-2xl p-4 h-20 overflow-hidden border border-gray-100/20 shadow-sm hover:from-cyan-200 hover:via-cyan-100 hover:to-cyan-50 transition-all cursor-pointer">
                {/* Abstract Background Graphics */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-2 right-2 w-4 h-4 bg-cyan-600 rotate-45 rounded-sm"></div>
                  <div className="absolute top-6 right-6 w-0 h-0 border-l-3 border-r-3 border-b-4 border-l-transparent border-r-transparent border-b-cyan-600"></div>
                  <div className="absolute bottom-3 left-3 w-3 h-3 bg-cyan-600 rounded-full"></div>
                  <div className="absolute bottom-2 right-4 w-2 h-2 bg-cyan-600 rotate-12"></div>
                </div>
                
                {/* Wallet Content */}
                <div className="relative z-10 flex items-center justify-between h-full">
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => onSelectWallet(wallet)}
                  >
                    <div className="w-5 h-5 bg-cyan-600 rounded-lg flex items-center justify-center">
                      <Wallet className="w-2.5 h-2.5 text-white" />
                    </div>
                    <div>
                      <div className="text-gray-900 font-medium text-sm">{wallet.name}</div>
                      <div className="text-gray-700 text-xs font-medium">
                        {wallet.balance.toFixed(6)} BTC
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onNavigate('wallet')
                    }}
                    className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded-lg hover:bg-white/50"
                    aria-label="View wallet details"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Dots Indicator on Card */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex space-x-1">
                  {Array.from({ length: totalCards }).map((_, dotIndex) => (
                    <div
                      key={dotIndex}
                      className={`w-1 h-1 rounded-full transition-all ${
                        currentIndex === dotIndex 
                          ? 'bg-cyan-600 w-2' 
                          : 'bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
          
          {/* Add Wallet Card */}
          {showAddWallet && (
            <div className="w-full flex-shrink-0">
              <button
                onClick={() => onNavigate('add-wallet')}
                className="w-full bg-gray-50 hover:bg-gray-100 rounded-2xl p-4 h-20 border-2 border-dashed border-gray-300 transition-all active:scale-95 relative"
              >
                <div className="flex items-center justify-center h-full space-x-2">
                  <div className="w-5 h-5 bg-gray-500 rounded-full flex items-center justify-center">
                    <Plus className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-gray-700 font-medium text-sm">Add/Import Wallet</span>
                </div>

                {/* Dots Indicator on Card */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex space-x-1">
                  {Array.from({ length: totalCards }).map((_, dotIndex) => (
                    <div
                      key={dotIndex}
                      className={`w-1 h-1 rounded-full transition-all ${
                        currentIndex === dotIndex 
                          ? 'bg-cyan-600 w-2' 
                          : 'bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Arrows */}
      {totalCards > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={handleSwipeRight}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-cyan-100 hover:bg-cyan-200 backdrop-blur-sm rounded-2xl flex items-center justify-center text-cyan-600 transition-all"
              aria-label="Previous wallet"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          
          {currentIndex < totalCards - 1 && (
            <button
              onClick={handleSwipeLeft}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-cyan-100 hover:bg-cyan-200 backdrop-blur-sm rounded-2xl flex items-center justify-center text-cyan-600 transition-all"
              aria-label="Next wallet"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </>
      )}
    </div>
  )
} 