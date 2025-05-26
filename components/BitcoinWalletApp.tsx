"use client"

import React, { useState, useEffect } from 'react'
import { useBitcoinPrice } from "@/hooks/useBitcoinPrice"
import { useCurrencyRates } from "@/hooks/useCurrencyRates"
import { walletStorage } from "@/lib/storage"
import type { WalletData } from "@/types/wallet"
import Image from 'next/image'

// Import page components
import WalletLayout from '@/components/shared/WalletLayout'
import HomePage from '@/components/pages/HomePage'
import AddWalletPage from '@/components/pages/AddWalletPage'
import WalletPage from '@/components/pages/WalletPage'
import SendPage from '@/components/pages/SendPage'
import ReceivePage from '@/components/pages/ReceivePage'
import SettingsPage from '@/components/pages/SettingsPage'
import EnhancedHistoryPage from '@/components/pages/EnhancedHistoryPage'
import SwapPage from '@/components/pages/SwapPage'
import PinSetupPage from '@/components/pages/PinSetupPage'

// Import styles
import '@/styles/pages/home.css'
import '@/styles/pages/add-wallet.css'
import '@/styles/pages/wallet.css'
import '@/styles/pages/send.css'
import '@/styles/pages/receive.css'
import '@/styles/pages/settings.css'
import '@/styles/pages/history.css'
import '@/styles/pages/swap.css'

type PageType = 'home' | 'wallet' | 'send' | 'receive' | 'settings' | 'add-wallet' | 'pin-setup' | 'history' | 'swap'

export default function BitcoinWalletApp() {
  const [currentPage, setCurrentPage] = useState<PageType>('home')
  const { price: bitcoinPrice, prices, change24h, isLoading, error, lastUpdated, getPriceInCurrency } = useBitcoinPrice(currentPage === 'home')
  const { rates: currencyRates } = useCurrencyRates(currentPage === 'home')
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null)
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCreatingWallet, setIsCreatingWallet] = useState(false)
  const [settings, setSettings] = useState({
    pinEnabled: false,
    pinCode: '',
    autoLockTime: 5,
    hideBalance: false,
    currency: 'USD',
    network: 'mainnet',
    notifications: true
  })

  // Initialize wallet data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      walletStorage.initialize()
      const savedWallets = walletStorage.loadWallets()
      const savedSettings = localStorage.getItem('rabbit-wallet-settings')
      
      if (savedWallets.length > 0) {
        setWallets(savedWallets)
        setSelectedWallet(savedWallets[0])
      }
      
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings)
        // Migrate showBalance to hideBalance if needed
        if ('showBalance' in parsedSettings && !('hideBalance' in parsedSettings)) {
          parsedSettings.hideBalance = !parsedSettings.showBalance
          delete parsedSettings.showBalance
        }
        setSettings(parsedSettings)
      }
    }
    setIsInitialized(true)
  }, [])

  // Auto-refresh balances - COMPLETELY DISABLED during wallet creation
  useEffect(() => {
    // 🚀 CRITICAL FIX: Do not run ANY auto-refresh logic during wallet creation
    if (currentPage === 'add-wallet' as PageType || isCreatingWallet) {
      console.log('🚫 Auto-refresh BLOCKED - wallet creation in progress')
      return
    }

    // Only run if we have wallets and are initialized
    if (wallets.length === 0 || !isInitialized) {
      console.log('🚫 Auto-refresh BLOCKED - no wallets or not initialized')
      return
    }

    // Additional safety check - never run during wallet creation
    if (!isInitialized || isCreatingWallet) {
      console.log('🚫 Auto-refresh BLOCKED - safety check failed')
      return
    }

    const refreshBalances = async () => {
      // Double-check we're not in wallet creation mode
      if (currentPage === 'add-wallet' as PageType || isCreatingWallet) {
        console.log('🚫 Refresh ABORTED - wallet creation detected')
        return
      }
      
      if (isRefreshing) return
      
      setIsRefreshing(true)
      try {
        const { getBlockchainService } = await import('@/lib/blockchain-service')
        
        const updatedWallets = await Promise.all(
          wallets.map(async (wallet) => {
            try {
              const service = getBlockchainService(wallet.network || 'mainnet')
              
              // Fetch both balance and transaction history
              const [balance, transactions] = await Promise.all([
                service.getAddressBalance(wallet.address),
                service.getAddressTransactions(wallet.address)
              ])
              
              console.log(`📊 Wallet ${wallet.name}: ${balance.total.toFixed(6)} BTC, ${transactions.length} transactions`)
              
              return {
                ...wallet,
                balance: balance.total,
                transactions: transactions.slice(0, 50) // Keep last 50 transactions
              }
            } catch (error) {
              console.error(`Failed to refresh wallet ${wallet.name}:`, error)
              return wallet
            }
          })
        )
        
        // Check if any data actually changed (balance or transactions)
        const hasChanges = updatedWallets.some((wallet, index) => {
          const oldWallet = wallets[index]
          return (
            wallet.balance !== oldWallet.balance ||
            wallet.transactions?.length !== oldWallet.transactions?.length ||
            (wallet.transactions?.[0]?.id !== oldWallet.transactions?.[0]?.id)
          )
        })
        
        if (hasChanges) {
          console.log('💾 Updating wallets with fresh blockchain data')
          setWallets(updatedWallets)
          walletStorage.saveWallets(updatedWallets)
          
          // Update selected wallet if it exists in updated list
          if (selectedWallet) {
            const updated = updatedWallets.find(w => w.id === selectedWallet.id)
            if (updated) setSelectedWallet(updated)
          }
        } else {
          console.log('✅ No changes detected, keeping current data')
        }
      } catch (error) {
        console.error('Failed to refresh blockchain data:', error)
      } finally {
        setIsRefreshing(false)
      }
    }

    // Initial refresh after wallet load - but only if we have wallets
    if (wallets.length > 0) {
      console.log('🚀 Starting initial balance refresh for', wallets.length, 'wallets')
      refreshBalances()
    }

    // Set up periodic refresh every 15 seconds (more frequent for real-time updates)
    const interval = setInterval(() => {
      // Check again before each interval refresh
      if (currentPage !== 'add-wallet' as PageType && !isCreatingWallet && wallets.length > 0) {
        console.log('⏰ Periodic refresh triggered')
        refreshBalances()
      } else {
        console.log('🚫 Interval refresh SKIPPED - wallet creation in progress or no wallets')
      }
    }, 15000)
    
    return () => clearInterval(interval)
  }, [wallets, isInitialized, currentPage, isCreatingWallet, isRefreshing, selectedWallet]) // 🚀 FIXED: Include dependencies to refresh when wallets change

  // Helper functions
  const navigateToPage = (page: PageType) => {
    if (page === currentPage) return
    setCurrentPage(page)
  }

  const updateSettings = (newSettings: any) => {
    setSettings(newSettings)
    if (typeof window !== 'undefined') {
      localStorage.setItem('rabbit-wallet-settings', JSON.stringify(newSettings))
    }
  }

  const formatCurrency = (amount: number, currency: string = settings.currency, showSymbol = true) => {
    if (currency === 'BTC') {
      return `${showSymbol ? '₿ ' : ''}${amount.toFixed(6)}`
    }
    
    // Use Intl.NumberFormat for proper localization
    const currencyLocales = {
      USD: 'en-US',
      EUR: 'de-DE',
      GBP: 'en-GB',
      JPY: 'ja-JP',
      INR: 'en-IN',
      AUD: 'en-AU',
      CHF: 'de-CH'
    }
    
    const locale = currencyLocales[currency as keyof typeof currencyLocales] || 'en-US'
    
    if (showSymbol) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: currency === 'JPY' ? 0 : 2,
        maximumFractionDigits: currency === 'JPY' ? 0 : 2
      }).format(amount)
    } else {
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: currency === 'JPY' ? 0 : 2,
        maximumFractionDigits: currency === 'JPY' ? 0 : 2
      }).format(amount)
    }
  }

  // Calculate totals
  const activeWallet = selectedWallet || wallets[0]
  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0)
  
  // Calculate fiat value based on selected currency using direct price data
  const getFiatValue = (btcAmount: number) => {
    if (settings.currency === 'BTC') return btcAmount
    
    // Use direct currency prices from CoinGecko if available
    const priceInCurrency = getPriceInCurrency(settings.currency)
    if (priceInCurrency) {
      return btcAmount * priceInCurrency
    }
    
    // Fallback to USD conversion with exchange rates
    if (!bitcoinPrice || !currencyRates) return 0
    
    const usdValue = btcAmount * bitcoinPrice
    const rate = currencyRates[settings.currency as keyof typeof currencyRates]
    
    if (settings.currency === 'USD') return usdValue
    return rate ? usdValue / rate : usdValue // Fixed: divide by rate for proper conversion
  }
  
  const totalValueFiat = getFiatValue(totalBalance)

  // Handle wallet creation
  const handleWalletCreated = (newWallet: WalletData) => {
    const updatedWallets = [...wallets, newWallet]
    setWallets(updatedWallets)
    setSelectedWallet(newWallet)
    walletStorage.saveWallets(updatedWallets)
    navigateToPage('home')
  }

  // Handle wallet refresh
  const handleRefreshWallet = async () => {
    if (!activeWallet) return
    
    console.log('🔄 Manual refresh requested for', activeWallet.name)
    try {
      const { getBlockchainService } = await import('@/lib/blockchain-service')
      const service = getBlockchainService(activeWallet.network || 'mainnet')
      const [balance, transactions] = await Promise.all([
        service.getAddressBalance(activeWallet.address),
        service.getAddressTransactions(activeWallet.address)
      ])
      
      const updatedWallet = {
        ...activeWallet,
        balance: balance.total,
        transactions: transactions.slice(0, 50)
      }
      
      const updatedWallets = wallets.map(w => 
        w.id === activeWallet.id ? updatedWallet : w
      )
      
      setWallets(updatedWallets)
      setSelectedWallet(updatedWallet)
      walletStorage.saveWallets(updatedWallets)
      
      console.log('✅ Manual refresh completed:', transactions.length, 'transactions found')
    } catch (error) {
      console.error('❌ Manual refresh failed:', error)
    }
  }

  // Handle wallet balances refresh
  const handleRefreshBalances = async () => {
    if (wallets.length === 0) return
    
    setIsRefreshing(true)
    try {
      const { getBlockchainService } = await import('@/lib/blockchain-service')
      
      const updatedWallets = await Promise.all(
        wallets.map(async (wallet) => {
          try {
            const service = getBlockchainService(wallet.network || 'mainnet')
            const balance = await service.getAddressBalance(wallet.address)
            const transactions = await service.getAddressTransactions(wallet.address)
            
            return {
              ...wallet,
              balance: balance.total,
              transactions: transactions.slice(0, 10)
            }
          } catch (error) {
            console.error(`Failed to refresh wallet ${wallet.name}:`, error)
            return wallet
          }
        })
      )
      
      setWallets(updatedWallets)
      walletStorage.saveWallets(updatedWallets)
      
      if (selectedWallet) {
        const updated = updatedWallets.find(w => w.id === selectedWallet.id)
        if (updated) setSelectedWallet(updated)
      }
    } catch (error) {
      console.error('Failed to refresh balances:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handle wallet update
  const handleUpdateWallet = (updatedWallet: WalletData) => {
    const updatedWallets = wallets.map(w => 
      w.id === updatedWallet.id ? updatedWallet : w
    )
    setWallets(updatedWallets)
    setSelectedWallet(updatedWallet)
    walletStorage.saveWallets(updatedWallets)
  }

  // Handle clear wallet data
  const handleClearWalletData = () => {
    setWallets([])
    setSelectedWallet(null)
    walletStorage.saveWallets([])
  }

  // Get page title
  const getPageTitle = () => {
    switch (currentPage) {
      case 'home': return 'Rabbit'
      case 'wallet': return 'Wallets'
      case 'send': return 'Send Bitcoin'
      case 'receive': return 'Receive Bitcoin'
      case 'settings': return 'Settings'
      case 'add-wallet': return 'Add Wallet'
      case 'pin-setup': return 'PIN Setup'
      case 'history': return 'Transaction History'
      case 'swap': return 'Swap'
      default: return 'Rabbit'
    }
  }

  // Show loading state during initialization
  if (!isInitialized) {
    return (
      <WalletLayout
        currentPage={currentPage}
        onNavigate={navigateToPage}
        title="Rabbit"
        showBackButton={false}
        showBottomNav={false}
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 animate-spin text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-gray-600 text-sm">Initializing wallet...</p>
          </div>
        </div>
      </WalletLayout>
    )
  }

  // Handle case where no wallets exist
  if (wallets.length === 0) {
    // If user is trying to add a wallet, show the add wallet page
    if (currentPage === 'add-wallet') {
      return (
        <WalletLayout
          currentPage={currentPage}
          onNavigate={navigateToPage}
          title={getPageTitle()}
          showBackButton={false}
          showBottomNav={false}
        >
          <AddWalletPage
            wallets={wallets}
            onWalletCreated={handleWalletCreated}
            onCancel={() => navigateToPage('home')}
            setIsCreatingWallet={setIsCreatingWallet}
          />
        </WalletLayout>
      )
    }

    // Default welcome screen
    return (
      <WalletLayout
        currentPage={currentPage}
        onNavigate={navigateToPage}
        title="Rabbit"
        showBackButton={false}
        showBottomNav={false}
      >
        <div className="h-full flex items-center justify-center px-6">
          <div className="text-center max-w-xs w-full">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Image 
                src="/images/rabbit-logo.svg" 
                alt="Rabbit" 
                width={24} 
                height={24} 
                className="text-cyan-600"
              />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Welcome to Rabbit</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">Get started by creating your first Bitcoin wallet. Your keys, your Bitcoin.</p>
            
            <button
              onClick={() => navigateToPage('add-wallet')}
              className="w-full bg-cyan-100 hover:bg-cyan-200 text-cyan-600 rounded-2xl p-4 text-sm font-medium active:scale-95 transition-all mb-6"
            >
              🐰 <strong>Create or Import Wallet</strong>
            </button>
            
            <div className="space-y-1.5">
              <div className="flex items-center text-xs text-gray-400">
                <div className="w-1 h-1 bg-gray-400 rounded-full mr-2"></div>
                <span>Create a new wallet with secure seed phrase</span>
              </div>
              <div className="flex items-center text-xs text-gray-400">
                <div className="w-1 h-1 bg-gray-400 rounded-full mr-2"></div>
                <span>Import existing wallet with seed phrase</span>
              </div>
              <div className="flex items-center text-xs text-gray-400">
                <div className="w-1 h-1 bg-gray-400 rounded-full mr-2"></div>
                <span>Real Bitcoin transactions on mainnet</span>
              </div>
            </div>
          </div>
        </div>
      </WalletLayout>
    )
  }

  // Main wallet interface
  return (
    <WalletLayout
      currentPage={currentPage}
      onNavigate={navigateToPage}
      title={getPageTitle()}
      showBackButton={false}
      showBottomNav={currentPage !== 'add-wallet' && currentPage !== 'pin-setup'}
    >
      {/* Render current page */}
      {currentPage === 'home' && (
        <HomePage
          activeWallet={activeWallet}
          wallets={wallets}
          totalBalance={totalBalance}
          totalValueFiat={totalValueFiat}
          bitcoinPrice={bitcoinPrice}
          change24h={change24h}
          lastUpdated={lastUpdated}
          isLoading={isLoading}
          error={error}
          isRefreshing={isRefreshing}
          settings={{...settings, showBalance: !settings.hideBalance}}
          formatCurrency={formatCurrency}
          onNavigate={navigateToPage}
          onRefreshWallet={handleRefreshWallet}
          onSelectWallet={setSelectedWallet}
          currencyRates={currencyRates}
          getPriceInCurrency={getPriceInCurrency}
        />
      )}

      {currentPage === 'add-wallet' && (
        <AddWalletPage
          wallets={wallets}
          onWalletCreated={handleWalletCreated}
          onCancel={() => navigateToPage('home')}
          setIsCreatingWallet={setIsCreatingWallet}
        />
      )}

      {currentPage === 'pin-setup' && (
        <PinSetupPage
          onPinCreated={(pin: string) => {
            updateSettings({...settings, pinEnabled: true, pinCode: pin})
            navigateToPage('settings')
          }}
          onCancel={() => navigateToPage('settings')}
        />
      )}

      {currentPage === 'wallet' && (
        <WalletPage
          wallets={wallets}
          selectedWallet={selectedWallet}
          bitcoinPrice={bitcoinPrice}
          isRefreshing={isRefreshing}
          formatCurrency={formatCurrency}
          onSelectWallet={setSelectedWallet}
          onNavigate={navigateToPage}
          onRefreshBalances={handleRefreshBalances}
          settings={{...settings, showBalance: !settings.hideBalance}}
          currencyRates={currencyRates}
          getPriceInCurrency={getPriceInCurrency}
        />
      )}

      {currentPage === 'send' && (
        <SendPage
          activeWallet={activeWallet}
          bitcoinPrice={bitcoinPrice}
          formatCurrency={formatCurrency}
          onNavigate={navigateToPage}
          onUpdateWallet={handleUpdateWallet}
          settings={{...settings, showBalance: !settings.hideBalance}}
          currencyRates={currencyRates}
          getPriceInCurrency={getPriceInCurrency}
        />
      )}

      {currentPage === 'receive' && (
        <ReceivePage
          activeWallet={activeWallet}
          onNavigate={navigateToPage}
        />
      )}

      {currentPage === 'settings' && (
        <SettingsPage
          activeWallet={activeWallet}
          wallets={wallets}
          settings={settings}
          onUpdateSettings={updateSettings}
          onNavigate={navigateToPage}
          onClearWalletData={handleClearWalletData}
        />
      )}

      {currentPage === 'history' && (
        <EnhancedHistoryPage
          activeWallet={activeWallet}
          wallets={wallets}
          formatCurrency={formatCurrency}
          bitcoinPrice={bitcoinPrice}
          settings={{...settings, showBalance: !settings.hideBalance}}
          onNavigate={navigateToPage}
          onRefreshWallet={handleRefreshWallet}
          onSelectWallet={setSelectedWallet}
          getPriceInCurrency={getPriceInCurrency}
        />
      )}

      {currentPage === 'swap' && (
        <SwapPage
          activeWallet={activeWallet}
          bitcoinPrice={bitcoinPrice}
          formatCurrency={formatCurrency}
          settings={{...settings, showBalance: !settings.hideBalance}}
          onNavigate={navigateToPage}
          getPriceInCurrency={getPriceInCurrency}
        />
      )}
    </WalletLayout>
  )
} 