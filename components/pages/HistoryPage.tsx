"use client"

import React, { useState, useEffect } from 'react'
import { 
  History, 
  Search, 
  RefreshCw, 
  ArrowDownLeft, 
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  ChevronDown
} from 'lucide-react'
import WalletCarousel from '@/components/shared/WalletCarousel'
import type { WalletData } from '@/types/wallet'
import { costBasisService, type CostBasisEntry, type PortfolioMetrics } from '@/lib/cost-basis-service'

interface ExchangeRates {
  USD: number
  EUR: number
  GBP: number
  JPY: number
  INR: number
  AUD: number
  CHF: number
}

interface HistoryPageProps {
  activeWallet: WalletData | null
  wallets: WalletData[]
  formatCurrency: (amount: number, currency?: string, showSymbol?: boolean) => string
  bitcoinPrice: number | null
  settings: {
    currency: string
    showBalance: boolean
  }
  onNavigate: (page: 'home' | 'wallet' | 'send' | 'receive' | 'settings' | 'add-wallet' | 'pin-setup' | 'history' | 'swap') => void
  onRefreshWallet: () => void
  onSelectWallet: (wallet: WalletData) => void
  getPriceInCurrency?: (currency: string) => number | null
}

export default function HistoryPage({
  activeWallet,
  wallets,
  formatCurrency,
  bitcoinPrice,
  settings,
  onNavigate,
  onRefreshWallet,
  onSelectWallet,
  getPriceInCurrency
}: HistoryPageProps) {
  const [selectedWallet, setSelectedWallet] = useState<string>(activeWallet?.id || 'all')
  const [filterType, setFilterType] = useState<'all' | 'received' | 'sent'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [costBasisEntries, setCostBasisEntries] = useState<CostBasisEntry[]>([])
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null)
  const [isLoadingCostBasis, setIsLoadingCostBasis] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month')
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)

  // Get current Bitcoin price in selected currency
  const getCurrentBitcoinPrice = () => {
    if (settings.currency === 'BTC') return 1
    
    if (getPriceInCurrency) {
      const priceInCurrency = getPriceInCurrency(settings.currency)
      if (priceInCurrency) return priceInCurrency
    }
    
    return bitcoinPrice || 0
  }

  // Load cost basis data
  useEffect(() => {
    const loadCostBasisData = async () => {
      if (!bitcoinPrice || wallets.length === 0) return

      setIsLoadingCostBasis(true)
      try {
        const { entries, metrics } = await costBasisService.getAggregatedCostBasis(
          wallets, 
          getCurrentBitcoinPrice()
        )
        setCostBasisEntries(entries)
        setPortfolioMetrics(metrics)
      } catch (error) {
        console.error('Failed to load cost basis data:', error)
      } finally {
        setIsLoadingCostBasis(false)
      }
    }

    loadCostBasisData()
  }, [wallets, bitcoinPrice, settings.currency])

  // Handle wallet selection from carousel
  const handleWalletSelect = (wallet: WalletData) => {
    setSelectedWallet(wallet.id)
    onSelectWallet(wallet)
  }

  const handleAllWalletsSelect = () => {
    setSelectedWallet('all')
  }

  // Get filtered transactions
  const getFilteredTransactions = () => {
    let transactions: any[] = []

    if (selectedWallet === 'all') {
      transactions = wallets.flatMap(wallet => 
        (wallet.transactions || []).map(tx => ({ ...tx, walletName: wallet.name, walletId: wallet.id }))
      )
    } else {
      const wallet = wallets.find(w => w.id === selectedWallet)
      if (wallet) {
        transactions = (wallet.transactions || []).map(tx => ({ ...tx, walletName: wallet.name, walletId: wallet.id }))
      }
    }

    // Apply filters
    if (filterType !== 'all') {
      transactions = transactions.filter(tx => tx.type === filterType)
    }

    if (searchQuery) {
      transactions = transactions.filter(tx => 
        tx.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.address?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Sort by date (newest first)
    return transactions.sort((a, b) => b.date - a.date)
  }

  // Get cost basis entry for a transaction
  const getCostBasisForTransaction = (tx: any): CostBasisEntry | undefined => {
    return costBasisEntries.find(entry => 
      entry.transactionId === tx.id || 
      (entry.date === tx.date && Math.abs(entry.amount - Math.abs(tx.amount)) < 0.00000001)
    )
  }

  // Format P&L with color
  const formatPnL = (amount: number, showSymbol = true) => {
    const isPositive = amount >= 0
    const color = isPositive ? 'text-green-600' : 'text-red-600'
    const prefix = isPositive ? '+' : ''
    return (
      <span className={color}>
        {prefix}{formatCurrency(Math.abs(amount), settings.currency, showSymbol)}
      </span>
    )
  }

  // Get period P&L
  const getPeriodPnL = () => {
    if (!portfolioMetrics) return 0
    switch (selectedPeriod) {
      case 'day': return portfolioMetrics.dayPnL
      case 'week': return portfolioMetrics.weekPnL
      case 'month': return portfolioMetrics.monthPnL
      case 'year': return portfolioMetrics.yearPnL
      default: return portfolioMetrics.monthPnL
    }
  }

  const filteredTransactions = getFilteredTransactions()

  if (wallets.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-xs w-full">
          <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <History className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Welcome to Rabbit</h2>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">Get started by creating your first Bitcoin wallet to view transaction history.</p>
          
          <button
            onClick={() => onNavigate('add-wallet')}
            className="w-full bg-cyan-100 hover:bg-cyan-200 text-cyan-600 rounded-2xl p-4 text-sm font-medium active:scale-95 transition-all"
          >
            Create Your First Wallet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Wallet Carousel */}
      <WalletCarousel
        activeWallet={activeWallet}
        wallets={wallets}
        onNavigate={onNavigate}
        onSelectWallet={handleWalletSelect}
        showAddWallet={false}
        showAllWallets={true}
        onSelectAllWallets={handleAllWalletsSelect}
        selectedWalletId={selectedWallet}
      />

      {/* Portfolio Overview - Clean White Design */}
      {portfolioMetrics && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Portfolio Performance</h3>
              <div className="text-lg font-semibold text-gray-900">
                {formatPnL(portfolioMetrics.totalUnrealizedPnL)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Total Value</div>
              <div className="text-sm font-medium text-gray-900">
                {formatCurrency(portfolioMetrics.currentValue, settings.currency)}
              </div>
            </div>
          </div>

          {/* Period Selector - Minimal */}
          <div className="flex bg-gray-50 rounded-lg p-1 mb-3">
            {(['day', 'week', 'month', 'year'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-all ${
                  selectedPeriod === period 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          {/* Period P&L */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {getPeriodPnL() >= 0 ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              <span className="text-gray-600">
                {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} P&L
              </span>
            </div>
            <div className="font-medium">
              {formatPnL(getPeriodPnL())}
            </div>
          </div>

          {/* Cost Basis Info - Minimal */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
            <div>
              <span className="text-gray-500">Cost Basis: </span>
              <span className="text-gray-900 font-medium">
                {formatCurrency(portfolioMetrics.totalCostBasis, settings.currency)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">ROI: </span>
              <span className={`font-medium ${
                portfolioMetrics.totalUnrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {portfolioMetrics.totalCostBasis > 0 
                  ? `${((portfolioMetrics.totalUnrealizedPnL / portfolioMetrics.totalCostBasis) * 100).toFixed(1)}%`
                  : '0%'
                }
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filters Row */}
      <div className="flex gap-3">
        {/* Search - Minimal */}
        <div className="flex-1 bg-white rounded-2xl p-3 border border-gray-100 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent border-0 outline-0 placeholder-gray-400"
          />
        </div>

        {/* Type Filter - Narrow Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className="bg-white rounded-2xl p-3 border border-gray-100 flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-w-[100px]"
          >
            <span className="capitalize">{filterType}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          
          {showTypeDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-10 min-w-[120px]">
              {(['all', 'received', 'sent'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setFilterType(type)
                    setShowTypeDropdown(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl transition-colors ${
                    filterType === type ? 'text-cyan-600 bg-cyan-50' : 'text-gray-700'
                  }`}
                >
                  <span className="capitalize">{type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => {
            setIsRefreshing(true)
            onRefreshWallet()
            setTimeout(() => setIsRefreshing(false), 2000)
          }}
          disabled={isRefreshing}
          className="bg-white rounded-2xl p-3 border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all"
          title="Refresh transactions"
          aria-label="Refresh transactions"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoadingCostBasis && (
          <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-cyan-700">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Loading cost basis data...</span>
            </div>
          </div>
        )}

        {filteredTransactions.map((tx, index) => {
          const costBasis = getCostBasisForTransaction(tx)
          const txDate = new Date(tx.date)
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formattedDate = `${monthNames[txDate.getMonth()]} ${txDate.getDate()}, ${txDate.getFullYear()}`
          
          return (
            <div key={`${tx.id || index}-${tx.date}`} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              {/* Transaction Header */}
              <div className="flex items-center justify-between mb-3">
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
                    {selectedWallet === 'all' && (
                      <div className="text-xs text-gray-500">{tx.walletName}</div>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-medium text-gray-900 text-sm">
                    {tx.type === 'received' ? '+' : '-'}{tx.amount.toFixed(6)} BTC
                  </div>
                  <div className={`text-xs ${tx.status === 'completed' ? 'text-cyan-500' : 'text-gray-500'}`}>
                    {tx.status}
                  </div>
                </div>
              </div>

              {/* Cost Basis Information */}
              {costBasis && (
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500">Price at Time:</span>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(costBasis.priceAtTime, settings.currency)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Cost Basis:</span>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(costBasis.costBasis, settings.currency)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Current Value:</span>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(costBasis.currentValue || 0, settings.currency)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Unrealized P&L:</span>
                      <div className="font-medium">
                        {formatPnL(costBasis.unrealizedPnL || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction Details */}
              <div className="space-y-1 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span className="font-mono">{formattedDate}</span>
                </div>
                {tx.id && (
                  <div className="flex justify-between">
                    <span>ID:</span>
                    <span className="font-mono">{tx.id.slice(0, 16)}...</span>
                  </div>
                )}
                {tx.fee && (
                  <div className="flex justify-between">
                    <span>Fee:</span>
                    <span className="font-mono">{tx.fee.toFixed(6)} BTC</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {filteredTransactions.length === 0 && !isLoadingCostBasis && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <History className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-gray-500 text-sm">No transactions found</h3>
            <p className="text-gray-400 text-xs mt-1">
              {searchQuery ? 'Try adjusting your search criteria' : 'Your transactions will appear here'}
            </p>
          </div>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {showTypeDropdown && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowTypeDropdown(false)}
        />
      )}
    </div>
  )
} 