"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Home, 
  Send, 
  Download, 
  Settings, 
  Wallet, 
  Plus, 
  ArrowLeft, 
  RefreshCw,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  EyeOff,
  Check,
  Copy,
  Shield,
  ChevronRight,
  Lock,
  Key
} from 'lucide-react'
import { useBitcoinPrice } from "@/hooks/useBitcoinPrice"
import { useCurrencyRates } from "@/hooks/useCurrencyRates"
import { walletStorage } from "@/lib/storage"
import type { WalletData } from "@/types/wallet"
import Image from 'next/image'

type PageType = 'home' | 'wallet' | 'send' | 'receive' | 'settings' | 'add-wallet' | 'pin-setup'

export default function BitcoinWallet() {
  const { price: bitcoinPrice, change24h, isLoading, error, lastUpdated } = useBitcoinPrice()
  const { rates: currencyRates } = useCurrencyRates()
  
  const [currentPage, setCurrentPage] = useState<PageType>('home')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null)
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [settings, setSettings] = useState({
    pinEnabled: false,
    pinCode: '',
    autoLockTime: 5,
    showBalance: true,
    currency: 'USD',
    network: 'mainnet',
    notifications: true
  })

  // Initialize
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
        setSettings(JSON.parse(savedSettings))
      }
    }
    setIsInitialized(true)
  }, [])

  // Auto-refresh balances when wallets change
  useEffect(() => {
    const refreshBalances = async () => {
      if (wallets.length === 0 || isRefreshing) return
      
      setIsRefreshing(true)
      try {
        const { getBlockchainService } = await import('@/lib/blockchain-service')
        
        const updatedWallets = await Promise.all(
          wallets.map(async (wallet) => {
            try {
              const service = getBlockchainService(wallet.network || 'mainnet')
              const balance = await service.getAddressBalance(wallet.address)
              
              return {
                ...wallet,
                balance: balance.total
              }
            } catch (error) {
              console.error(`Failed to refresh wallet ${wallet.name}:`, error)
              return wallet
            }
          })
        )
        
        // Only update if balances actually changed
        const hasChanges = updatedWallets.some((wallet, index) => 
          wallet.balance !== wallets[index].balance
        )
        
        if (hasChanges) {
          setWallets(updatedWallets)
          walletStorage.saveWallets(updatedWallets)
          
          // Update selected wallet if it exists in updated list
          if (selectedWallet) {
            const updated = updatedWallets.find(w => w.id === selectedWallet.id)
            if (updated) setSelectedWallet(updated)
          }
        }
      } catch (error) {
        console.error('Failed to refresh balances:', error)
      } finally {
        setIsRefreshing(false)
      }
    }

    // Initial refresh after wallet load
    if (wallets.length > 0 && isInitialized) {
      refreshBalances()
    }

    // Set up periodic refresh every 30 seconds
    const interval = setInterval(refreshBalances, 30000)
    
    return () => clearInterval(interval)
  }, [wallets.length, isInitialized]) // Depend on wallet count and initialization

  // Helper functions
  const navigateToPage = (page: PageType) => {
    console.log('🔥 navigateToPage called with:', page, 'current page:', currentPage)
    
    if (page === currentPage) {
      console.log('🔥 Same page, returning early')
      return
    }
    
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentPage(page)
      setTimeout(() => {
        setIsTransitioning(false)
      }, 100)
    }, 150)
  }

  const updateSettings = (newSettings: any) => {
    setSettings(newSettings)
    if (typeof window !== 'undefined') {
      localStorage.setItem('rabbit-wallet-settings', JSON.stringify(newSettings))
    }
  }

  const handleSettingToggle = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    updateSettings(newSettings)
  }

  const formatCurrency = (amount: number, currency: string = settings.currency, showSymbol = true) => {
    if (currency === 'BTC') {
      return `${showSymbol ? '₿ ' : ''}${amount.toFixed(6)}`
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

  // Calculate totals
  const activeWallet = selectedWallet || wallets[0]
  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0)
  const totalValueUSD = bitcoinPrice ? totalBalance * bitcoinPrice : 0
  const isPositive = change24h ? change24h >= 0 : true

  // Component functions - defined BEFORE the main return
  function HomePage() {
    if (!activeWallet) return <div>No wallet available</div>

    return (
      <div className="space-y-3">
        {/* Active Wallet Selector */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-3 shadow-sm border border-gray-100">
          <button
            className="w-full flex items-center justify-between p-0 text-left"
            onClick={() => navigateToPage('wallet')}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-full flex items-center justify-center">
                <Wallet className="w-4 h-4 text-cyan-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900 text-sm">{activeWallet.name}</div>
                <div className="text-xs text-gray-500">{activeWallet.balance.toFixed(6)} BTC</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-6 shadow-lg">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-400 text-xs font-medium">Total Balance</span>
              {isRefreshing && (
                <RefreshCw className="w-3 h-3 animate-spin text-gray-500" />
              )}
            </div>
            <div className="text-white text-3xl font-light tracking-tight">
              {!settings.showBalance ? (
                <span>••••••</span>
              ) : isLoading ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span className="text-lg">Loading...</span>
                </div>
              ) : error ? (
                <div className="text-red-400 text-base">Error loading</div>
              ) : (
                <span>{formatCurrency(totalValueUSD)}</span>
              )}
            </div>
          </div>
          
          <div className="flex justify-between items-end">
            <div>
              <div className="text-gray-400 text-xs mb-1">Bitcoin Holdings</div>
              <div className="text-white text-sm font-medium">
                {settings.showBalance ? `${totalBalance.toFixed(6)} BTC` : '••••••'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-xs mb-1">24h Change</div>
              <div className={`text-sm font-medium ${isPositive ? 'text-cyan-400' : 'text-red-400'}`}>
                {change24h ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` : '...'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-2xl h-14 text-sm font-medium shadow-sm active:scale-95 transition-transform"
            onClick={() => navigateToPage('receive')}
          >
            <div className="flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              <span>Receive</span>
            </div>
          </button>
          <button
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-2xl h-14 text-sm font-medium shadow-sm active:scale-95 transition-all"
            onClick={() => navigateToPage('send')}
          >
            <div className="flex items-center justify-center gap-2">
              <Send className="w-4 h-4" />
              <span>Send</span>
            </div>
          </button>
        </div>

        {/* Recent Transactions */}
        <div className="mt-6">
          <h3 className="text-gray-900 text-sm font-medium mb-3 px-1">Recent</h3>
          <div className="space-y-2">
            {activeWallet.transactions?.slice(0, 5).map((tx, i) => (
              <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl p-3 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.type === "received" ? "bg-cyan-50" : "bg-gray-50"
                    }`}>
                      {tx.type === "received" ? (
                        <ArrowDownLeft className="w-4 h-4 text-cyan-600" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm capitalize">{tx.type}</div>
                      <div className="text-xs text-gray-500">{tx.date}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900 text-sm">
                      {tx.type === "received" ? "+" : "-"}{tx.amount.toFixed(6)} BTC
                    </div>
                    <div className={`text-xs ${tx.status === "completed" ? "text-cyan-500" : "text-gray-500"}`}>
                      {tx.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {(!activeWallet.transactions || activeWallet.transactions.length === 0) && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                <div className="text-gray-500 text-sm">No transactions yet</div>
                <div className="text-gray-400 text-xs mt-1">Your transactions will appear here</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

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

    console.log('🎯 AddWalletPage function called and rendering, step:', step)

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
      navigateToPage('home')
    }

    const handleMethodSelect = (method: 'generate' | 'import') => {
      console.log('Method selected:', method)
      setWalletMethod(method)
      setStep('name')
    }

    const handleNameSubmit = async () => {
      console.log('Name submit, method:', walletMethod, 'name:', walletName)
      
      if (!walletName.trim()) {
        alert('Please enter a wallet name')
        return
      }
      
      if (walletMethod === 'generate') {
        setIsGenerating(true)
        try {
          console.log('Generating wallet...')
          const network = 'mainnet'
          
          // Import the wallet generation functions
          const { generateBitcoinWallet } = await import('@/lib/bitcoin-wallet')
          const wallet = await generateBitcoinWallet(network)
          console.log('Wallet generated:', wallet)
          setGeneratedWallet(wallet)
          setStep('seed-display')
        } catch (error) {
          console.error('Error generating wallet:', error)
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
        const { isValidMnemonic, importWalletFromMnemonic } = await import('@/lib/bitcoin-wallet')
        
        if (!isValidMnemonic(importSeed)) {
          throw new Error('Invalid seed phrase format')
        }
        
        const network = 'mainnet'
        const wallet = await importWalletFromMnemonic(importSeed, network)
        createWallet(wallet)
      } catch (error) {
        console.error('Error importing wallet:', error)
        alert(`Error importing wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsGenerating(false)
      }
    }

    const createWallet = (walletData: any) => {
      console.log('Creating wallet with data:', walletData)
      
      // Create new wallet object
      const newWallet = {
        id: `wallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: walletName,
        address: walletData.address,
        balance: 0,
        transactions: [],
        network: walletData.network,
        derivationPath: walletData.derivationPath,
        createdAt: Date.now()
      }
      
      console.log('New wallet created:', newWallet)
      
      const updatedWallets = [...wallets, newWallet]
      setWallets(updatedWallets)
      setSelectedWallet(newWallet)
      
      // Save to localStorage
      walletStorage.saveWallets(updatedWallets)
      
      setStep('success')
      
      setTimeout(() => {
        resetAndGoBack()
      }, 2000)
    }

    // Method selection step
    if (step === 'method') {
      console.log('Rendering method selection')
      return (
        <div className="space-y-3 pb-2">
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Plus className="w-6 h-6 text-cyan-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Add New Wallet</h2>
            <p className="text-gray-600 text-xs">Choose how you'd like to add your wallet</p>
          </div>
          
          <Button
            variant="outline"
            className="w-full p-3 h-auto rounded-2xl border border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/50 active:scale-95 transition-all"
            onClick={() => handleMethodSelect('generate')}
          >
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-xl flex items-center justify-center mr-3">
                <Plus className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900 text-sm">Create New Wallet</div>
                <div className="text-xs text-gray-500 leading-tight">Generate a new wallet with<br />secure seed phrase</div>
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full p-3 h-auto rounded-2xl border border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/50 active:scale-95 transition-all"
            onClick={() => handleMethodSelect('import')}
          >
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center mr-3">
                <Download className="w-4 h-4 text-gray-600" />
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900 text-sm">Import Existing Wallet</div>
                <div className="text-xs text-gray-500">Restore wallet using seed phrase</div>
              </div>
            </div>
          </Button>
        </div>
      )
    }

    // Name input step
    if (step === 'name') {
      console.log('Rendering name input')
      return (
        <div className="space-y-3 pb-2">
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Wallet className="w-6 h-6 text-cyan-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Name Your Wallet</h2>
            <p className="text-gray-600 text-xs">Choose a name to identify this wallet</p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">Wallet Name</label>
            <input
              type="text"
              placeholder="Enter a name for your wallet"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent bg-white"
              autoFocus
            />
          </div>

          <Button
            className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-2xl h-11 text-sm font-medium active:scale-95 transition-all"
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

    // Seed phrase display step (for new wallets)
    if (step === 'seed-display') {
      console.log('Rendering seed display')
      return (
        <div className="space-y-3 pb-2">
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Your Seed Phrase</h2>
            <p className="text-gray-600 text-xs">Write down these 12 words in order and store them safely</p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <span className="text-red-800 text-xs font-medium">Critical Security Warning</span>
            </div>
            <ul className="text-red-700 text-xs space-y-0.5">
              <li>• This is the ONLY way to recover your Bitcoin</li>
              <li>• Anyone with this phrase can steal your funds</li>
              <li>• We never store these words - only you have them</li>
              <li>• Losing this phrase means losing your Bitcoin forever</li>
            </ul>
          </div>

          {generatedWallet && (
            <div className="bg-gray-50 rounded-2xl p-3 mb-3">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-medium text-gray-700">Seed Phrase</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSeedVisible(!seedVisible)}
                  className="text-xs h-7 px-2"
                >
                  {seedVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {seedVisible ? 'Hide' : 'Show'}
                </Button>
              </div>
              
              {seedVisible ? (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {generatedWallet.mnemonic.split(' ').map((word: string, i: number) => (
                    <div key={i} className="bg-white rounded-xl p-2 text-center border border-gray-200">
                      <div className="text-xs text-gray-500">{i + 1}</div>
                      <div className="font-mono text-xs font-medium">{word}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Eye className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-xs">Click "Show" to view your seed phrase</p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full text-xs h-9 rounded-xl border-gray-200 hover:bg-gray-100"
                onClick={handleSeedCopy}
                disabled={!seedVisible}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-2" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
            </div>
          )}

          <Button
            className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-2xl h-11 text-sm font-medium active:scale-95 transition-all"
            onClick={() => setStep('seed-confirm')}
            disabled={!seedVisible}
          >
            I've Stored My Seed Phrase Safely
          </Button>
        </div>
      )
    }

    // Seed phrase confirmation step
    if (step === 'seed-confirm') {
      console.log('Rendering seed confirmation')
      const words = generatedWallet?.mnemonic.split(' ') || []
      const randomIndices = [2, 5, 8] // Check 3rd, 6th, and 9th words
      
      return (
        <div className="space-y-3 pb-2">
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-cyan-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-cyan-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Confirm Your Seed Phrase</h2>
            <p className="text-gray-600 text-xs">Enter the requested words to verify you wrote them down correctly</p>
          </div>

          <div className="space-y-3 mb-4">
            {randomIndices.map((wordIndex, i) => (
              <div key={i}>
                <label className="text-xs font-medium text-gray-700 block mb-1">
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
                  className="w-full p-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent bg-white"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2 mb-4">
            {[
              { key: 'stored', text: 'I have written down my seed phrase and stored it safely' },
              { key: 'backup', text: 'I understand this is the only way to recover my wallet' },
              { key: 'responsibility', text: 'I take full responsibility for keeping my seed phrase secure' }
            ].map(({ key, text }) => (
              <label key={key} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmationsChecked[key as keyof typeof confirmationsChecked]}
                  onChange={(e) => setConfirmationsChecked({
                    ...confirmationsChecked,
                    [key]: e.target.checked
                  })}
                  className="mt-0.5 w-4 h-4 text-cyan-600 rounded focus:ring-cyan-400"
                />
                <span className="text-xs text-gray-700">{text}</span>
              </label>
            ))}
          </div>

          <Button
            className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-2xl h-11 text-sm font-medium active:scale-95 transition-all"
            onClick={handleSeedConfirm}
            disabled={
              !randomIndices.every((index, i) => 
                confirmationWords[i].toLowerCase().trim() === words[index]
              ) || !Object.values(confirmationsChecked).every(Boolean)
            }
          >
            Create Wallet
          </Button>
        </div>
      )
    }

    // Import seed phrase step
    if (step === 'import-seed') {
      console.log('Rendering import seed')
      return (
        <div className="space-y-3 pb-2">
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Download className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Import Wallet</h2>
            <p className="text-gray-600 text-xs">Enter your existing seed phrase to restore your wallet</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">i</span>
              </div>
              <span className="text-blue-800 text-xs font-medium">Import Instructions</span>
            </div>
            <ul className="text-blue-700 text-xs space-y-0.5">
              <li>• Enter your 12 or 24 word seed phrase</li>
              <li>• Separate each word with a space</li>
              <li>• Make sure the words are in the correct order</li>
              <li>• This will restore all associated addresses and funds</li>
            </ul>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">Seed Phrase</label>
            <textarea
              placeholder="Enter your seed phrase (12 or 24 words)..."
              value={importSeed}
              onChange={(e) => setImportSeed(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent font-mono resize-none bg-white"
              rows={3}
            />
          </div>

          <Button
            className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-2xl h-11 text-sm font-medium active:scale-95 transition-all"
            onClick={handleImportSubmit}
            disabled={isGenerating || !importSeed.trim()}
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Importing Wallet...
              </div>
            ) : (
              'Import Wallet'
            )}
          </Button>
        </div>
      )
    }

    // Success step
    if (step === 'success') {
      return (
        <div className="text-center py-6 pb-2">
          <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Wallet Created!</h3>
          <p className="text-gray-600 text-xs mb-3">Your new wallet "{walletName}" has been added successfully</p>
          
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 mb-3">
            <p className="text-green-800 text-xs">
              🎉 You can now send and receive Bitcoin with your new wallet
            </p>
          </div>
        </div>
      )
    }

    // Default fallback
    return (
      <div className="space-y-4 pb-2">
        <div className="text-center">
          <p className="text-gray-600">Loading wallet creation...</p>
        </div>
      </div>
    )
  }

  function WalletPage() { 
    const [isRefreshingBalances, setIsRefreshingBalances] = useState(false)
    const [exportWalletId, setExportWalletId] = useState<string | null>(null)
    const [exportMnemonic, setExportMnemonic] = useState('')
    const [exportedKey, setExportedKey] = useState('')
    const [isExporting, setIsExporting] = useState(false)

    const refreshWalletBalances = async () => {
      if (wallets.length === 0) return
      
      setIsRefreshingBalances(true)
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
        setIsRefreshingBalances(false)
      }
    }

    const exportPrivateKey = async (wallet: WalletData) => {
      if (!exportMnemonic.trim()) {
        alert('Please enter your seed phrase')
        return
      }

      setIsExporting(true)
      try {
        const { exportPrivateKey: exportKey } = await import('@/lib/bitcoin-wallet')
        const result = await exportKey(
          exportMnemonic,
          wallet.derivationPath || "m/44'/0'/0'/0/0",
          wallet.network || 'mainnet',
          wallet.address
        )
        setExportedKey(result.privateKey)
      } catch (error) {
        alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsExporting(false)
      }
    }
    
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 px-1">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Wallets</h2>
            <p className="text-sm text-gray-500">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={refreshWalletBalances}
            disabled={isRefreshingBalances}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
            aria-label="Refresh wallet balances"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${isRefreshingBalances ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Scrollable wallet list */}
        <div className="flex-1 overflow-y-auto space-y-3 -mx-4 px-4">
          {wallets.map((wallet) => (
            <div key={wallet.id} className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border transition-all ${
              selectedWallet?.id === wallet.id 
                ? 'border-cyan-200 bg-cyan-50/80' 
                : 'border-gray-100 hover:border-gray-200'
            }`}>
              <button
                className="w-full p-4 text-left"
                onClick={() => setSelectedWallet(wallet)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      selectedWallet?.id === wallet.id 
                        ? 'bg-gradient-to-br from-cyan-100 to-cyan-200' 
                        : 'bg-gradient-to-br from-gray-100 to-gray-200'
                    }`}>
                      <Wallet className={`w-5 h-5 ${
                        selectedWallet?.id === wallet.id ? 'text-cyan-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{wallet.name}</div>
                      <div className="text-sm text-gray-500">{wallet.balance.toFixed(6)} BTC</div>
                      <div className="text-xs text-gray-400">
                        {bitcoinPrice ? formatCurrency(wallet.balance * bitcoinPrice) : '...'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 capitalize">{wallet.network}</div>
                    <div className="text-xs text-gray-400">
                      {wallet.transactions?.length || 0} txs
                    </div>
                    {selectedWallet?.id === wallet.id && (
                      <div className="w-2 h-2 bg-cyan-500 rounded-full mt-1 ml-auto"></div>
                    )}
                  </div>
                </div>
              </button>
              
              {/* Export button for each wallet */}
              <div className="px-4 pb-4">
                <button
                  onClick={() => setExportWalletId(wallet.id)}
                  className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl py-2 text-xs font-medium active:scale-95 transition-all"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Key className="w-3 h-3" />
                    <span>Export Private Key</span>
                  </div>
                </button>
              </div>
            </div>
          ))}

          {wallets.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Wallets Yet</h3>
              <p className="text-gray-500 text-sm mb-6">Create your first Bitcoin wallet to get started</p>
            </div>
          )}
        </div>

        {/* Add wallet button - fixed at bottom */}
        <div className="pt-4 mt-4 border-t border-gray-100">
          <button
            className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-2xl h-12 text-sm font-medium shadow-sm active:scale-95 transition-transform"
            onClick={() => navigateToPage('add-wallet')}
          >
            <div className="flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Add Wallet</span>
            </div>
          </button>
        </div>

        {/* Export Modal */}
        {exportWalletId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Export Private Key</h3>
                  <button
                    onClick={() => {
                      setExportWalletId(null)
                      setExportMnemonic('')
                      setExportedKey('')
                    }}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <span className="text-gray-600">✕</span>
                  </button>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
                  <div className="text-red-800 text-sm">
                    <strong>⚠️ Security Warning</strong><br />
                    Never share your private key. Anyone with access can steal your Bitcoin.
                  </div>
                </div>

                {!exportedKey ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Seed Phrase for {wallets.find(w => w.id === exportWalletId)?.name}
                      </label>
                      <textarea
                        placeholder="Enter your 12 or 24 word seed phrase..."
                        value={exportMnemonic}
                        onChange={(e) => setExportMnemonic(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent font-mono resize-none"
                        rows={3}
                      />
                    </div>

                    <button
                      className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-2xl h-12 text-sm font-medium disabled:opacity-50 active:scale-95 transition-all"
                      onClick={() => {
                        const wallet = wallets.find(w => w.id === exportWalletId)
                        if (wallet) exportPrivateKey(wallet)
                      }}
                      disabled={isExporting || !exportMnemonic.trim()}
                    >
                      {isExporting ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Exporting...</span>
                        </div>
                      ) : (
                        'Export Private Key'
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Private Key
                      </label>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-xs break-all">
                        {exportedKey}
                      </div>
                    </div>

                    <button
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-2xl h-12 text-sm font-medium active:scale-95 transition-all"
                      onClick={() => {
                        navigator.clipboard.writeText(exportedKey)
                        alert('Private key copied to clipboard')
                      }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Copy className="w-4 h-4" />
                        <span>Copy Private Key</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
  
  function SendPage() { 
    const [recipientAddress, setRecipientAddress] = useState('')
    const [amount, setAmount] = useState('')
    const [amountUSD, setAmountUSD] = useState('')
    const [useUSD, setUseUSD] = useState(false)
    const [fee, setFee] = useState(10) // sat/vbyte - now automatic
    const [mnemonic, setMnemonic] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [showSeedInput, setShowSeedInput] = useState(false)
    const [txResult, setTxResult] = useState<any>(null)
    const [error, setError] = useState('')
    const [addressError, setAddressError] = useState('')
    const [estimatedFee, setEstimatedFee] = useState(0)

    // Get automatic fee rate
    const getAutomaticFeeRate = async () => {
      try {
        const { getBlockchainService } = await import('@/lib/blockchain-service')
        const service = getBlockchainService(activeWallet?.network || 'mainnet')
        const feeEstimates = await service.getFeeEstimates()
        
        // Use halfHourFee for reasonable speed and cost balance
        return feeEstimates.halfHourFee || 10
      } catch (error) {
        console.error('Failed to get fee estimates:', error)
        return 10 // Fallback fee rate
      }
    }

    // Validate Bitcoin address format and network compatibility
    const validateAddress = (address: string) => {
      if (!address.trim()) {
        setAddressError('')
        return false
      }

      const network = activeWallet?.network || 'mainnet'
      
      // Address format validation
      const testnetP2PKH = /^[mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/
      const testnetBech32 = /^tb1[a-z0-9]{39,59}$/
      const mainnetP2PKH = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/
      const mainnetBech32 = /^bc1[a-z0-9]{39,59}$/
      
      const isTestnetAddress = testnetP2PKH.test(address) || testnetBech32.test(address)
      const isMainnetAddress = mainnetP2PKH.test(address) || mainnetBech32.test(address)
      
      if (network === 'testnet' && isMainnetAddress) {
        setAddressError('Cannot send to mainnet address from testnet wallet')
        return false
      }
      
      if (network === 'mainnet' && isTestnetAddress) {
        setAddressError('Cannot send to testnet address from mainnet wallet')
        return false
      }
      
      if (!isTestnetAddress && !isMainnetAddress) {
        setAddressError('Invalid Bitcoin address format')
        return false
      }

      // Check if sending to same address
      if (address === activeWallet?.address) {
        setAddressError('Cannot send to your own address')
        return false
      }
      
      setAddressError('')
      return true
    }

    // Estimate transaction fee
    const estimateTransactionFee = async () => {
      if (!activeWallet || !amount) return

      try {
        const { getBlockchainService } = await import('@/lib/blockchain-service')
        const service = getBlockchainService(activeWallet.network || 'mainnet')
        const utxos = await service.getAddressUTXOs(activeWallet.address)
        
        // Get current network fee rate
        const currentFeeRate = await getAutomaticFeeRate()
        setFee(currentFeeRate)
        
        // Simple fee estimation: assume 1 input + 2 outputs (recipient + change)
        const estimatedSize = (utxos.length * 148) + (2 * 34) + 10 // rough estimate in bytes
        const estimatedFeeAmount = (estimatedSize * currentFeeRate) / 100000000 // Convert to BTC
        
        setEstimatedFee(estimatedFeeAmount)
      } catch (error) {
        console.error('Fee estimation failed:', error)
      }
    }

    // Update fee estimation when amount changes
    React.useEffect(() => {
      estimateTransactionFee()
    }, [amount, activeWallet])

    const sendTransaction = async () => {
      console.log('🚀 sendTransaction started')
      
      if (!activeWallet || !mnemonic.trim()) {
        setError('Please enter your seed phrase')
        return
      }

      // Validate address before sending
      if (!validateAddress(recipientAddress)) {
        setError('Please fix the address error before sending')
        return
      }

      const amountBTC = useUSD && bitcoinPrice ? parseFloat(amountUSD) / bitcoinPrice : parseFloat(amount)
      console.log('💰 Transaction details:', {
        amountBTC,
        recipientAddress,
        estimatedFee,
        walletBalance: activeWallet.balance
      })
      
      // Check if amount + estimated fee exceeds balance
      if (amountBTC + estimatedFee > activeWallet.balance) {
        setError(`Insufficient funds. Balance: ${activeWallet.balance.toFixed(6)} BTC, Required: ${(amountBTC + estimatedFee).toFixed(6)} BTC (including estimated fee)`)
        return
      }

      setIsSending(true)
      setError('')
      
      try {
        console.log('🔍 Importing transaction signer...')
        const { createTransactionSigner } = await import('@/lib/transaction-signer')
        
        console.log('🔍 Importing wallet functions...')
        const { isValidMnemonic } = await import('@/lib/bitcoin-wallet')
        
        console.log('🔐 Validating mnemonic...')
        if (!isValidMnemonic(mnemonic)) {
          throw new Error('Invalid seed phrase format')
        }

        console.log('⚙️ Creating transaction signer...')
        const signer = createTransactionSigner(activeWallet.network || 'mainnet')
        
        console.log('📝 Creating and signing transaction...')
        const signedTx = await signer.createAndSignTransaction(
          mnemonic,
          activeWallet.derivationPath || "m/44'/0'/0'/0/0",
          recipientAddress,
          amountBTC,
          fee,
          activeWallet.address
        )

        console.log('✅ Transaction signed successfully:', signedTx.txid)

        console.log('📡 Broadcasting transaction...')
        const { getBlockchainService } = await import('@/lib/blockchain-service')
        const service = getBlockchainService(activeWallet.network || 'mainnet')
        const txid = await service.broadcastTransaction(signedTx.txHex)

        console.log('🎉 Transaction broadcast successful:', txid)
        setTxResult({ txid, amount: amountBTC, recipient: recipientAddress, fee: signedTx.fee / 100000000 })
        
        // Clear sensitive data only on success
        setMnemonic('')
        setRecipientAddress('')
        setAmount('')
        setAmountUSD('')
        setShowSeedInput(false) // Hide seed input on success

        // Refresh wallet balance after a delay
        setTimeout(() => {
          if (activeWallet) {
            service.getAddressBalance(activeWallet.address).then(balance => {
              const updatedWallets = wallets.map(w => 
                w.id === activeWallet.id ? { ...w, balance: balance.total } : w
              )
              setWallets(updatedWallets)
              setSelectedWallet({ ...activeWallet, balance: balance.total })
              walletStorage.saveWallets(updatedWallets)
            }).catch(console.error)
          }
        }, 2000)

      } catch (error) {
        console.error('❌ Transaction failed with full error details:', error)
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
        
        const errorMessage = error instanceof Error ? error.message : 'Transaction failed'
        console.log('💬 Error message to show user:', errorMessage)
        
        // Provide more helpful error messages
        if (errorMessage.includes('Insufficient funds')) {
          setError('Insufficient funds for this transaction including network fees')
        } else if (errorMessage.includes('No UTXOs')) {
          setError('No available funds to spend. Please wait for previous transactions to confirm.')
        } else if (errorMessage.includes('Invalid address')) {
          setError('Invalid recipient address format')
        } else if (errorMessage.includes('broadcast')) {
          setError('Failed to broadcast transaction. Please check your network connection and try again.')
        } else if (errorMessage.includes('hmacSha256Sync')) {
          setError('Cryptographic error. Please refresh the page and try again.')
        } else if (errorMessage.includes('Invalid seed phrase')) {
          setError('Invalid seed phrase. Please check your seed phrase and try again.')
        } else if (errorMessage.includes('decode')) {
          setError('Failed to decode address. Please check the recipient address.')
        } else {
          setError(`Transaction failed: ${errorMessage}`)
        }
      } finally {
        setIsSending(false)
        // Don't clear mnemonic here automatically to prevent the disappearing issue
        console.log('🏁 Transaction process completed')
      }
    }

    const canSend = recipientAddress.trim() && 
                   amount && 
                   parseFloat(amount) > 0 && 
                   activeWallet && 
                   parseFloat(amount) <= activeWallet.balance &&
                   !addressError

    if (!activeWallet) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Send className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">No wallet selected</p>
          </div>
        </div>
      )
    }

    // Success state
    if (txResult) {
      return (
        <div className="h-full flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sent Successfully!</h3>
            <p className="text-gray-500 text-sm mb-6">Your Bitcoin has been sent</p>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-gray-100">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium">{txResult.amount.toFixed(6)} BTC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fee</span>
                  <span className="font-medium">{txResult.fee.toFixed(6)} BTC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">TX ID</span>
                  <span className="font-mono text-xs">{txResult.txid.slice(0,8)}...{txResult.txid.slice(-8)}</span>
                </div>
              </div>
            </div>

            <button
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-2xl h-12 text-sm font-medium active:scale-95 transition-all"
              onClick={() => {
                setTxResult(null)
                setShowSeedInput(false)
              }}
            >
              Send Another
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="h-full flex flex-col">
        {/* Wallet Info */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">{activeWallet.name}</div>
              <div className="text-xs text-gray-500">{activeWallet.balance.toFixed(6)} BTC available</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {bitcoinPrice ? formatCurrency(activeWallet.balance * bitcoinPrice) : '...'}
              </div>
              <div className="text-xs text-gray-500">Balance</div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 space-y-4">
          {/* Recipient */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-100">
            <label className="text-sm font-medium text-gray-700 block mb-2">To</label>
            <input
              type="text"
              placeholder="Bitcoin address"
              value={recipientAddress}
              onChange={(e) => {
                setRecipientAddress(e.target.value)
                validateAddress(e.target.value)
              }}
              className={`w-full text-sm bg-transparent border-0 outline-0 font-mono placeholder-gray-400 ${
                addressError ? 'text-red-600' : ''
              }`}
            />
            {addressError && (
              <p className="text-red-500 text-xs mt-1">{addressError}</p>
            )}
          </div>

          {/* Amount */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Amount</label>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setUseUSD(false)}
                  className={`px-3 py-1 text-xs font-medium rounded ${
                    !useUSD ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  BTC
                </button>
                <button
                  onClick={() => setUseUSD(true)}
                  className={`px-3 py-1 text-xs font-medium rounded ${
                    useUSD ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                  disabled={!bitcoinPrice}
                >
                  USD
                </button>
              </div>
            </div>
            
            <input
              type="number"
              placeholder={useUSD ? "0.00" : "0.00000000"}
              value={useUSD ? amountUSD : amount}
              onChange={(e) => {
                if (useUSD) {
                  setAmountUSD(e.target.value)
                  if (bitcoinPrice && e.target.value) {
                    setAmount((parseFloat(e.target.value) / bitcoinPrice).toString())
                  }
                } else {
                  setAmount(e.target.value)
                  if (bitcoinPrice && e.target.value) {
                    setAmountUSD((parseFloat(e.target.value) * bitcoinPrice).toString())
                  }
                }
              }}
              className="w-full text-lg font-medium bg-transparent border-0 outline-0 placeholder-gray-400"
            />
            
            {amount && bitcoinPrice && (
              <div className="text-xs text-gray-500 mt-1">
                ≈ {useUSD ? `${parseFloat(amount).toFixed(6)} BTC` : formatCurrency(parseFloat(amount) * bitcoinPrice)}
                {estimatedFee > 0 && (
                  <span className="ml-2 text-cyan-600">
                    + {estimatedFee.toFixed(6)} BTC network fee
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Network Fee Info */}
          {estimatedFee > 0 && (
            <div className="bg-cyan-50/80 backdrop-blur-sm rounded-2xl p-4 border border-cyan-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-cyan-800">Network Fee</div>
                  <div className="text-xs text-cyan-600">Automatic • {fee} sat/vB</div>
                </div>
                <div className="text-sm font-medium text-cyan-800">
                  {estimatedFee.toFixed(6)} BTC
                </div>
              </div>
            </div>
          )}

          {/* Send Button */}
          {canSend && !showSeedInput && (
            <button
              onClick={() => setShowSeedInput(true)}
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-2xl h-12 text-sm font-medium active:scale-95 transition-all"
            >
              Continue
            </button>
          )}

          {/* Seed Input */}
          {showSeedInput && (
            <div className="space-y-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-100">
                <label className="text-sm font-medium text-gray-700 block mb-2">Seed Phrase</label>
                <textarea
                  placeholder="Enter your seed phrase to sign the transaction..."
                  value={mnemonic}
                  onChange={(e) => setMnemonic(e.target.value)}
                  className="w-full h-20 text-sm bg-transparent border-0 outline-0 font-mono placeholder-gray-400 resize-none"
                  rows={3}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-3">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSeedInput(false)}
                  className="flex-1 bg-gray-100 text-gray-700 rounded-2xl h-12 text-sm font-medium active:scale-95 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={sendTransaction}
                  disabled={!mnemonic.trim() || isSending}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-2xl h-12 text-sm font-medium disabled:opacity-50 active:scale-95 transition-all"
                >
                  {isSending ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </div>
                  ) : (
                    'Send Bitcoin'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
  
  function ReceivePage() { 
    const [copied, setCopied] = useState(false)

    const copyAddress = () => {
      if (activeWallet) {
        navigator.clipboard.writeText(activeWallet.address)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }

    if (!activeWallet) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Download className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">No wallet selected</p>
          </div>
        </div>
      )
    }

    return (
      <div className="h-full flex flex-col">
        {/* Wallet Info */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">{activeWallet.name}</div>
              <div className="text-xs text-gray-500 capitalize">{activeWallet.network} Network</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{activeWallet.balance.toFixed(6)} BTC</div>
              <div className="text-xs text-gray-500">Current Balance</div>
            </div>
          </div>
        </div>

        {/* QR Code Area */}
        <div className="flex-1 flex items-center justify-center mb-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-gray-100 text-center max-w-sm w-full">
            {/* QR Code Placeholder */}
            <div className="w-48 h-48 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl mx-auto mb-6 flex items-center justify-center border-2 border-dashed border-gray-200">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <div className="grid grid-cols-3 gap-1">
                    {Array.from({length: 9}).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-sm ${Math.random() > 0.5 ? 'bg-cyan-600' : 'bg-cyan-200'}`}></div>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-gray-500">QR Code</div>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">Receive Bitcoin</h3>
            <p className="text-gray-500 text-sm mb-6">Share this address to receive payments</p>
          </div>
        </div>

        {/* Address Section */}
        <div className="space-y-3">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-100">
            <label className="text-sm font-medium text-gray-700 block mb-3">Your Bitcoin Address</label>
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <div className="font-mono text-sm break-all text-gray-900">{activeWallet.address}</div>
            </div>
            
            <button
              onClick={copyAddress}
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-2xl h-12 text-sm font-medium active:scale-95 transition-all"
            >
              {copied ? (
                <div className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Copy className="w-4 h-4" />
                  <span>Copy Address</span>
                </div>
              )}
            </button>
          </div>

          {/* Info Card */}
          <div className="bg-cyan-50/80 backdrop-blur-sm rounded-2xl p-4 border border-cyan-100">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-cyan-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-cyan-600 text-xs font-bold">i</span>
              </div>
              <div className="space-y-1">
                <div className="text-cyan-800 text-sm font-medium">Receiving Tips</div>
                <div className="text-cyan-700 text-xs space-y-1">
                  <div>• Only send {activeWallet.network} Bitcoin to this address</div>
                  <div>• Transactions typically confirm in 10-60 minutes</div>
                  <div>• This address is safe to share publicly</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  function SettingsPage() { 
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [showExportModal, setShowExportModal] = useState(false)
    const [exportMnemonic, setExportMnemonic] = useState('')
    const [exportedKey, setExportedKey] = useState('')
    const [isExporting, setIsExporting] = useState(false)

    const exportPrivateKey = async () => {
      if (!activeWallet || !exportMnemonic.trim()) {
        setExportedKey('')
        return
      }

      setIsExporting(true)
      try {
        const { exportPrivateKey: exportKey } = await import('@/lib/bitcoin-wallet')
        const result = await exportKey(
          exportMnemonic,
          activeWallet.derivationPath || "m/44'/0'/0'/0/0",
          activeWallet.network || 'mainnet',
          activeWallet.address
        )
        setExportedKey(result.privateKey)
      } catch (error) {
        setExportedKey('Error: ' + (error instanceof Error ? error.message : 'Export failed'))
      } finally {
        setIsExporting(false)
      }
    }

    const clearWalletData = () => {
      if (confirm('Clear all wallet data? Make sure you have your seed phrases backed up.')) {
        setWallets([])
        setSelectedWallet(null)
        walletStorage.saveWallets([])
      }
    }

    return (
      <div className="h-full overflow-y-auto space-y-3">
        {/* Display */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4">
            <h3 className="font-medium text-gray-900 mb-4">Display</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">Show Balance</div>
                  <div className="text-xs text-gray-500">Hide amounts for privacy</div>
                </div>
                <button
                  onClick={() => handleSettingToggle('showBalance', !settings.showBalance)}
                  className={`w-12 h-6 rounded-full transition-all ${
                    settings.showBalance ? 'bg-cyan-500' : 'bg-gray-200'
                  }`}
                  aria-label={`${settings.showBalance ? 'Hide' : 'Show'} balance amounts`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.showBalance ? 'translate-x-6' : 'translate-x-0.5'
                  }`}></div>
                </button>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Currency</label>
                <select
                  value={settings.currency}
                  onChange={(e) => handleSettingToggle('currency', e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent bg-white"
                  aria-label="Select display currency"
                  title="Choose your preferred display currency"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="BTC">BTC (₿)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4">
            <h3 className="font-medium text-gray-900 mb-4">Security</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">PIN Protection</div>
                  <div className="text-xs text-gray-500">{settings.pinEnabled ? 'Enabled' : 'Tap to setup'}</div>
                </div>
                <button
                  onClick={() => {
                    if (!settings.pinEnabled) {
                      navigateToPage('pin-setup')
                    } else {
                      handleSettingToggle('pinEnabled', false)
                      handleSettingToggle('pinCode', '')
                    }
                  }}
                  className={`w-12 h-6 rounded-full transition-all ${
                    settings.pinEnabled ? 'bg-cyan-500' : 'bg-gray-200'
                  }`}
                  aria-label={`${settings.pinEnabled ? 'Disable' : 'Enable'} PIN protection`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.pinEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">Notifications</div>
                  <div className="text-xs text-gray-500">Transaction alerts</div>
                </div>
                <button
                  onClick={() => handleSettingToggle('notifications', !settings.notifications)}
                  className={`w-12 h-6 rounded-full transition-all ${
                    settings.notifications ? 'bg-cyan-500' : 'bg-gray-200'
                  }`}
                  aria-label={`${settings.notifications ? 'Disable' : 'Enable'} notifications`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.notifications ? 'translate-x-6' : 'translate-x-0.5'
                  }`}></div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4">
            <button
              className="w-full flex items-center justify-between text-left"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <h3 className="font-medium text-gray-900">Advanced</h3>
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
            </button>
            
            {showAdvanced && (
              <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Network</label>
                  <select
                    value={settings.network}
                    onChange={(e) => handleSettingToggle('network', e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent bg-white"
                    aria-label="Select Bitcoin network"
                    title="Choose default network for new wallets"
                  >
                    <option value="mainnet">Bitcoin Mainnet</option>
                    <option value="testnet">Bitcoin Testnet</option>
                  </select>
                </div>

                <div className="space-y-2">
                  {activeWallet && (
                    <button
                      onClick={() => setShowExportModal(true)}
                      className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl p-3 text-sm font-medium active:scale-95 transition-all text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        <span>Export Private Key</span>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={clearWalletData}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 rounded-xl p-3 text-sm font-medium active:scale-95 transition-all text-left"
                  >
                    Clear All Wallet Data
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* About - Compact */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-medium text-gray-900">Rabbit Wallet</div>
                <div className="text-xs text-gray-500">v1.0.0 • {wallets.length} wallets</div>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-full flex items-center justify-center">
                <div className="text-cyan-600 text-xs">🐰</div>
              </div>
            </div>
          </div>
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Export Key</h3>
                  <button
                    onClick={() => {
                      setShowExportModal(false)
                      setExportMnemonic('')
                      setExportedKey('')
                    }}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <span className="text-gray-600">✕</span>
                  </button>
                </div>

                {!exportedKey ? (
                  <div className="space-y-4">
                    <textarea
                      placeholder="Enter seed phrase..."
                      value={exportMnemonic}
                      onChange={(e) => setExportMnemonic(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 font-mono resize-none"
                      rows={3}
                    />
                    <button
                      className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-2xl h-12 text-sm font-medium disabled:opacity-50 active:scale-95 transition-all"
                      onClick={exportPrivateKey}
                      disabled={isExporting || !exportMnemonic.trim()}
                    >
                      {isExporting ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Exporting...</span>
                        </div>
                      ) : (
                        'Export'
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-xs break-all max-h-32 overflow-y-auto">
                      {exportedKey}
                    </div>
                    <button
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-2xl h-12 text-sm font-medium active:scale-95 transition-all"
                      onClick={() => {
                        if (!exportedKey.startsWith('Error:')) {
                          navigator.clipboard.writeText(exportedKey)
                        }
                      }}
                      disabled={exportedKey.startsWith('Error:')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  function PinSetupPage() {
    const [step, setStep] = useState<'setup' | 'confirm'>('setup')
    const [pin, setPin] = useState('')
    const [confirmPin, setConfirmPin] = useState('')
    const [error, setError] = useState('')

    const handlePinInput = (digit: string) => {
      if (step === 'setup' && pin.length < 4) {
        setPin(pin + digit)
      } else if (step === 'confirm' && confirmPin.length < 4) {
        setConfirmPin(confirmPin + digit)
      }
    }

    const handleBackspace = () => {
      if (step === 'setup') {
        setPin(pin.slice(0, -1))
      } else {
        setConfirmPin(confirmPin.slice(0, -1))
      }
      setError('')
    }

    const handleNext = () => {
      if (step === 'setup' && pin.length === 4) {
        setStep('confirm')
        setError('')
      } else if (step === 'confirm' && confirmPin.length === 4) {
        if (pin === confirmPin) {
          // Save PIN
          handleSettingToggle('pinEnabled', true)
          handleSettingToggle('pinCode', pin)
          navigateToPage('settings')
        } else {
          setError('PINs do not match')
          setConfirmPin('')
        }
      }
    }

    useEffect(() => {
      if (step === 'setup' && pin.length === 4) {
        setTimeout(() => handleNext(), 300)
      } else if (step === 'confirm' && confirmPin.length === 4) {
        setTimeout(() => handleNext(), 300)
      }
    }, [pin, confirmPin, step])

    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <div className="mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-cyan-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {step === 'setup' ? 'Create PIN' : 'Confirm PIN'}
          </h2>
          <p className="text-gray-500 text-sm">
            {step === 'setup' 
              ? 'Choose a 4-digit PIN to secure your wallet' 
              : 'Enter your PIN again to confirm'
            }
          </p>
        </div>

        {/* PIN Display */}
        <div className="flex gap-4 mb-8">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                (step === 'setup' ? pin.length > index : confirmPin.length > index)
                  ? 'bg-cyan-500 border-cyan-500' 
                  : 'border-gray-300'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="text-red-500 text-sm mb-4">{error}</div>
        )}

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-4 max-w-xs">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              onClick={() => handlePinInput(digit.toString())}
              className="w-16 h-16 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200 text-lg font-medium text-gray-900 active:scale-95 transition-all shadow-sm"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={() => handlePinInput('0')}
            className="w-16 h-16 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200 text-lg font-medium text-gray-900 active:scale-95 transition-all shadow-sm col-start-2"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="w-16 h-16 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200 text-lg font-medium text-gray-900 active:scale-95 transition-all shadow-sm flex items-center justify-center"
            aria-label="Delete last digit"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      </div>
    )
  }

  // Show loading state during initialization
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-[375px] h-[812px] bg-white rounded-[2.5rem] shadow-2xl border border-gray-200">
          <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative flex flex-col">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-10"></div>
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="w-6 h-6 animate-spin text-cyan-600" />
                </div>
                <p className="text-gray-600 text-sm">Initializing wallet...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handle case where no wallets exist
  if (wallets.length === 0) {
    // If user is trying to add a wallet, show the add wallet page even with no existing wallets
    if (currentPage === 'add-wallet') {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="w-[375px] h-[812px] bg-white rounded-[2.5rem] shadow-2xl border border-gray-200">
            <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative flex flex-col">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-10"></div>
              
              <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <button
                    className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"
                    onClick={() => {
                      console.log('🔙 Back button clicked - returning to home')
                      navigateToPage('home')
                    }}
                    aria-label="Go back to home"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center">
                    <Image 
                      src="/images/rabbit-logo.svg" 
                      alt="Rabbit" 
                      width={16} 
                      height={16} 
                      className="text-white"
                    />
                  </div>
                  <div>
                    <h1 className="text-lg font-medium text-gray-900">Add Wallet</h1>
                  </div>
                </div>
              </header>

              <main className="flex-1 overflow-y-auto px-6 pb-20">
                <AddWalletPage />
              </main>
            </div>
          </div>
        </div>
      )
    }

    // Default welcome screen
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-[375px] h-[812px] bg-white rounded-[2.5rem] shadow-2xl border border-gray-200">
          <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative flex flex-col">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-10"></div>
            
            <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center">
                  <Image 
                    src="/images/rabbit-logo.svg" 
                    alt="Rabbit" 
                    width={16} 
                    height={16} 
                    className="text-white"
                  />
                </div>
                <div>
                  <h1 className="text-lg font-medium text-gray-900">Rabbit</h1>
                </div>
              </div>
            </header>

            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center max-w-xs">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Image 
                    src="/images/rabbit-logo.svg" 
                    alt="Rabbit" 
                    width={32} 
                    height={32} 
                    className="text-cyan-600"
                  />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Welcome to Rabbit</h2>
                <p className="text-gray-500 mb-8 text-sm leading-relaxed">Get started by creating your first Bitcoin wallet. Your keys, your Bitcoin.</p>
                
                <button
                  onClick={() => {
                    console.log('🚀 Wallet creation button clicked!')
                    try {
                      navigateToPage('add-wallet')
                      console.log('🚀 navigateToPage call completed')
                    } catch (error) {
                      console.error('🚀 Error in navigateToPage:', error)
                    }
                  }}
                  className="w-full bg-gradient-to-r from-cyan-50 to-cyan-100 border border-cyan-200 rounded-2xl p-4 hover:from-cyan-100 hover:to-cyan-200 transition-all active:scale-95"
                >
                  <p className="text-cyan-800 text-sm font-medium">
                    🐰 <strong>Tap to create or import a wallet</strong>
                  </p>
                </button>
                
                <div className="mt-8 space-y-2">
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
          </div>
        </div>
      </div>
    )
  }

  // Main wallet interface
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-[375px] h-[812px] bg-white rounded-[2.5rem] shadow-2xl border border-gray-200 relative overflow-hidden">
        <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative flex flex-col">
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-10"></div>

          {/* Page Content with Blur Transition */}
          <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
            isTransitioning ? 'blur-sm opacity-50 scale-95' : 'blur-0 opacity-100 scale-100'
          }`}>
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-100">
              <div className="flex items-center gap-3">
                {currentPage !== 'home' && (
                  <button
                    className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"
                    onClick={() => navigateToPage('home')}
                    aria-label="Go back to home"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-600" />
                  </button>
                )}
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center">
                  <Image 
                    src="/images/rabbit-logo.svg" 
                    alt="Rabbit" 
                    width={16} 
                    height={16} 
                    className="text-white"
                  />
                </div>
                <div>
                  <h1 className="text-lg font-medium text-gray-900">
                    {currentPage === 'home' ? 'Rabbit' : 
                     currentPage === 'wallet' ? 'Wallets' :
                     currentPage === 'send' ? 'Send Bitcoin' :
                     currentPage === 'receive' ? 'Receive Bitcoin' :
                     currentPage === 'settings' ? 'Settings' : 
                     currentPage === 'add-wallet' ? 'Add Wallet' :
                     currentPage === 'pin-setup' ? 'PIN Setup' : 'Rabbit'}
                  </h1>
                </div>
              </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto px-6 pb-20">
              {(() => {
                console.log('🔍 Rendering page content, currentPage:', currentPage)
                
                if (currentPage === 'home') {
                  console.log('🔍 Rendering HomePage')
                  return <HomePage />
                }
                if (currentPage === 'wallet') {
                  console.log('🔍 Rendering WalletPage')
                  return <WalletPage />
                }
                if (currentPage === 'send') {
                  console.log('🔍 Rendering SendPage')
                  return <SendPage />
                }
                if (currentPage === 'receive') {
                  console.log('🔍 Rendering ReceivePage')
                  return <ReceivePage />
                }
                if (currentPage === 'settings') {
                  console.log('🔍 Rendering SettingsPage')
                  return <SettingsPage />
                }
                if (currentPage === 'add-wallet') {
                  console.log('🔍 Rendering AddWalletPage')
                  return <AddWalletPage />
                }
                if (currentPage === 'pin-setup') {
                  console.log('🔍 Rendering PinSetupPage')
                  return <PinSetupPage />
                }
                console.log('🔍 No matching page found for:', currentPage, '- showing fallback')
                return <div>Unknown page: {currentPage}</div>
              })()}
            </main>
          </div>

          {/* Bottom Navigation - Fixed Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-100 px-6 py-3 z-20">
            <div className="flex justify-around items-center">
              {[
                { icon: Home, label: "Home", page: 'home' as PageType },
                { icon: Wallet, label: "Wallet", page: 'wallet' as PageType },
                { icon: Send, label: "Send", page: 'send' as PageType },
                { icon: Download, label: "Receive", page: 'receive' as PageType },
                { icon: Settings, label: "Settings", page: 'settings' as PageType },
              ].map(({ icon: Icon, label, page }) => (
                <button
                  key={label}
                  className={`flex flex-col items-center gap-1 p-2 min-h-[52px] transition-all active:scale-95 ${
                    currentPage === page ? "text-cyan-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                  onClick={() => navigateToPage(page)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 