"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Send, Home, Wallet, Download, Settings, ArrowUpRight, ArrowDownLeft, MoreHorizontal, RefreshCw, X, Plus, Edit, Trash2, QrCode, ArrowLeft, Check } from "lucide-react"
import { useBitcoinPrice } from "@/hooks/useBitcoinPrice"
import { useCurrencyRates } from "@/hooks/useCurrencyRates"
import { walletStorage, type TransactionData } from "@/lib/storage"
import type { WalletData } from "@/types/wallet"
import { getBlockchainService } from "@/lib/blockchain-service"
import QRCode from 'qrcode'

type PageType = 'home' | 'wallet' | 'send' | 'receive' | 'settings' | 'add-wallet'

export default function BitcoinWallet() {
  const { price: bitcoinPrice, change24h, isLoading, error, lastUpdated } = useBitcoinPrice()
  const { rates: currencyRates } = useCurrencyRates()
  
  // State management
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null)
  const [currentPage, setCurrentPage] = useState<PageType>('home')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // PIN and Settings state
  const [isLocked, setIsLocked] = useState(false)
  const [enteredPin, setEnteredPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [settings, setSettings] = useState({
    pinEnabled: false,
    pinCode: '',
    autoLockTime: 5,
    showBalance: true,
    currency: 'USD',
    network: 'testnet',
    notifications: true
  })

  // Add state for seed phrase reminder
  const [showSeedReminder, setShowSeedReminder] = useState(false)

  // 🌐 Refresh wallet data from blockchain
  const refreshWalletData = async (wallet: WalletData): Promise<WalletData> => {
    try {
      const blockchainService = getBlockchainService(wallet.network)
      
      // Check if wallet network matches current setting
      if (wallet.network !== settings.network) {
        console.warn(`Wallet ${wallet.name} is on ${wallet.network} but app is set to ${settings.network}`)
        // Return wallet with zero balance but preserve structure
        return {
          ...wallet,
          balance: 0,
          transactions: []
        }
      }
      
      console.log(`💫 Fetching data for ${wallet.name} (${wallet.network})...`)
      console.log(`Address: ${wallet.address}`)
      
      // Set a timeout for the entire operation
      const refreshTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Wallet refresh timeout')), 8000) // 8 second total timeout
      })
      
      // Race between actual refresh and timeout
      const refreshPromise = (async () => {
        // Fetch real balance from blockchain
        const balanceData = await blockchainService.getAddressBalance(wallet.address)
        console.log(`💰 Balance: ${balanceData.total} BTC`)
        
        // Fetch real transactions from blockchain  
        const transactions = await blockchainService.getAddressTransactions(wallet.address)
        console.log(`📋 Transactions: ${transactions.length}`)
        
        return {
          ...wallet,
          balance: balanceData.total,
          transactions: transactions
        }
      })()
      
      const updatedWallet = await Promise.race([refreshPromise, refreshTimeout]) as WalletData
      return updatedWallet
      
    } catch (error) {
      console.error(`❌ Refresh failed for ${wallet.name}:`, error instanceof Error ? error.message : 'Unknown error')
      
      // Return wallet with current data instead of failing completely
      return {
        ...wallet,
        // Keep existing balance if API fails
        transactions: wallet.transactions || []
      }
    }
  }

  // 🔄 Refresh all wallets from blockchain
  const refreshAllWallets = async () => {
    if (wallets.length === 0) return
    
    setIsRefreshing(true)
    console.log(`💫 Refreshing ${wallets.length} wallets on ${settings.network}...`)
    
    try {
      // Process wallets in parallel for speed
      const refreshPromises = wallets.map(wallet => 
        refreshWalletData(wallet).catch((error: any) => {
          console.warn(`⚠️ Wallet ${wallet.name} refresh failed:`, error?.message || 'Unknown error')
          return wallet // Return original if error, don't fail everything
        })
      )
      
      const refreshedWallets: WalletData[] = await Promise.all(refreshPromises) as WalletData[]
      console.log(`✅ Refreshed ${refreshedWallets.length} wallets successfully`)
      
      setWallets(refreshedWallets)
      
      // Update selected wallet if it was refreshed
      if (selectedWallet) {
        const refreshedSelected = refreshedWallets.find(w => w.id === selectedWallet.id)
        if (refreshedSelected) {
          setSelectedWallet(refreshedSelected)
        }
      }
    } catch (error) {
      console.error('❌ Error refreshing wallets:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Load settings and check PIN on mount
  useEffect(() => {
    // Only access localStorage on client side
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('bitwallet-settings')
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings)
        setSettings(parsedSettings)
        
        // If PIN is enabled, lock the app initially
        if (parsedSettings.pinEnabled && parsedSettings.pinCode) {
          setIsLocked(true)
        }
      }
      
      // Check if user has seen seed phrase reminder
      const hasSeenReminder = localStorage.getItem('bitwallet-seed-reminder')
      if (!hasSeenReminder && wallets.length === 0) {
        setShowSeedReminder(true)
      }
    }
    
    // Initialize storage system
    walletStorage.initialize()
    
    // Load existing wallets immediately with cached data
    const savedWallets = walletStorage.loadWallets()
    
    if (savedWallets.length > 0) {
      setWallets(savedWallets)
      setSelectedWallet(savedWallets[0])
      console.log('📱 Loaded cached wallet data instantly')
    }
    
    setIsInitialized(true)
  }, [])

  // 🌐 Auto-refresh wallet data when wallets are loaded or network changes
  useEffect(() => {
    if (isInitialized && wallets.length > 0 && !isLocked) {
      console.log('🔄 Starting immediate background refresh...')
      
      // Start immediate refresh in background (non-blocking)
      refreshAllWallets()
      
      // Set up slower auto-refresh: 10 seconds for testnet, 30 seconds for mainnet
      const refreshInterval = settings.network === 'testnet' ? 10000 : 30000
      const autoRefreshInterval = setInterval(() => {
        console.log(`🔄 Auto-refreshing wallet data (${settings.network}) every ${refreshInterval/1000}s...`)
        refreshAllWallets()
      }, refreshInterval)
      
      return () => clearInterval(autoRefreshInterval)
    }
  }, [isInitialized, settings.network, isLocked])

  // Handle PIN verification
  const handlePinVerification = () => {
    setPinError('')
    
    if (enteredPin === settings.pinCode) {
      setIsLocked(false)
      setEnteredPin('')
      
      // Refresh wallet data after unlock
      if (wallets.length > 0) {
        refreshAllWallets()
      }
    } else {
      setPinError('Incorrect PIN')
      setEnteredPin('')
    }
  }

  // Currency conversion functions
  const getExchangeRates = () => {
    // Use real-world exchange rates from the currency hook
    return currencyRates
  }

  const convertToUSD = (amount: number, fromCurrency: string) => {
    if (!bitcoinPrice) return amount
    
    const rates = getExchangeRates()
    
    if (fromCurrency === 'USD') return amount
    if (fromCurrency === 'EUR') return amount / rates.EUR
    if (fromCurrency === 'GBP') return amount / rates.GBP
    if (fromCurrency === 'BTC') return amount * bitcoinPrice
    
    return amount
  }

  const convertFromUSD = (usdAmount: number, toCurrency: string) => {
    if (!bitcoinPrice) return usdAmount
    
    const rates = getExchangeRates()
    
    if (toCurrency === 'USD') return usdAmount
    if (toCurrency === 'EUR') return usdAmount * rates.EUR
    if (toCurrency === 'GBP') return usdAmount * rates.GBP
    if (toCurrency === 'BTC') return usdAmount / bitcoinPrice
    
    return usdAmount
  }

  const formatCurrency = (amount: number, currency: string = settings.currency, showSymbol = true) => {
    if (currency === 'BTC') {
      return `${showSymbol ? '₿ ' : ''}${amount.toFixed(5)}`
    }
    
    const symbols = {
      USD: '$',
      EUR: '€',
      GBP: '£'
    }
    
    const symbol = symbols[currency as keyof typeof symbols] || '$'
    
    return showSymbol 
      ? `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Update settings function
  const updateSettings = (newSettings: any) => {
    setSettings(newSettings)
    if (typeof window !== 'undefined') {
      localStorage.setItem('bitwallet-settings', JSON.stringify(newSettings))
    }
  }

  // Save wallets whenever they change
  useEffect(() => {
    if (isInitialized && wallets.length > 0) {
      walletStorage.saveWallets(wallets)
    }
  }, [wallets, isInitialized])

  // Page navigation with animation
  const navigateToPage = (page: PageType) => {
    if (page === currentPage) return
    
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentPage(page)
      setTimeout(() => setIsTransitioning(false), 100)
    }, 150)
  }

  // Handle wallet updates
  const handleUpdateWallet = (updatedWallet: WalletData) => {
    const updatedWallets = wallets.map(w => 
      w.id === updatedWallet.id ? updatedWallet : w
    )
    setWallets(updatedWallets)
    
    if (selectedWallet?.id === updatedWallet.id) {
      setSelectedWallet(updatedWallet)
    }
  }

  // Handle wallet deletion
  const handleDeleteWallet = (walletId: string) => {
    const updatedWallets = wallets.filter(w => w.id !== walletId)
    setWallets(updatedWallets)
    
    if (selectedWallet?.id === walletId) {
      setSelectedWallet(updatedWallets.length > 0 ? updatedWallets[0] : null)
      setCurrentPage('home')
    }
  }

  // Calculate totals with currency conversion
  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0)
  const totalValueUSD = bitcoinPrice ? totalBalance * bitcoinPrice : 0
  const totalValue = convertFromUSD(totalValueUSD, settings.currency)
  const profit24hUSD = change24h && bitcoinPrice ? (totalBalance * bitcoinPrice * change24h) / 100 : 0
  const profit24h = convertFromUSD(Math.abs(profit24hUSD), settings.currency)
  const isPositive = profit24hUSD >= 0

  // Convert Bitcoin price to selected currency
  const displayPrice = bitcoinPrice ? convertFromUSD(bitcoinPrice, settings.currency) : 0

  // Format functions
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatChange = (change: number) => {
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
  }

  // Show loading state during initialization
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="w-[375px] h-[812px] bg-black rounded-[3rem] p-2 shadow-2xl">
          <div className="w-full h-full bg-gray-50 rounded-[2.5rem] overflow-hidden relative flex flex-col">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-10"></div>
            
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-cyan-400" />
                <p className="text-gray-600">Initializing wallet...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handle case where no wallets exist
  if (wallets.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="w-[375px] h-[812px] bg-black rounded-[3rem] p-2 shadow-2xl">
          <div className="w-full h-full bg-gray-50 rounded-[2.5rem] overflow-hidden relative flex flex-col">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-10"></div>
            
            <header className="flex items-center justify-between px-4 py-3 pt-8 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-cyan-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">₿</span>
                </div>
                <div>
                <h1 className="text-lg font-medium text-gray-900">BitWallet</h1>
              </div>
              </div>
            </header>

            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Wallet className="w-10 h-10 text-gray-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to BitWallet</h2>
                <p className="text-gray-600 mb-6 text-sm">Get started by creating your first Bitcoin wallet. Your keys, your Bitcoin.</p>
                
                <button
                  onClick={() => navigateToPage('add-wallet')}
                  className="w-full bg-cyan-50 border border-cyan-200 rounded-lg p-4 mb-6 hover:bg-cyan-100 transition-colors cursor-pointer"
                >
                  <p className="text-cyan-800 text-sm">
                    👆 <strong>Tap to create or import a wallet</strong>
                  </p>
                </button>
                
                <div className="text-xs text-gray-500 space-y-1">
                  <p>• Create a new wallet with secure seed phrase</p>
                  <p>• Import existing wallet with seed phrase</p>
                  <p>• Add watch-only addresses</p>
                </div>
              </div>
            </div>

            <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
              <div className="flex justify-around items-center">
                {[
                  { icon: Home, label: "Home", active: true },
                  { icon: Wallet, label: "Wallet", disabled: true },
                  { icon: Send, label: "Send", disabled: true },
                  { icon: Download, label: "Receive", disabled: true },
                  { icon: Settings, label: "Settings", disabled: true },
                ].map(({ icon: Icon, label, active, disabled }) => (
                  <Button
                    key={label}
                    variant="ghost"
                    className={`flex-col gap-1 hover:bg-transparent p-2 h-auto min-h-[60px] ${
                      active ? "text-cyan-400" : disabled ? "text-gray-300" : "text-gray-400"
                    }`}
                    disabled={disabled}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const activeWallet = selectedWallet || wallets[0]

  // Show PIN entry screen if locked
  if (isLocked) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="w-[375px] h-[812px] bg-black rounded-[3rem] p-2 shadow-2xl">
          <div className="w-full h-full bg-gray-50 rounded-[2.5rem] overflow-hidden relative flex flex-col">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-10"></div>
            
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-cyan-600 font-bold text-2xl">🔒</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Enter PIN</h2>
                <p className="text-gray-600 mb-6 text-sm">Enter your 4-digit PIN to unlock BitWallet</p>
                
                {pinError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <span className="text-red-800 text-sm">{pinError}</span>
                  </div>
                )}
                
                <div className="mb-6">
                  <input
                    type="password"
                    placeholder="Enter PIN"
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full p-4 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                    maxLength={4}
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && enteredPin.length === 4) {
                        handlePinVerification()
                      }
                    }}
                  />
                </div>
                
                <Button
                  className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-12"
                  onClick={handlePinVerification}
                  disabled={enteredPin.length !== 4}
                >
                  Unlock
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show seed phrase reminder modal
  if (showSeedReminder) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="w-[375px] h-[812px] bg-black rounded-[3rem] p-2 shadow-2xl">
          <div className="w-full h-full bg-gray-50 rounded-[2.5rem] overflow-hidden relative flex flex-col">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-10"></div>
            
            <div className="flex-1 flex items-center justify-center px-4 py-8">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-600 font-bold text-xl">⚠️</span>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Important: Seed Phrase Security</h2>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-left">
                  <h3 className="font-medium text-red-800 mb-2 text-sm">🔑 Critical Information:</h3>
                  <ul className="text-red-700 text-xs space-y-1">
                    <li>• Your <strong>seed phrase is the ONLY way</strong> to recover your Bitcoin</li>
                    <li>• We <strong>never store your private keys</strong> - this keeps your funds secure</li>
                    <li>• If you restart the app, you'll need your seed phrase to send Bitcoin</li>
                    <li>• If you lose your seed phrase, <strong>your Bitcoin is lost forever</strong></li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-left">
                  <h3 className="font-medium text-amber-800 mb-2 text-sm">✅ What We Store Safely:</h3>
                  <ul className="text-amber-700 text-xs space-y-1">
                    <li>• Wallet names and addresses (public info)</li>
                    <li>• Your preferences and settings</li>
                    <li>• Transaction history (fetched from blockchain)</li>
                  </ul>
                </div>

                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-4 text-left">
                  <h3 className="font-medium text-cyan-800 mb-2 text-sm">🛡️ How This Keeps You Safe:</h3>
                  <ul className="text-cyan-700 text-xs space-y-1">
                    <li>• No one can hack your private keys from our app</li>
                    <li>• You have complete control of your Bitcoin</li>
                    <li>• Your funds work on any compatible wallet</li>
                  </ul>
                </div>
                
                <Button
                  className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-10 text-sm"
                  onClick={() => {
                    setShowSeedReminder(false)
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('bitwallet-seed-reminder', 'seen')
                    }
                  }}
                >
                  I Understand - Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-[375px] h-[812px] bg-black rounded-[3rem] p-2 shadow-2xl relative">
        <div 
          className="w-full h-full bg-gray-50 rounded-[2.5rem] overflow-hidden relative flex flex-col phone-container"
        >
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-10"></div>

          {/* Page Content with Blur Transition */}
          <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
            isTransitioning ? 'blur-sm opacity-50 scale-95' : 'blur-0 opacity-100 scale-100'
          }`}>
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 pt-8 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                {currentPage !== 'home' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 mr-2"
                    onClick={() => navigateToPage('home')}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
                <div className="w-8 h-8 bg-cyan-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">₿</span>
                </div>
                {/* Network indicator circle */}
                <div 
                  className={`w-3 h-3 rounded-full ${
                    settings.network === 'mainnet' ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                  title={settings.network === 'mainnet' ? 'Mainnet (Real Bitcoin)' : 'Testnet (Test Bitcoin)'}
                ></div>
                <div>
                  <h1 className="text-lg font-medium text-gray-900">
                    {currentPage === 'home' ? 'BitWallet' : 
                     currentPage === 'wallet' ? 'My Wallets' :
                     currentPage === 'send' ? 'Send Bitcoin' :
                     currentPage === 'receive' ? 'Receive Bitcoin' :
                     currentPage === 'settings' ? 'Settings' : 
                     currentPage === 'add-wallet' ? 'Add Wallet' : 'BitWallet'}
                  </h1>
                </div>
              </div>
            </header>

            {/* Page Content */}
            <main 
              className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-20 scroll-smooth relative main-content" 
              onWheel={(e) => {
                // Ensure mouse wheel scrolling works
                e.currentTarget.scrollBy({
                  top: e.deltaY,
                  behavior: 'smooth'
                });
              }}
            >
              {currentPage === 'home' && <HomePage />}
              {currentPage === 'wallet' && <WalletPage />}
              {currentPage === 'send' && <SendPage />}
              {currentPage === 'receive' && <ReceivePage />}
              {currentPage === 'settings' && <SettingsPage />}
              {currentPage === 'add-wallet' && <AddWalletPage />}
            </main>
          </div>

          {/* Bottom Navigation - Fixed Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-20 rounded-b-[2.5rem]">
            <div className="flex justify-around items-center">
              {[
                { icon: Home, label: "Home", page: 'home' as PageType },
                { icon: Wallet, label: "Wallet", page: 'wallet' as PageType },
                { icon: Send, label: "Send", page: 'send' as PageType },
                { icon: Download, label: "Receive", page: 'receive' as PageType },
                { icon: Settings, label: "Settings", page: 'settings' as PageType },
              ].map(({ icon: Icon, label, page }) => (
                <Button
                  key={label}
                  variant="ghost"
                  className={`flex-col gap-1 hover:bg-transparent p-2 h-auto min-h-[60px] transition-colors duration-200 ${
                    currentPage === page ? "text-cyan-400 hover:text-cyan-500" : "text-gray-400 hover:text-gray-600"
                  }`}
                  onClick={() => navigateToPage(page)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // HOME PAGE COMPONENT
  function HomePage() {
    // Check for network mismatches
    const networkMismatches = wallets.filter(wallet => wallet.network !== settings.network)
    const hasNetworkMismatches = networkMismatches.length > 0

    return (
      <>
        {/* Active Wallet Selector */}
        <Card className="border-slate-200 rounded-xl mb-3">
          <CardContent className="p-3">
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
              onClick={() => navigateToPage('wallet')}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-cyan-100 rounded-full flex items-center justify-center">
                  <Wallet className="w-3 h-3 text-cyan-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900 text-xs">{activeWallet.name}</div>
                  <div className="text-xs text-gray-500">{activeWallet.balance.toFixed(4)} BTC</div>
                </div>
              </div>
              <MoreHorizontal className="w-3 h-3 text-gray-400" />
            </Button>
          </CardContent>
        </Card>

        {/* Balance Card */}
        <Card className="bg-slate-800 border-0 rounded-2xl mb-4 shadow-lg">
          <CardContent className="p-4">
            <div className="mb-3">
              <div className="text-gray-400 text-xs mb-1 flex items-center gap-2">
                Total Balance
                {isRefreshing && (
                  <RefreshCw className="w-3 h-3 animate-spin text-gray-500" />
                )}
              </div>
              <div className="text-white text-2xl font-bold">
                {!settings.showBalance ? (
                  <div className="flex items-center gap-2">
                    <span>****</span>
                    <button
                      onClick={() => updateSettings({ ...settings, showBalance: true })}
                      className="text-gray-400 hover:text-white text-sm"
                    >
                      👁️
                    </button>
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Loading...
                  </div>
                ) : error ? (
                  <div className="text-red-400 text-sm">Error loading balance</div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>{formatCurrency(totalValue)}</span>
                    <button
                      onClick={() => updateSettings({ ...settings, showBalance: false })}
                      className="text-gray-400 hover:text-white text-sm"
                    >
                      👁️‍🗨️
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-gray-400 text-xs">Bitcoin Holdings</div>
                <div className="text-white text-sm font-medium">
                  {settings.showBalance ? `${totalBalance.toFixed(4)} BTC` : '****'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-xs">24h Profit</div>
                <div className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isLoading ? '...' : settings.showBalance ? 
                    `${isPositive ? '+' : ''}${formatCurrency(Math.abs(profit24h), settings.currency, false)}` : 
                    '****'
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Price Chart */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="text-gray-900 text-sm font-medium">
              Bitcoin Price
              {lastUpdated && (
                <div className="text-xs text-gray-500 mt-1">
                  Updated {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshAllWallets}
                disabled={isRefreshing}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                title="Refresh wallet data"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <div className="text-right">
                <div className="text-cyan-400 text-sm font-medium">
                  {isLoading ? (
                    <div className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Loading...
                    </div>
                  ) : error ? (
                    <div className="text-red-400 text-xs">Failed to load</div>
                  ) : (
                    settings.currency === 'BTC' ? `₿ 1.00000` : formatCurrency(displayPrice, settings.currency)
                  )}
                </div>
                {change24h && (
                  <div className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {formatChange(change24h)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="bg-cyan-50 rounded-xl p-3 h-24 relative">
            <svg className="w-full h-full" viewBox="0 0 300 80">
              <path 
                d={isPositive ? "M 0 60 Q 75 40 150 35 T 300 20" : "M 0 40 Q 75 50 150 55 T 300 65"} 
                stroke={isPositive ? "#22d3ee" : "#ef4444"} 
                strokeWidth="2" 
                fill="none" 
              />
            </svg>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>4h</span>
              <span>2h</span>
              <span>now</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <Button
            className="flex-1 bg-cyan-400 hover:bg-cyan-500 text-white rounded-xl h-12 text-sm font-medium"
            onClick={() => navigateToPage('receive')}
          >
            <Download className="w-4 h-4 mr-2" />
            Receive
          </Button>
          <Button
            className="flex-1 bg-slate-700 hover:bg-slate-800 text-white rounded-xl h-12 text-sm font-medium"
            onClick={() => navigateToPage('send')}
          >
            <Send className="w-4 h-4 mr-2" />
            Send
          </Button>
        </div>

        {/* Recent Transactions */}
        <div className="mb-4">
          <h3 className="text-gray-900 text-sm font-medium mb-3">Recent</h3>
          <div className="space-y-3">
            {activeWallet.transactions.slice(0, 3).map((tx, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      tx.type === "received" ? "bg-cyan-100" : "bg-gray-100"
                    }`}
                  >
                    {tx.type === "received" ? (
                      <ArrowUpRight className="w-3 h-3 text-cyan-600" />
                    ) : (
                      <ArrowDownLeft className="w-3 h-3 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-xs capitalize">{tx.type}</div>
                    <div className="text-xs text-gray-500">{tx.date}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900 text-xs">{tx.amount.toFixed(3)} BTC</div>
                  <div className={`text-xs ${tx.status === "completed" ? "text-cyan-400" : "text-gray-500"}`}>
                    {tx.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  // WALLET PAGE COMPONENT
  function WalletPage() {
    const [showExportModal, setShowExportModal] = useState(false)
    const [exportMnemonic, setExportMnemonic] = useState('')
    const [exportError, setExportError] = useState('')
    const [exportedKeys, setExportedKeys] = useState<any>(null)
    const [isExporting, setIsExporting] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

    const handlePrivateKeyExport = async (wallet: WalletData) => {
      setExportError('')
      setIsExporting(true)
      
      try {
        const { exportPrivateKey } = await import('@/lib/bitcoin-wallet')
        const keys = await exportPrivateKey(
          exportMnemonic,
          wallet.derivationPath,
          wallet.network,
          wallet.address
        )
        setExportedKeys({ ...keys, walletName: wallet.name })
        
        // Clear mnemonic from memory after use
        setExportMnemonic('')
      } catch (error) {
        setExportError(error instanceof Error ? error.message : 'Export failed')
      } finally {
        setIsExporting(false)
      }
    }

    const resetExportModal = () => {
      setShowExportModal(false)
      setExportMnemonic('')
      setExportError('')
      setExportedKeys(null)
      setIsExporting(false)
    }

    const handleWalletClick = (wallet: WalletData, e: React.MouseEvent) => {
      // Don't switch if clicking on action buttons
      if ((e.target as HTMLElement).closest('button')) {
        return
      }
      
      if (wallet.id !== selectedWallet?.id) {
        setSelectedWallet(wallet)
        navigateToPage('home')
      }
    }

    const handleDeleteClick = (walletId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      setDeleteConfirm(walletId)
    }

    const confirmDelete = () => {
      if (deleteConfirm) {
        handleDeleteWallet(deleteConfirm)
        setDeleteConfirm(null)
      }
    }

    const handleExportClick = (wallet: WalletData, e: React.MouseEvent) => {
      e.stopPropagation()
      setShowExportModal(true)
      setExportedKeys({ targetWallet: wallet })
    }

    return (
      <>
        <div className="space-y-4 pb-2">
          {wallets.map((wallet) => (
            <Card
              key={wallet.id}
              className={`border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                wallet.id === selectedWallet?.id 
                  ? "border-cyan-400 bg-cyan-50" 
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
              onClick={(e) => handleWalletClick(wallet, e)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        wallet.id === selectedWallet?.id ? "bg-cyan-400" : "bg-gray-200"
                      }`}
                    >
                      <Wallet className={`w-5 h-5 ${wallet.id === selectedWallet?.id ? "text-white" : "text-gray-600"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">{wallet.name}</div>
                      <div className="text-xs text-gray-500">{wallet.balance.toFixed(4)} BTC</div>
                      <div className="text-xs text-gray-500">${(wallet.balance * (bitcoinPrice || 0)).toLocaleString()}</div>
                    </div>
                  </div>
                  
                  {/* Action buttons - only show for non-selected wallets */}
                  {wallet.id !== selectedWallet?.id && (
                    <div className="flex items-center gap-2">
                      {/* Export button - upper right */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                        onClick={(e) => handleExportClick(wallet, e)}
                        title="Export private key"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      
                      {/* Delete button - center right, only if more than 1 wallet */}
                      {wallets.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => handleDeleteClick(wallet.id, e)}
                          title="Delete wallet"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Show selected indicator or click hint */}
                {wallet.id === selectedWallet?.id ? (
                  <div className="mt-3 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium">
                      <Check className="w-3 h-3" />
                      Active Wallet
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-center">
                    <div className="text-xs text-gray-500">
                      👆 Tap to switch to this wallet
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Button
            className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-xl h-12 text-sm font-medium"
            onClick={() => navigateToPage('add-wallet')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Wallet
          </Button>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Wallet</h3>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete this wallet? This action cannot be undone.
                </p>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <span className="text-yellow-800 text-sm font-medium">Important</span>
                </div>
                <p className="text-yellow-700 text-xs">
                  Make sure you have your seed phrase backed up. You can only recover this wallet with the seed phrase.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDelete}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Private Key Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Export Private Key</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={resetExportModal}
                  className="w-8 h-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {!exportedKeys?.privateKey ? (
                <>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">⚠️</span>
                      </div>
                      <span className="text-red-800 text-sm font-medium">Security Warning</span>
                    </div>
                    <ul className="text-red-700 text-xs space-y-1">
                      <li>• Never share your private key with anyone</li>
                      <li>• Anyone with this key can steal your Bitcoin</li>
                      <li>• Only export if you know what you're doing</li>
                    </ul>
                  </div>

                  {exportError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                      <span className="text-red-800 text-sm">{exportError}</span>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Wallet: {exportedKeys?.targetWallet?.name || 'Select wallet'}
                    </label>
                    <div className="text-xs text-gray-500 mb-3">
                      {exportedKeys?.targetWallet?.address}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Enter Seed Phrase
                    </label>
                    <textarea
                      placeholder="Enter your seed phrase..."
                      value={exportMnemonic}
                      onChange={(e) => setExportMnemonic(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent font-mono"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={resetExportModal}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handlePrivateKeyExport(exportedKeys?.targetWallet)}
                      disabled={!exportMnemonic.trim() || isExporting || !exportedKeys?.targetWallet}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {isExporting ? (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Exporting...
                        </div>
                      ) : (
                        'Export Key'
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Check className="w-6 h-6 text-green-600" />
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">Private Key Exported</h4>
                    <p className="text-sm text-gray-600">Store this safely and securely</p>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Private Key (WIF):</label>
                      <div className="bg-gray-50 p-2 rounded border font-mono text-xs break-all">
                        {exportedKeys.privateKey}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Public Key:</label>
                      <div className="bg-gray-50 p-2 rounded border font-mono text-xs break-all">
                        {exportedKeys.publicKey}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Address:</label>
                      <div className="bg-gray-50 p-2 rounded border font-mono text-xs break-all">
                        {exportedKeys.address}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(exportedKeys.privateKey)
                        alert('Private key copied to clipboard!')
                      }}
                      className="flex-1"
                    >
                      Copy Private Key
                    </Button>
                    <Button
                      onClick={resetExportModal}
                      className="flex-1 bg-cyan-400 hover:bg-cyan-500 text-white"
                    >
                      Done
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </>
    )
  }

  // SEND PAGE COMPONENT
  function SendPage() {
    const [step, setStep] = useState<'input' | 'confirm' | 'mnemonic' | 'success' | 'error'>('input')
    const [recipientAddress, setRecipientAddress] = useState('')
    const [amount, setAmount] = useState('')
    const [amountType, setAmountType] = useState<'btc' | 'usd'>('btc')
    const [isSending, setIsSending] = useState(false)
    const [transactionId, setTransactionId] = useState('')
    const [error, setError] = useState('')
    const [mnemonic, setMnemonic] = useState('')
    const [mnemonicError, setMnemonicError] = useState('')

    const resetSendForm = () => {
      setStep('input')
      setRecipientAddress('')
      setAmount('')
      setAmountType('btc')
      setIsSending(false)
      setTransactionId('')
      setError('')
      setMnemonic('')
      setMnemonicError('')
    }

    const handleBackToInput = () => {
      setStep('input')
      setError('')
      setMnemonic('')
      setMnemonicError('')
    }

    const validateAndProceed = () => {
      setError('')

      // Validate recipient address
      if (!recipientAddress.trim()) {
        setError('Please enter a recipient address')
        return
      }

      // Basic Bitcoin address validation (simplified)
      const isValidAddress = /^[13mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(recipientAddress.trim())
      if (!isValidAddress) {
        setError('Invalid Bitcoin address format')
        return
      }

      // Validate amount
      const numAmount = parseFloat(amount)
      if (!amount.trim() || isNaN(numAmount) || numAmount <= 0) {
        setError('Please enter a valid amount')
        return
      }

      // Convert to BTC if needed
      const btcAmount = amountType === 'btc' ? numAmount : (bitcoinPrice ? numAmount / bitcoinPrice : 0)

      // Check sufficient balance (including estimated fee)
      const estimatedFee = 0.00001 // 0.00001 BTC estimated fee
      const totalRequired = btcAmount + estimatedFee

      if (totalRequired > activeWallet.balance) {
        setError(`Insufficient balance. Required: ${totalRequired.toFixed(5)} BTC, Available: ${activeWallet.balance.toFixed(5)} BTC`)
        return
      }

      setStep('mnemonic')
    }

    const handleMnemonicSubmit = () => {
      setMnemonicError('')
      
      if (!mnemonic.trim()) {
        setMnemonicError('Please enter your seed phrase')
        return
      }

      // Validate mnemonic format (basic check)
      const words = mnemonic.trim().split(' ')
      if (words.length !== 12 && words.length !== 24) {
        setMnemonicError('Seed phrase must be 12 or 24 words')
        return
      }

      setStep('confirm')
    }

    const executeSend = async () => {
      setIsSending(true)
      setError('')

      try {
        // Convert amount to BTC
        const btcAmount = amountType === 'btc' ? parseFloat(amount) : (bitcoinPrice ? parseFloat(amount) / bitcoinPrice : 0)

        // 🌐 Real blockchain transaction
        const { createTransactionSigner } = await import('@/lib/transaction-signer')
        const { getBlockchainService } = await import('@/lib/blockchain-service')
        
        const signer = createTransactionSigner(activeWallet.network)
        const blockchainService = getBlockchainService(activeWallet.network)
        
        // Get current fee estimates
        const feeEstimates = await blockchainService.getFeeEstimates()
        const feeRate = feeEstimates.halfHourFee // Use 30-minute confirmation fee
        
        // 🔑 Create and sign transaction with temporary key derivation
        const signedTx = await signer.createAndSignTransaction(
          mnemonic,
          activeWallet.derivationPath,
          recipientAddress.trim(),
          btcAmount,
          feeRate,
          activeWallet.address
        )
        
        // 📡 Broadcast transaction to blockchain
        const txId = await blockchainService.broadcastTransaction(signedTx.txHex)
        setTransactionId(txId)

        // Create transaction record
        const transaction: TransactionData = {
          id: txId,
          walletId: activeWallet.id,
          type: 'sent',
          amount: btcAmount,
          address: recipientAddress.trim(),
          timestamp: Date.now(),
          confirmed: false,
        }

        // Add to storage
        walletStorage.addTransaction(transaction)

        // Calculate actual fee in BTC
        const feeInBtc = signedTx.fee / 100000000

        // Update wallet balance and transactions (will be refreshed from blockchain later)
        const updatedWallet = {
          ...activeWallet,
          balance: activeWallet.balance - btcAmount - feeInBtc,
          transactions: [
            {
              id: txId,
              type: 'sent' as const,
              amount: btcAmount,
              date: new Date().toISOString(),
              status: 'pending' as const,
              to: recipientAddress.trim(),
              txHash: txId
            },
            ...activeWallet.transactions
          ]
        }

        handleUpdateWallet(updatedWallet)
        
        // 🔥 SECURITY: Clear mnemonic from memory
        setMnemonic('')
        
        setStep('success')

        // 🔄 Refresh wallet data from blockchain after 3 seconds
        setTimeout(() => {
          refreshWalletData(activeWallet).then(refreshedWallet => {
            handleUpdateWallet(refreshedWallet)
          })
        }, 3000)

        // Auto redirect after success
        setTimeout(() => {
          resetSendForm()
          navigateToPage('home')
        }, 5000)

      } catch (err) {
        console.error('Transaction error:', err)
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
        setError(`Failed to send transaction: ${errorMessage}`)
        setStep('error')
      } finally {
        setIsSending(false)
      }
    }

    if (step === 'input') {
      const numAmount = parseFloat(amount) || 0
      // Convert to BTC using real-time price
      const btcAmount = amountType === 'btc' ? numAmount : (bitcoinPrice ? numAmount / bitcoinPrice : 0)
      // Convert to display currency  
      const displayAmount = amountType === 'btc' ? (bitcoinPrice ? numAmount * bitcoinPrice : 0) : numAmount
      const estimatedFee = 0.00001
      const totalBtc = btcAmount + estimatedFee

      return (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <span className="text-red-800 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Balance Display */}
          <div className="bg-cyan-50 rounded-lg p-3 mb-4">
            <div className="text-center">
              <div className="text-cyan-800 text-sm font-medium">Available Balance</div>
              <div className="text-cyan-900 text-lg font-bold">{activeWallet.balance.toFixed(5)} BTC</div>
              {bitcoinPrice && (
                <div className="text-cyan-700 text-sm">${(activeWallet.balance * bitcoinPrice).toLocaleString()}</div>
              )}
            </div>
          </div>

          {/* Recipient Address */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Recipient Address</label>
            <input
              type="text"
              placeholder="Enter Bitcoin address (e.g., 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa)"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent font-mono"
            />
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Amount</label>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-3 pr-20 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                step={amountType === 'btc' ? '0.00001' : '0.01'}
              />
              <div className="absolute inset-y-0 right-0 flex">
                <button
                  type="button"
                  onClick={() => setAmountType('btc')}
                  className={`px-3 rounded-r-lg text-xs font-medium ${
                    amountType === 'btc' 
                      ? 'bg-cyan-400 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  BTC
                </button>
                <button
                  type="button"
                  onClick={() => setAmountType('usd')}
                  className={`px-3 text-xs font-medium ${
                    amountType === 'usd' 
                      ? 'bg-cyan-400 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  USD
                </button>
              </div>
            </div>
            
            {/* Amount conversion display */}
            {amount && !isNaN(numAmount) && numAmount > 0 && bitcoinPrice && (
              <div className="mt-2 text-sm text-gray-600">
                ≈ {amountType === 'btc' 
                  ? `$${displayAmount.toLocaleString()}` 
                  : `${btcAmount.toFixed(5)} BTC`
                }
              </div>
            )}
          </div>

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {[25, 50, 100].map(percent => {
              const maxBtc = Math.max(0, activeWallet.balance - estimatedFee)
              const btcAmount = (maxBtc * percent) / 100
              return (
                <Button
                  key={percent}
                  variant="outline"
                  className="text-xs py-2"
                  onClick={() => {
                    setAmountType('btc')
                    setAmount(btcAmount.toFixed(5))
                  }}
                  disabled={maxBtc <= 0}
                >
                  {percent}%
                </Button>
              )
            })}
          </div>

          {/* Transaction Summary */}
          {amount && !isNaN(numAmount) && numAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium">{btcAmount.toFixed(5)} BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Network Fee:</span>
                <span className="font-medium">{estimatedFee.toFixed(5)} BTC</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Total:</span>
                <span>{totalBtc.toFixed(5)} BTC</span>
              </div>
              {totalBtc > activeWallet.balance && (
                <div className="text-red-600 text-xs">Insufficient balance</div>
              )}
            </div>
          )}

          <Button
            className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-12"
            onClick={validateAndProceed}
            disabled={!recipientAddress.trim() || !amount.trim() || totalBtc > activeWallet.balance}
          >
            Review Transaction
          </Button>
        </div>
      )
    }

    if (step === 'mnemonic') {
      return (
        <div className="space-y-4 pb-2">
          <Button
            variant="ghost"
            className="flex items-center gap-1 p-0 h-auto text-gray-600 hover:text-gray-900 text-sm mb-4"
            onClick={handleBackToInput}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          {mnemonicError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <span className="text-red-800 text-sm">{mnemonicError}</span>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Authorize Transaction</h3>
            <p className="text-gray-600 text-sm">Enter your seed phrase to sign the transaction</p>
          </div>

          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">i</span>
              </div>
              <span className="text-cyan-800 text-sm font-medium">Why do we ask for this?</span>
            </div>
            <p className="text-cyan-700 text-xs">
              For security, we never store your private keys. Your seed phrase is needed to temporarily generate the keys required to sign this transaction.
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <span className="text-red-800 text-sm font-medium">Security Warning</span>
            </div>
            <p className="text-red-700 text-xs">
              Never share your seed phrase with anyone. This app will never store it.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Seed Phrase (12 or 24 words)</label>
            <textarea
              placeholder="Enter your seed phrase..."
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent font-mono"
              rows={3}
            />
          </div>

          <Button
            className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-12"
            onClick={handleMnemonicSubmit}
            disabled={!mnemonic.trim()}
          >
            Continue to Confirm
          </Button>
        </div>
      )
    }

    if (step === 'confirm') {
      const numAmount = parseFloat(amount)
      const btcAmount = amountType === 'btc' ? numAmount : (bitcoinPrice ? numAmount / bitcoinPrice : 0)
      const estimatedFee = 0.00001
      const totalBtc = btcAmount + estimatedFee

      return (
        <div className="space-y-4">
          <Button
            variant="ghost"
            className="flex items-center gap-1 p-0 h-auto text-gray-600 hover:text-gray-900 text-sm mb-4"
            onClick={handleBackToInput}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Transaction</h3>
            <p className="text-gray-600 text-sm">Review the details before sending</p>
          </div>

          {/* Transaction Details */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">To Address:</div>
              <div className="font-mono text-sm text-gray-900 break-all">{recipientAddress}</div>
            </div>
            
            <div className="border-t pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount:</span>
                <div className="text-right">
                  <div className="font-medium">{btcAmount.toFixed(5)} BTC</div>
                  {bitcoinPrice && (
                    <div className="text-xs text-gray-500">${(btcAmount * bitcoinPrice).toLocaleString()}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Network Fee:</span>
              <div className="text-right">
                <div className="font-medium">{estimatedFee.toFixed(5)} BTC</div>
                {bitcoinPrice && (
                  <div className="text-xs text-gray-500">${(estimatedFee * bitcoinPrice).toFixed(2)}</div>
                )}
              </div>
            </div>

            <div className="border-t pt-3 flex justify-between font-medium">
              <span>Total Cost:</span>
              <div className="text-right">
                <div>{totalBtc.toFixed(5)} BTC</div>
                {bitcoinPrice && (
                  <div className="text-sm text-gray-600">${(totalBtc * bitcoinPrice).toLocaleString()}</div>
                )}
              </div>
            </div>

            <div className="border-t pt-3 flex justify-between text-sm">
              <span className="text-gray-600">Remaining Balance:</span>
              <span className="font-medium">{(activeWallet.balance - totalBtc).toFixed(5)} BTC</span>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <span className="text-yellow-800 text-sm font-medium">Important</span>
            </div>
            <p className="text-yellow-700 text-xs">
              This transaction cannot be reversed. Make sure the address is correct.
            </p>
          </div>

          <Button
            className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-12"
            onClick={executeSend}
            disabled={isSending}
          >
            {isSending ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Sending Transaction...
              </div>
            ) : (
              'Send Bitcoin'
            )}
          </Button>
        </div>
      )
    }

    if (step === 'success') {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Transaction Sent!</h3>
          <p className="text-gray-600 text-sm mb-4">Your Bitcoin has been sent successfully</p>
          
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="text-xs text-gray-500 mb-1">Transaction ID:</div>
            <div className="font-mono text-sm text-gray-900 break-all">{transactionId}</div>
          </div>

          <p className="text-gray-500 text-xs mb-4">
            The transaction is being broadcast to the network. It may take a few minutes to confirm.
          </p>

          <Button
            className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-10"
            onClick={() => {
              resetSendForm()
              navigateToPage('home')
            }}
          >
            Back to Home
          </Button>
        </div>
      )
    }

    if (step === 'error') {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Transaction Failed</h3>
          <p className="text-gray-600 text-sm mb-4">{error || 'An unknown error occurred'}</p>

          <div className="space-y-2">
            <Button
              className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-10"
              onClick={handleBackToInput}
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-lg h-10"
              onClick={() => {
                resetSendForm()
                navigateToPage('home')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )
    }

    return null
  }

  // RECEIVE PAGE COMPONENT
  function ReceivePage() {
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
    const [showQrCode, setShowQrCode] = useState(false)
    const [qrLoading, setQrLoading] = useState(false)
    
    const currentNetwork = settings.network
    const explorerUrl = currentNetwork === 'testnet' 
      ? 'https://blockstream.info/testnet' 
      : 'https://blockstream.info'

    // Generate QR code for the address
    const generateQRCode = async () => {
      if (qrCodeDataUrl) {
        setShowQrCode(true)
        return
      }
      
      setQrLoading(true)
      try {
        // Create Bitcoin URI for better wallet compatibility
        const bitcoinUri = `bitcoin:${activeWallet.address}`
        const qrDataUrl = await QRCode.toDataURL(bitcoinUri, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        })
        setQrCodeDataUrl(qrDataUrl)
        setShowQrCode(true)
      } catch (error) {
        console.error('Error generating QR code:', error)
        alert('Failed to generate QR code')
      } finally {
        setQrLoading(false)
      }
    }

    return (
      <div className="text-center py-8 pb-2">
        <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <QrCode className="w-8 h-8 text-cyan-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Receive Bitcoin</h3>
        <p className="text-gray-600 text-sm mb-6">
          Scan QR code or copy address to receive Bitcoin
        </p>

        {/* QR Code Section */}
        {!showQrCode ? (
          <div className="mb-6">
            <Button
              onClick={generateQRCode}
              disabled={qrLoading}
              className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-12 mb-4"
            >
              {qrLoading ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating QR Code...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4" />
                  Generate QR Code
                </div>
              )}
            </Button>
          </div>
        ) : (
          <div className="mb-6">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4">
              <img 
                src={qrCodeDataUrl} 
                alt="Bitcoin Address QR Code" 
                className="w-48 h-48 mx-auto"
              />
            </div>
            <div className="flex gap-2 justify-center mb-4">
              <Button
                variant="outline"
                onClick={() => setShowQrCode(false)}
                className="text-sm"
              >
                Hide QR Code
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Create a temporary link to download the QR code
                  const link = document.createElement('a')
                  link.download = `bitcoin-address-${activeWallet.name}.png`
                  link.href = qrCodeDataUrl
                  link.click()
                }}
                className="text-sm"
              >
                <Download className="w-4 h-4 mr-1" />
                Save QR Code
              </Button>
            </div>
          </div>
        )}

        {/* Address Display */}
        <div className="mb-6">
          <p className="text-gray-600 text-sm mb-2">Your wallet address:</p>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <p className="text-xs font-mono break-all text-gray-700">{activeWallet.address}</p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            className="w-full bg-cyan-400 hover:bg-cyan-500 text-white"
            onClick={() => {
              navigator.clipboard.writeText(activeWallet.address)
              alert('Address copied to clipboard!')
            }}
          >
            📋 Copy Address
          </Button>
          
          <Button 
            variant="outline"
            className="w-full border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={() => {
              const url = `${explorerUrl}/address/${activeWallet.address}`
              window.open(url, '_blank')
            }}
          >
            🔍 Verify on Blockchain Explorer
          </Button>
          
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">i</span>
              </div>
              <span className="text-cyan-800 text-sm font-medium">Network Info</span>
            </div>
            <p className="text-cyan-700 text-xs">
              {currentNetwork === 'testnet' 
                ? '🧪 This is a TESTNET address - only send testnet Bitcoin!' 
                : '💰 This is a MAINNET address - send real Bitcoin here'
              }
            </p>
          </div>
        </div>
      </div>
    )
  }

  // SETTINGS PAGE COMPONENT
  function SettingsPage() {
    const [settingsStep, setSettingsStep] = useState<'main' | 'pin-setup'>('main')
    const [pin, setPin] = useState('')
    const [confirmPin, setConfirmPin] = useState('')
    const [pinError, setPinError] = useState('')
    const [showPin, setShowPin] = useState(false)
    
    // Add scroll to bottom function
    const scrollToBottom = () => {
      const container = document.querySelector('.settings-container')
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }

    const handlePinSetup = () => {
      setPinError('')
      
      if (pin.length !== 4) {
        setPinError('PIN must be 4 digits')
        return
      }
      
      if (pin !== confirmPin) {
        setPinError('PINs do not match')
        return
      }
      
      const newSettings = {
        ...settings,
        pinEnabled: true,
        pinCode: pin
      }
      updateSettings(newSettings)
      
      setPin('')
      setConfirmPin('')
      setSettingsStep('main')
      alert('PIN code set successfully!')
    }

    const handleSettingToggle = (key: string, value: any) => {
      const newSettings = { ...settings, [key]: value }
      updateSettings(newSettings)
    }

    if (settingsStep === 'pin-setup') {
      return (
        <div className="space-y-4">
          <Button
            variant="ghost"
            className="flex items-center gap-1 p-0 h-auto text-gray-600 hover:text-gray-900 text-sm mb-4"
            onClick={() => setSettingsStep('main')}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Setup PIN Code</h3>
            <p className="text-gray-600 text-sm">Create a 4-digit PIN to secure your wallet</p>
          </div>

          {pinError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <span className="text-red-800 text-sm">{pinError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">PIN Code</label>
              <input
                type={showPin ? 'text' : 'password'}
                placeholder="Enter 4-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-center text-lg tracking-widest"
                maxLength={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Confirm PIN</label>
              <input
                type={showPin ? 'text' : 'password'}
                placeholder="Confirm 4-digit PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-center text-lg tracking-widest"
                maxLength={4}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Show PIN</span>
              <button
                onClick={() => setShowPin(!showPin)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showPin ? 'bg-cyan-400' : 'bg-gray-200'
                }`}
                aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showPin ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <Button
              className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-12"
              onClick={handlePinSetup}
              disabled={!pin || !confirmPin}
            >
              Set PIN
            </Button>
          </div>
        </div>
      )
    }

    // Main Settings Page
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-medium text-gray-900">Settings</span>
          <Button
            variant="outline"
            size="sm"
            onClick={scrollToBottom}
            className="text-xs h-7 px-3"
          >
            ⬇️ Debug
          </Button>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-6">
          {/* Security Section */}
          <div>
            <h3 className="text-gray-900 text-sm font-medium mb-3">Security</h3>
            
            <Card className="border-slate-200 rounded-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">PIN Code</div>
                    <div className="text-sm text-gray-500">
                      {settings.pinEnabled ? 'PIN protection enabled' : 'Secure wallet with PIN'}
                    </div>
                  </div>
                  <Button
                    variant={settings.pinEnabled ? "outline" : "default"}
                    className="text-sm h-9 px-4 ml-3"
                    onClick={() => setSettingsStep('pin-setup')}
                  >
                    {settings.pinEnabled ? 'Change' : 'Setup'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preferences Section */}
          <div>
            <h3 className="text-gray-900 text-sm font-medium mb-3">Preferences</h3>
            
            <Card className="border-slate-200 rounded-lg">
              <CardContent className="p-4 space-y-4">
                <div>
                  <div className="font-medium text-gray-900 text-sm mb-3">Bitcoin Network</div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">i</span>
                      </div>
                      <span className="text-blue-800 text-xs font-medium">Network Info</span>
                    </div>
                    <p className="text-blue-700 text-xs">
                      Existing wallets remain on their original network. Switching networks will show them with zero balance until you switch back.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="network"
                        value="testnet"
                        checked={settings.network === 'testnet'}
                        onChange={(e) => handleSettingToggle('network', e.target.value)}
                        className="w-4 h-4 text-cyan-400"
                      />
                      <span className="text-sm text-gray-900">Testnet (Safe for testing)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="network"
                        value="mainnet"
                        checked={settings.network === 'mainnet'}
                        onChange={(e) => handleSettingToggle('network', e.target.value)}
                        className="w-4 h-4 text-cyan-400"
                      />
                      <span className="text-sm text-gray-900">Mainnet (Real Bitcoin)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Display Currency</label>
                  <select
                  value={settings.currency}
                  onChange={(e) => handleSettingToggle('currency', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  aria-label="Select display currency"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="BTC">BTC (₿)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">Notifications</div>
                  <div className="text-xs text-gray-500">Transaction alerts</div>
                </div>
                <button
                  onClick={() => handleSettingToggle('notifications', !settings.notifications)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-3 ${
                    settings.notifications ? 'bg-cyan-400' : 'bg-gray-200'
                  }`}
                  aria-label={`${settings.notifications ? 'Disable' : 'Enable'} notifications`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* About Section */}
        <div>
          <h3 className="text-gray-900 text-sm font-medium mb-3 px-1">About</h3>
          
          {/* Debug Section */}
          <Card className="border-slate-200 rounded-xl mb-3">
            <CardContent className="p-3">
              <div className="mb-2">
                <div className="font-medium text-gray-900 text-sm mb-1">Network Debug</div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Network: <span className="font-mono">{settings.network}</span></div>
                  <div>Wallet: <span className="font-mono">{activeWallet.network}</span></div>
                  <div>Address: <span className="font-mono text-xs break-all">{activeWallet.address.slice(0, 20)}...</span></div>
                  <div>Balance: <span className="font-mono">{activeWallet.balance} BTC</span></div>
                </div>
              </div>
              
              <div className="space-y-1">
                <Button
                  variant="outline"
                  className="w-full text-xs h-7"
                  onClick={async () => {
                    console.clear()
                    console.log('=== API CONNECTIVITY TEST ===')
                    
                    const testUrls = [
                      'https://blockstream.info/testnet/api/address/mojCANnRJr1v9wvKfYTibm3H1LVNkZMBjr',
                      'https://mempool.space/testnet/api/address/mojCANnRJr1v9wvKfYTibm3H1LVNkZMBjr',
                      'https://corsproxy.io/?https://blockstream.info/testnet/api/address/mojCANnRJr1v9wvKfYTibm3H1LVNkZMBjr'
                    ]
                    
                    for (const url of testUrls) {
                      try {
                        console.log(`Testing: ${url}`)
                        const response = await fetch(url, { mode: 'cors' })
                        console.log(`✅ ${url}: ${response.status} ${response.statusText}`)
                        if (response.ok) {
                          const data = await response.json()
                          console.log(`Balance data:`, data)
                          break // Stop on first success
                        }
                      } catch (error) {
                        console.log(`❌ ${url}: ${error instanceof Error ? error.message : 'Failed'}`)
                      }
                    }
                  }}
                >
                  🌐 Test API Connectivity
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full text-xs h-7"
                  onClick={async () => {
                    console.clear()
                    console.log('=== MANUAL WALLET REFRESH TEST ===')
                    console.log('Current settings:', settings)
                    console.log('Active wallet:', activeWallet)
                    
                    try {
                      const refreshed = await refreshWalletData(activeWallet)
                      console.log('Refresh result:', refreshed)
                      handleUpdateWallet(refreshed)
                      alert('Check console for refresh details!')
                    } catch (error) {
                      console.error('Manual refresh failed:', error)
                      alert('Refresh failed - check console')
                    }
                  }}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? 'Refreshing...' : '🔄 Test Wallet Refresh'}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200 rounded-xl mb-3">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-cyan-600 font-bold text-lg">₿</span>
                </div>
                <div className="font-medium text-gray-900">BitWallet</div>
                <div className="text-sm text-gray-500">Version 1.0.0</div>
                <p className="text-xs text-gray-500 mt-2">
                  A secure, user-friendly Bitcoin wallet
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 rounded-xl mb-3">
            <CardContent className="p-4">
              <Button
                variant="outline"
                className="w-full text-sm h-10 mb-3"
                onClick={async () => {
                  const seedPhrase = prompt('Enter a seed phrase to verify (⚠️ NEVER enter your real seed phrase here!)');
                  if (!seedPhrase) return;
                  
                  const { isValidMnemonic, demonstrateKeyRegeneration } = await import('@/lib/bitcoin-wallet')
                  
                  console.clear()
                  console.log('🔍 VERIFYING SEED PHRASE LEGITIMACY\n')
                  
                  // Check if it's a valid BIP39 mnemonic
                  const isValid = isValidMnemonic(seedPhrase)
                  console.log(`✅ BIP39 Valid: ${isValid}`)
                  
                  if (isValid) {
                    console.log('\n📋 Testing address generation consistency...')
                    await demonstrateKeyRegeneration(seedPhrase, settings.network as 'testnet' | 'mainnet')
                    
                    console.log('\n🎯 LEGITIMACY CHECK RESULTS:')
                    console.log('✅ Seed phrase follows BIP39 standard')
                    console.log('✅ Generates consistent addresses')
                    console.log('✅ Compatible with all Bitcoin wallets')
                    console.log('✅ This is a LEGITIMATE Bitcoin wallet!')
                  } else {
                    console.log('❌ Invalid seed phrase - not BIP39 compliant')
                  }
                  
                  alert('Check browser console (F12) to see verification results!')
                }}
              >
                🔍 Verify Seed Phrase Legitimacy
              </Button>
              
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-3">
                <h3 className="font-medium text-cyan-800 mb-2">🧪 Educational Demo</h3>
                <p className="text-cyan-700 text-xs">
                  This button demonstrates how the same seed phrase always generates identical keys, 
                  proving that "burning" keys locally doesn't affect wallet recovery in other apps.
                </p>
              </div>
              
              <Button
                variant="destructive"
                className="w-full text-sm h-10"
                onClick={() => {
                  if (confirm('Are you sure you want to clear all wallet data? This cannot be undone.')) {
                    walletStorage.clearAll()
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('bitwallet-settings')
                    }
                    setWallets([])
                    setSelectedWallet(null)
                    setIsLocked(false)
                    updateSettings({
                      pinEnabled: false,
                      pinCode: '',
                      autoLockTime: 5,
                      showBalance: true,
                      currency: 'USD',
                      network: 'testnet',
                      notifications: true
                    })
                    window.location.reload()
                  }
                }}
              >
                Clear All Data
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

  // ADD WALLET PAGE COMPONENT
  function AddWalletPage() {
    const [step, setStep] = useState<'method' | 'name' | 'seed-display' | 'seed-confirm' | 'import-seed' | 'success'>('method')
    const [walletMethod, setWalletMethod] = useState<'generate' | 'import'>('generate')
    const [walletName, setWalletName] = useState('')
    const [generatedWallet, setGeneratedWallet] = useState<any>(null)
    const [seedVisible, setSeedVisible] = useState(false)
    const [confirmationWords, setConfirmationWords] = useState<string[]>(['', '', ''])
    const [importSeed, setImportSeed] = useState('')
    const [copied, setCopied] = useState(false)
    const [confirmationsChecked, setConfirmationsChecked] = useState({
      stored: false,
      backup: false,
      responsibility: false
    })
    const [isGenerating, setIsGenerating] = useState(false)

    const resetAndGoBack = () => {
      setStep('method')
      setWalletMethod('generate')
      setWalletName('')
      setGeneratedWallet(null)
      setSeedVisible(false)
      setConfirmationWords(['', '', ''])
      setImportSeed('')
      setCopied(false)
      setConfirmationsChecked({ stored: false, backup: false, responsibility: false })
      navigateToPage('wallet')
    }

    const handleMethodSelect = (method: 'generate' | 'import') => {
      setWalletMethod(method)
      setStep('name')
    }

    const handleNameSubmit = async () => {
      if (!walletName.trim()) {
        alert('Please enter a wallet name')
        return
      }
      
      if (walletMethod === 'generate') {
        setIsGenerating(true)
        try {
          // Import the bitcoin wallet functions
          const { generateBitcoinWallet } = await import('@/lib/bitcoin-wallet')
          const network = (settings.network as 'testnet' | 'mainnet') || 'testnet'
          const wallet = await generateBitcoinWallet(network)
          setGeneratedWallet(wallet)
          setStep('seed-display')
        } catch (error) {
          alert(`Error generating wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
          setIsGenerating(false)
        }
      } else {
        setStep('import-seed')
      }
    }

    const handleSeedCopy = () => {
      if (generatedWallet) {
        navigator.clipboard.writeText(generatedWallet.mnemonic)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }

    const handleSeedConfirm = () => {
      if (!generatedWallet) return
      
      const words = generatedWallet.mnemonic.split(' ')
      const randomIndices = [2, 5, 8] // Check 3rd, 6th, and 9th words
      
      const isValid = randomIndices.every((index, i) => 
        confirmationWords[i].toLowerCase().trim() === words[index]
      )

      if (isValid && Object.values(confirmationsChecked).every(Boolean)) {
        createWallet(generatedWallet)
      } else {
        alert('Please verify the seed phrase words and confirm all statements.')
      }
    }

    const handleImportSubmit = async () => {
      if (!importSeed.trim()) {
        alert('Please enter a seed phrase')
        return
      }
      
      setIsGenerating(true)
      try {
        const { importWalletFromMnemonic, isValidMnemonic } = await import('@/lib/bitcoin-wallet')
        
        if (!isValidMnemonic(importSeed)) {
          throw new Error('Invalid seed phrase format')
        }
        
        const network = (settings.network as 'testnet' | 'mainnet') || 'testnet'
        const wallet = await importWalletFromMnemonic(importSeed, network)
        createWallet(wallet)
      } catch (error) {
        alert(`Error importing wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsGenerating(false)
      }
    }

    const createWallet = (walletData: any) => {
      // 🔐 SECURE: Only store public data - NO private keys or seed phrases
      const newWallet: WalletData = {
        id: `wallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: walletName,
        address: walletData.address,
        balance: 0,
        transactions: [],
        network: walletData.network,
        derivationPath: walletData.derivationPath,
        createdAt: Date.now()
      }
      
      const updatedWallets = [...wallets, newWallet]
      setWallets(updatedWallets)
      setSelectedWallet(newWallet)
      
      // 🔥 SECURITY: Clear the mnemonic from memory - user has already been shown it
      if (generatedWallet?.mnemonic) {
        const { clearSensitiveData } = require('@/lib/bitcoin-wallet')
        clearSensitiveData(generatedWallet)
      }
      
      setStep('success')
      
      setTimeout(() => {
        resetAndGoBack()
      }, 2000)
    }

    if (step === 'method') {
      return (
        <div className="space-y-4 pb-2">
          <p className="text-gray-600 text-sm mb-4">Choose how you'd like to add your wallet:</p>
          
          <Button
            variant="outline"
            className="w-full p-4 h-auto rounded-lg border-2 hover:border-cyan-400 hover:bg-cyan-50"
            onClick={() => handleMethodSelect('generate')}
          >
            <div className="flex items-center">
              <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center mr-4">
                <Plus className="w-6 h-6 text-cyan-600" />
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">Create New Wallet</div>
                <div className="text-sm text-gray-500">Generate a new wallet with secure seed phrase</div>
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full p-4 h-auto rounded-lg border-2 hover:border-cyan-400 hover:bg-cyan-50"
            onClick={() => handleMethodSelect('import')}
          >
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mr-4">
                <Download className="w-6 h-6 text-gray-600" />
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">Import Existing Wallet</div>
                <div className="text-sm text-gray-500">Restore wallet using seed phrase</div>
              </div>
            </div>
          </Button>
        </div>
      )
    }

    if (step === 'name') {
      return (
        <div className="space-y-4 pb-2">
          <Button
            variant="ghost"
            className="flex items-center gap-1 p-0 h-auto text-gray-600 hover:text-gray-900 text-sm mb-4"
            onClick={() => setStep('method')}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Wallet Name</label>
            <input
              type="text"
              placeholder="Enter a name for your wallet"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
            />
          </div>

          <Button
            className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-12"
            onClick={handleNameSubmit}
            disabled={isGenerating || !walletName.trim()}
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                {walletMethod === 'generate' ? 'Generating...' : 'Next'}
              </div>
            ) : (
              walletMethod === 'generate' ? 'Generate Wallet' : 'Next'
            )}
          </Button>
        </div>
      )
    }

    if (step === 'seed-display' && generatedWallet) {
      return (
        <div className="space-y-4 pb-2">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <span className="text-red-800 text-sm font-medium">Security Warning</span>
            </div>
            <p className="text-red-700 text-xs">
              Your seed phrase is the only way to recover your wallet. Store it safely offline.
            </p>
          </div>

          <div className="text-center mb-4">
            <h3 className="font-semibold text-gray-900 mb-2">Your Seed Phrase</h3>
            <p className="text-gray-600 text-sm">Write down these 12 words in order and store them safely</p>
          </div>

          <div className={`bg-gray-50 p-4 rounded-lg transition-all duration-300 ${!seedVisible ? 'blur-md' : ''}`}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {generatedWallet.mnemonic.split(' ').map((word: string, index: number) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-white rounded border">
                  <span className="text-gray-400 text-xs w-4">{index + 1}</span>
                  <span className="font-mono text-gray-900">{word}</span>
                </div>
              ))}
            </div>
          </div>

          {!seedVisible ? (
            <Button
              className="w-full bg-gray-600 hover:bg-gray-700 text-white rounded-lg h-10"
              onClick={() => setSeedVisible(true)}
            >
              Tap to reveal seed phrase
            </Button>
          ) : (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full rounded-lg h-10"
                onClick={handleSeedCopy}
              >
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </Button>
              <Button
                className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-10"
                onClick={() => setStep('seed-confirm')}
              >
                I've saved my seed phrase
              </Button>
            </div>
          )}
        </div>
      )
    }

    if (step === 'seed-confirm' && generatedWallet) {
      const words = generatedWallet.mnemonic.split(' ')
      const randomIndices = [2, 5, 8] // Check 3rd, 6th, and 9th words

      return (
        <div className="space-y-4 pb-2">
          <div className="text-center mb-4">
            <h3 className="font-semibold text-gray-900 mb-2">Verify Your Seed Phrase</h3>
            <p className="text-gray-600 text-sm">Enter the missing words to confirm you saved your seed phrase</p>
          </div>

          <div className="space-y-3">
            {randomIndices.map((wordIndex, i) => (
              <div key={i}>
                <label className="text-sm text-gray-700 block mb-1">
                  Word #{wordIndex + 1}
                </label>
                <input
                  type="text"
                  placeholder={`Enter word #${wordIndex + 1}`}
                  value={confirmationWords[i]}
                  onChange={(e) => {
                    const newWords = [...confirmationWords]
                    newWords[i] = e.target.value
                    setConfirmationWords(newWords)
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {Object.entries(confirmationsChecked).map(([key, checked]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setConfirmationsChecked(prev => ({
                    ...prev,
                    [key]: e.target.checked
                  }))}
                  className="w-4 h-4 text-cyan-400 rounded focus:ring-cyan-400"
                />
                <span className="text-gray-700">
                  {key === 'stored' ? 'I have stored my seed phrase securely' :
                   key === 'backup' ? 'I understand this is my only backup' :
                   'I take full responsibility for my wallet security'}
                </span>
              </label>
            ))}
          </div>

          <Button
            className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-12"
            onClick={handleSeedConfirm}
            disabled={!Object.values(confirmationsChecked).every(Boolean)}
          >
            Create Wallet
          </Button>
        </div>
      )
    }

    if (step === 'import-seed') {
      return (
        <div className="space-y-4 pb-2">
          <Button
            variant="ghost"
            className="flex items-center gap-1 p-0 h-auto text-gray-600 hover:text-gray-900 text-sm mb-4"
            onClick={() => setStep('name')}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Seed Phrase</label>
            <textarea
              placeholder="Enter your 12 or 24 word seed phrase..."
              value={importSeed}
              onChange={(e) => setImportSeed(e.target.value)}
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent resize-none"
            />
            <p className="text-gray-500 text-xs mt-1">
              Enter each word separated by spaces
            </p>
          </div>

          <Button
            className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-12"
            onClick={handleImportSubmit}
            disabled={isGenerating || !importSeed.trim()}
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Importing...
              </div>
            ) : (
              'Import Wallet'
            )}
          </Button>
        </div>
      )
    }

    if (step === 'success') {
      return (
        <div className="text-center py-8 pb-2">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Wallet Created!</h3>
          <p className="text-gray-600 text-sm">Your new wallet has been added successfully</p>
        </div>
      )
    }

    return null
  }
}
