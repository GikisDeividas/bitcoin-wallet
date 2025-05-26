"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { 
  ChevronDown, 
  ChevronRight,
  Search, 
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Tag,
  Edit3,
  Eye,
  EyeOff,
  Calendar,
  DollarSign,
  Bitcoin,
  ExternalLink,
  Clock,
  MapPin,
  Calculator,
  PieChart,
  BarChart3,
  Target,
  Wallet
} from 'lucide-react'
import WalletCarousel from '@/components/shared/WalletCarousel'
import { transactionAnalyzer } from '@/lib/transaction-analyzer'
import { transactionExportService } from '@/lib/transaction-export'
import type { WalletData } from '@/types/wallet'
import type { 
  EnhancedTransaction, 
  TransactionFilter, 
  TransactionGroup,
  PortfolioSnapshot,
  TransactionCategory
} from '@/types/transaction'

interface EnhancedHistoryPageProps {
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

export default function EnhancedHistoryPage({
  activeWallet,
  wallets,
  formatCurrency,
  bitcoinPrice,
  settings,
  onNavigate,
  onRefreshWallet,
  onSelectWallet,
  getPriceInCurrency
}: EnhancedHistoryPageProps) {
  // State management
  const [selectedWallet, setSelectedWallet] = useState<string>(activeWallet?.id || 'all')
  const [enhancedTransactions, setEnhancedTransactions] = useState<EnhancedTransaction[]>([])
  const [expandedTxs, setExpandedTxs] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [portfolioSnapshot, setPortfolioSnapshot] = useState<PortfolioSnapshot | null>(null)
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['all'])
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({})
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [amountRange, setAmountRange] = useState<{ min?: number; max?: number }>({})
  const [selectedCategories, setSelectedCategories] = useState<TransactionCategory[]>([])
  
  // UI state
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [editingTx, setEditingTx] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showPnLBreakdown, setShowPnLBreakdown] = useState(false)
  const [costBasisMethod, setCostBasisMethod] = useState<'fifo' | 'lifo' | 'average'>('fifo')

  // Convert legacy transactions to enhanced format
  useEffect(() => {
    const convertTransactions = async () => {
      setIsLoading(true)
      try {
        const enhanced: EnhancedTransaction[] = []
        
        // Set cost basis method
        transactionAnalyzer.setCostBasisMethod(costBasisMethod)
        
        for (const wallet of wallets) {
          if (selectedWallet !== 'all' && wallet.id !== selectedWallet) continue
          
          for (const tx of wallet.transactions || []) {
            const enhancedTx = await transactionAnalyzer.convertLegacyTransaction(
              tx, 
              wallet.id, 
              wallet.name
            )
            enhanced.push(enhancedTx)
          }
        }
        
        // Sort by timestamp (newest first)
        enhanced.sort((a, b) => b.timestamp - a.timestamp)
        setEnhancedTransactions(enhanced)
        
        // Calculate portfolio snapshot
        calculatePortfolioSnapshot(enhanced)
      } catch (error) {
        console.error('Failed to convert transactions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    convertTransactions()
  }, [wallets, selectedWallet, costBasisMethod])

  // Calculate comprehensive portfolio metrics using proper cost basis tracking
  const calculatePortfolioSnapshot = (transactions: EnhancedTransaction[]) => {
    const currentPrice = getCurrentBitcoinPrice()
    
    // Get accurate portfolio summary from transaction analyzer
    const portfolioSummary = transactionAnalyzer.getPortfolioSummary(currentPrice)
    
    // Calculate realized P&L from transactions
    const realizedPnL = transactions
      .filter(tx => tx.realizedPnL !== undefined)
      .reduce((sum, tx) => sum + (tx.realizedPnL || 0), 0)

    // Calculate period changes
    const now = Date.now()
    const periods = {
      day: now - (24 * 60 * 60 * 1000),
      week: now - (7 * 24 * 60 * 60 * 1000),
      month: now - (30 * 24 * 60 * 60 * 1000),
      year: now - (365 * 24 * 60 * 60 * 1000)
    }

    const calculatePeriodPnL = (periodStart: number) => {
      const periodTxs = transactions.filter(tx => tx.timestamp >= periodStart)
      return {
        realized: periodTxs.reduce((sum, tx) => sum + (tx.realizedPnL || 0), 0),
        unrealized: periodTxs
          .filter(tx => tx.type === 'received')
          .reduce((sum, tx) => {
            const currentVal = tx.totalReceived * currentPrice
            const costBasis = tx.costBasis?.totalCostBasis || 0
            return sum + (currentVal - costBasis)
          }, 0)
      }
    }

    const dayPnL = calculatePeriodPnL(periods.day)
    const weekPnL = calculatePeriodPnL(periods.week)
    const monthPnL = calculatePeriodPnL(periods.month)
    const yearPnL = calculatePeriodPnL(periods.year)

    setPortfolioSnapshot({
      timestamp: now,
      totalBalance: portfolioSummary.totalBitcoinHeld,
      totalCostBasis: portfolioSummary.totalAcquisitionCost,
      currentValue: portfolioSummary.currentValue,
      unrealizedPnL: portfolioSummary.unrealizedPnL,
      realizedPnL,
      dayChange: dayPnL.realized + dayPnL.unrealized,
      weekChange: weekPnL.realized + weekPnL.unrealized,
      monthChange: monthPnL.realized + monthPnL.unrealized,
      yearChange: yearPnL.realized + yearPnL.unrealized,
      roi: portfolioSummary.totalAcquisitionCost > 0 ? ((portfolioSummary.currentValue + realizedPnL - portfolioSummary.totalAcquisitionCost) / portfolioSummary.totalAcquisitionCost) * 100 : 0
    })
  }

  // Get current Bitcoin price in selected currency
  const getCurrentBitcoinPrice = () => {
    if (settings.currency === 'BTC') return 1
    
    if (getPriceInCurrency) {
      const priceInCurrency = getPriceInCurrency(settings.currency)
      if (priceInCurrency) return priceInCurrency
    }
    
    return bitcoinPrice || 0
  }

  // Advanced filtering
  const filteredTransactions = useMemo(() => {
    let filtered = enhancedTransactions

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(tx => 
        tx.id.toLowerCase().includes(query) ||
        tx.txHash.toLowerCase().includes(query) ||
        tx.label?.toLowerCase().includes(query) ||
        tx.notes?.toLowerCase().includes(query) ||
        tx.externalAddresses.some(addr => addr.toLowerCase().includes(query)) ||
        tx.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Type filter
    if (selectedTypes.length > 0 && !selectedTypes.includes('all')) {
      filtered = filtered.filter(tx => selectedTypes.includes(tx.type))
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(tx => 
        tx.category && selectedCategories.includes(tx.category)
      )
    }

    // Date range filter
    if (dateRange.start) {
      const startTime = new Date(dateRange.start).getTime()
      filtered = filtered.filter(tx => tx.timestamp >= startTime)
    }
    if (dateRange.end) {
      const endTime = new Date(dateRange.end).getTime() + (24 * 60 * 60 * 1000) - 1
      filtered = filtered.filter(tx => tx.timestamp <= endTime)
    }

    // Amount range filter
    if (amountRange.min !== undefined) {
      filtered = filtered.filter(tx => Math.abs(tx.netAmount) >= amountRange.min!)
    }
    if (amountRange.max !== undefined) {
      filtered = filtered.filter(tx => Math.abs(tx.netAmount) <= amountRange.max!)
    }

    return filtered
  }, [enhancedTransactions, searchQuery, selectedTypes, selectedCategories, dateRange, amountRange])

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: TransactionGroup[] = []
    const groupMap = new Map<string, EnhancedTransaction[]>()

    filteredTransactions.forEach(tx => {
      const date = new Date(tx.timestamp).toISOString().split('T')[0]
      if (!groupMap.has(date)) {
        groupMap.set(date, [])
      }
      groupMap.get(date)!.push(tx)
    })

    groupMap.forEach((transactions, date) => {
      const totalReceived = transactions
        .filter(tx => tx.type === 'received')
        .reduce((sum, tx) => sum + tx.totalReceived, 0)
      
      const totalSent = transactions
        .filter(tx => tx.type === 'sent')
        .reduce((sum, tx) => sum + tx.totalSent, 0)
      
      const netAmount = totalReceived - totalSent
      
      const realizedPnL = transactions
        .reduce((sum, tx) => sum + (tx.realizedPnL || 0), 0)
      
      const currentPrice = getCurrentBitcoinPrice()
      const unrealizedPnL = transactions
        .filter(tx => tx.type === 'received')
        .reduce((sum, tx) => {
          const currentValue = tx.totalReceived * currentPrice
          const costBasis = tx.costBasis?.totalCostBasis || 0
          return sum + (currentValue - costBasis)
        }, 0)

      groups.push({
        date,
        transactions,
        totalReceived,
        totalSent,
        netAmount,
        realizedPnL,
        unrealizedPnL
      })
    })

    return groups.sort((a, b) => b.date.localeCompare(a.date))
  }, [filteredTransactions, getCurrentBitcoinPrice])

  // Handle wallet selection
  const handleWalletSelect = (wallet: WalletData) => {
    setSelectedWallet(wallet.id)
    onSelectWallet(wallet)
  }

  const handleAllWalletsSelect = () => {
    setSelectedWallet('all')
  }

  // Toggle transaction expansion
  const toggleTransaction = (txId: string) => {
    const newExpanded = new Set(expandedTxs)
    if (newExpanded.has(txId)) {
      newExpanded.delete(txId)
    } else {
      newExpanded.add(txId)
    }
    setExpandedTxs(newExpanded)
  }

  // Export functions
  const handleExport = (format: 'csv' | 'json' | 'tax') => {
    if (format === 'csv') {
      transactionExportService.downloadCSV(filteredTransactions, portfolioSnapshot, settings.currency)
    } else if (format === 'json') {
      transactionExportService.downloadJSON(filteredTransactions, wallets, portfolioSnapshot, settings.currency)
    } else if (format === 'tax') {
      transactionExportService.downloadTaxReport(filteredTransactions, settings.currency)
    }
    setShowExportModal(false)
  }

  // Format P&L with color
  const formatPnL = (amount: number, showSymbol = true) => {
    const isPositive = amount >= 0
    const color = isPositive ? 'text-cyan-600' : 'text-black/80'
    const prefix = isPositive ? '+' : ''
    return (
      <span className={color}>
        {prefix}{formatCurrency(Math.abs(amount), settings.currency, showSymbol)}
      </span>
    )
  }

  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      })
    }
  }

  // Format time for display
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  // Get transaction icon
  const getTransactionIcon = (tx: EnhancedTransaction) => {
    const iconClass = "w-3 h-3"
    
    switch (tx.type) {
      case 'received':
        return <ArrowDownLeft className={`${iconClass} text-cyan-600`} />
      case 'sent':
        return <ArrowUpRight className={`${iconClass} text-black/80`} />
      case 'self_transfer':
        return <ArrowDownLeft className={`${iconClass} text-blue-600`} />
      case 'consolidation':
        return <ArrowDownLeft className={`${iconClass} text-purple-600`} />
      default:
        return <ArrowDownLeft className={`${iconClass} text-gray-600`} />
    }
  }

  // Get category badge color
  const getCategoryColor = (category?: TransactionCategory) => {
    switch (category) {
      case 'purchase': return 'bg-cyan-100 text-cyan-700'
      case 'sale': return 'bg-gray-100 text-black/80'
      case 'mining': return 'bg-yellow-100 text-yellow-700'
      case 'airdrop': return 'bg-purple-100 text-purple-700'
      case 'gift_received': return 'bg-pink-100 text-pink-700'
      case 'gift_sent': return 'bg-pink-100 text-pink-700'
      case 'payment': return 'bg-blue-100 text-blue-700'
      case 'exchange': return 'bg-indigo-100 text-indigo-700'
      case 'dca': return 'bg-cyan-100 text-cyan-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (wallets.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-xs w-full">
          <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Bitcoin className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Welcome to Rabbit</h2>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            Create your first Bitcoin wallet to start tracking your transaction history and portfolio performance.
          </p>
          
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
    <div className="h-full flex flex-col space-y-3">
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

      {/* Portfolio Overview - Enhanced */}
      {portfolioSnapshot && (
        <div className="bg-white rounded-xl p-3 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-gray-700">Portfolio Performance</div>
            <button
              onClick={() => setShowPnLBreakdown(!showPnLBreakdown)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              aria-label={showPnLBreakdown ? 'Hide portfolio details' : 'Show portfolio details'}
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${showPnLBreakdown ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-gray-500 font-medium">Total Value</div>
              <div className="text-gray-900 font-semibold">
                {formatCurrency(portfolioSnapshot.currentValue)}
              </div>
              <div className="text-gray-500 text-xs">
                {portfolioSnapshot.totalBalance.toFixed(6)} BTC
              </div>
            </div>
            <div>
              <div className="text-gray-500 font-medium">Total P&L</div>
              <div className="flex items-center gap-1">
                {formatPnL(portfolioSnapshot.unrealizedPnL + portfolioSnapshot.realizedPnL)}
                {portfolioSnapshot.roi !== 0 && (
                  <span className={`text-xs ${portfolioSnapshot.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ({portfolioSnapshot.roi >= 0 ? '+' : ''}{portfolioSnapshot.roi.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* P&L Breakdown */}
          {showPnLBreakdown && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-gray-500">Unrealized P&L</div>
                  <div>{formatPnL(portfolioSnapshot.unrealizedPnL)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Realized P&L</div>
                  <div>{formatPnL(portfolioSnapshot.realizedPnL)}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-gray-500">Total Cost Basis</div>
                  <div className="text-gray-700">{formatCurrency(portfolioSnapshot.totalCostBasis)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Avg Cost/BTC</div>
                  <div className="text-gray-700">
                    {portfolioSnapshot.totalBalance > 0 
                      ? formatCurrency(portfolioSnapshot.totalCostBasis / portfolioSnapshot.totalBalance, settings.currency, false)
                      : formatCurrency(0, settings.currency, false)
                    }
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-gray-500">Cost Basis Method</div>
                  <select
                    value={costBasisMethod}
                    onChange={(e) => setCostBasisMethod(e.target.value as 'fifo' | 'lifo' | 'average')}
                    className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                    aria-label="Cost basis calculation method"
                  >
                    <option value="fifo">FIFO</option>
                    <option value="lifo">LIFO</option>
                    <option value="average">Average</option>
                  </select>
                </div>
                <div>
                  <div className="text-gray-500">Cost Basis Lots</div>
                  <div className="text-gray-700">
                    {transactionAnalyzer.getPortfolioSummary(getCurrentBitcoinPrice()).costBasisLots} lots
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-gray-500">24h</div>
                  <div>{formatPnL(portfolioSnapshot.dayChange, false)}</div>
                </div>
                <div>
                  <div className="text-gray-500">7d</div>
                  <div>{formatPnL(portfolioSnapshot.weekChange, false)}</div>
                </div>
                <div>
                  <div className="text-gray-500">30d</div>
                  <div>{formatPnL(portfolioSnapshot.monthChange, false)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced Filters */}
      <div className="space-y-2">
        {/* Basic Search and Filters */}
        <div className="flex gap-2">
          <div className="flex-1 bg-white rounded-lg border border-gray-200 px-3 py-2 flex items-center gap-2">
            <Search className="w-3 h-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions, addresses, labels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 text-xs bg-transparent border-0 outline-0 placeholder-gray-400"
            />
          </div>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-1 text-xs font-medium hover:bg-gray-50 ${
              showAdvancedFilters ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'text-gray-700'
            }`}
          >
            <Filter className="w-3 h-3" />
            Filters
          </button>

          <button
            onClick={onRefreshWallet}
            className="bg-white border border-gray-200 rounded-lg p-2 hover:bg-gray-50 active:scale-95 transition-all"
            aria-label="Refresh transactions"
          >
            <RefreshCw className={`w-3 h-3 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="bg-white rounded-xl p-3 border border-gray-100 space-y-3">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">From Date</label>
                <input
                  type="date"
                  value={dateRange.start || ''}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1"
                  aria-label="Start date for transaction filter"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">To Date</label>
                <input
                  type="date"
                  value={dateRange.end || ''}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1"
                  aria-label="End date for transaction filter"
                />
              </div>
            </div>

            {/* Amount Range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Min Amount (BTC)</label>
                <input
                  type="number"
                  step="0.00000001"
                  placeholder="0.00000000"
                  value={amountRange.min || ''}
                  onChange={(e) => setAmountRange(prev => ({ ...prev, min: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Max Amount (BTC)</label>
                <input
                  type="number"
                  step="0.00000001"
                  placeholder="∞"
                  value={amountRange.max || ''}
                  onChange={(e) => setAmountRange(prev => ({ ...prev, max: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1"
                />
              </div>
            </div>

            {/* Type and Category Filters */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                  className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 flex items-center justify-between text-xs"
                >
                  <span>Type: {selectedTypes.includes('all') ? 'All' : selectedTypes.join(', ')}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                
                {showTypeDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg z-10">
                    {['all', 'received', 'sent', 'self_transfer', 'consolidation'].map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          setSelectedTypes([type])
                          setShowTypeDropdown(false)
                        }}
                        className={`w-full text-left px-2 py-1 text-xs hover:bg-gray-50 ${
                          selectedTypes.includes(type) ? 'bg-cyan-50 text-cyan-700' : 'text-gray-700'
                        }`}
                      >
                        {type === 'all' ? 'All Types' : type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 flex items-center justify-between text-xs"
                >
                  <span>Category: {selectedCategories.length === 0 ? 'All' : selectedCategories.length}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                
                {showCategoryDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg z-10 max-h-32 overflow-y-auto">
                    {['purchase', 'sale', 'transfer_in', 'transfer_out', 'mining', 'airdrop', 'gift_received', 'gift_sent', 'payment', 'refund', 'exchange', 'dca', 'other'].map(category => (
                      <button
                        key={category}
                        onClick={() => {
                          const cat = category as TransactionCategory
                          setSelectedCategories(prev => 
                            prev.includes(cat) 
                              ? prev.filter(c => c !== cat)
                              : [...prev, cat]
                          )
                        }}
                        className={`w-full text-left px-2 py-1 text-xs hover:bg-gray-50 ${
                          selectedCategories.includes(category as TransactionCategory) ? 'bg-cyan-50 text-cyan-700' : 'text-gray-700'
                        }`}
                      >
                        {category.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Clear Filters */}
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedTypes(['all'])
                setSelectedCategories([])
                setDateRange({})
                setAmountRange({})
              }}
              className="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Transaction Groups */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : groupedTransactions.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center border border-gray-100">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Bitcoin className="w-6 h-6 text-gray-400" />
            </div>
            <div className="text-gray-500 text-sm">No transactions found</div>
            <div className="text-gray-400 text-xs mt-1">
              {searchQuery || showAdvancedFilters ? 'Try adjusting your filters' : 'Your transactions will appear here'}
            </div>
          </div>
        ) : (
          groupedTransactions.map(group => (
            <div key={group.date} className="bg-white rounded-xl border border-gray-100">
              {/* Date Header with Daily Summary */}
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-gray-900">
                    {formatDate(new Date(group.date).getTime())}
                  </div>
                  <div className="text-xs text-gray-500">
                    {group.transactions.length} tx
                  </div>
                </div>
                
                {/* Daily P&L Summary */}
                {(group.realizedPnL !== 0 || group.unrealizedPnL !== 0) && (
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <div className="text-gray-500">Daily P&L:</div>
                    <div className="flex items-center gap-2">
                      {group.realizedPnL !== 0 && (
                        <span>
                          R: {formatPnL(group.realizedPnL, false)}
                        </span>
                      )}
                      {group.unrealizedPnL !== 0 && (
                        <span>
                          U: {formatPnL(group.unrealizedPnL, false)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Transactions */}
              <div className="divide-y divide-gray-50">
                {group.transactions.map(tx => (
                  <div key={tx.id} className="px-3 py-2">
                    {/* Transaction Row - Collapsed */}
                    <button
                      onClick={() => toggleTransaction(tx.id)}
                      className="w-full flex items-center justify-between text-left hover:bg-gray-50 rounded-lg p-1 -m-1"
                      aria-label={`Toggle transaction details for ${tx.type} ${tx.netAmount.toFixed(6)} BTC`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Expand Icon */}
                        <div className="flex-shrink-0">
                          {expandedTxs.has(tx.id) ? (
                            <ChevronDown className="w-3 h-3 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                          )}
                        </div>

                        {/* Transaction Icon */}
                        <div className="flex-shrink-0 w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center">
                          {getTransactionIcon(tx)}
                        </div>

                        {/* Transaction Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-900 capitalize">
                              {tx.type.replace('_', ' ')}
                            </span>
                            {tx.category && (
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getCategoryColor(tx.category)}`}>
                                {tx.category.replace('_', ' ')}
                              </span>
                            )}
                            {tx.label && (
                              <span className="text-xs text-gray-500 truncate">
                                {tx.label}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {formatTime(tx.timestamp)}
                            {tx.confirmations < 6 && (
                              <span className="text-orange-500">
                                {tx.confirmations}/6 conf
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Amount and P&L */}
                      <div className="text-right flex-shrink-0">
                        <div className={`text-xs font-semibold ${
                          tx.netAmount >= 0 ? 'text-cyan-600' : 'text-black/80'
                        }`}>
                          {tx.netAmount >= 0 ? '+' : ''}{tx.netAmount.toFixed(6)} BTC
                        </div>
                        <div className="text-xs text-gray-500">
                          {tx.costBasis && formatCurrency(tx.costBasis.totalCostBasis)}
                        </div>
                        {tx.realizedPnL !== undefined && tx.realizedPnL !== 0 && (
                          <div className="text-xs">
                            {formatPnL(tx.realizedPnL, false)}
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Transaction Details - Expanded */}
                    {expandedTxs.has(tx.id) && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-3 text-xs">
                        {/* Transaction Hash and Explorer Link */}
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Transaction ID</span>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-gray-700">
                              {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-8)}
                            </span>
                            <button 
                              className="text-gray-400 hover:text-gray-600"
                              aria-label="View transaction on blockchain explorer"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* From/To Addresses */}
                        <div className="space-y-2">
                          {tx.type === 'received' && tx.externalAddresses.length > 0 && (
                            <div>
                              <div className="text-gray-500 mb-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                From Address{tx.externalAddresses.length > 1 ? 'es' : ''}
                              </div>
                              {tx.externalAddresses.slice(0, 2).map((address, i) => (
                                <div key={i} className="font-mono text-gray-700 text-xs bg-white rounded px-2 py-1">
                                  {address.slice(0, 12)}...{address.slice(-12)}
                                </div>
                              ))}
                              {tx.externalAddresses.length > 2 && (
                                <div className="text-gray-500">
                                  +{tx.externalAddresses.length - 2} more addresses
                                </div>
                              )}
                            </div>
                          )}

                          {tx.type === 'sent' && tx.externalAddresses.length > 0 && (
                            <div>
                              <div className="text-gray-500 mb-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                To Address{tx.externalAddresses.length > 1 ? 'es' : ''}
                              </div>
                              {tx.externalAddresses.slice(0, 2).map((address, i) => (
                                <div key={i} className="font-mono text-gray-700 text-xs bg-white rounded px-2 py-1">
                                  {address.slice(0, 12)}...{address.slice(-12)}
                                </div>
                              ))}
                              {tx.externalAddresses.length > 2 && (
                                <div className="text-gray-500">
                                  +{tx.externalAddresses.length - 2} more addresses
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Network Fee */}
                        {tx.fee.amount > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Network Fee</span>
                            <span className="text-gray-700">
                              {(tx.fee.amount / 100000000).toFixed(8)} BTC
                              <span className="text-gray-500 ml-1">
                                ({tx.fee.rate.toFixed(1)} sat/vB)
                              </span>
                            </span>
                          </div>
                        )}

                        {/* Cost Basis and P&L Details */}
                        {tx.costBasis && (
                          <div className="space-y-2 pt-2 border-t border-gray-200">
                            <div className="flex items-center gap-1 text-gray-500 mb-1">
                              <Calculator className="w-3 h-3" />
                              Cost Basis Analysis
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex justify-between">
                                <span className="text-gray-500">BTC Price</span>
                                <span className="text-gray-700">
                                  {formatCurrency(tx.costBasis.priceAtTime)}
                                </span>
                              </div>
                              
                              <div className="flex justify-between">
                                <span className="text-gray-500">Cost Basis</span>
                                <span className="text-gray-700">
                                  {formatCurrency(tx.costBasis.totalCostBasis)}
                                </span>
                              </div>
                            </div>
                            
                            {tx.type === 'received' && (
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Current Value</span>
                                  <div className="text-right">
                                    <div className="text-gray-700">
                                      {formatCurrency(tx.totalReceived * getCurrentBitcoinPrice())}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      @ {formatCurrency(getCurrentBitcoinPrice())}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Unrealized P&L</span>
                                  <div className={`font-medium ${
                                    (tx.totalReceived * getCurrentBitcoinPrice()) >= tx.costBasis.totalCostBasis 
                                      ? 'text-cyan-600' : 'text-black/80'
                                  }`}>
                                    {formatPnL(
                                      (tx.totalReceived * getCurrentBitcoinPrice()) - tx.costBasis.totalCostBasis,
                                      false
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {tx.realizedPnL !== undefined && tx.realizedPnL !== 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Realized P&L</span>
                                <div className={`font-medium ${tx.realizedPnL >= 0 ? 'text-cyan-600' : 'text-black/80'}`}>
                                  {formatPnL(tx.realizedPnL, false)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                          <button
                            onClick={() => setEditingTx(tx.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 hover:bg-gray-50 text-xs"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </button>
                          
                          <button
                            onClick={() => {/* Add tag functionality */}}
                            className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 hover:bg-gray-50 text-xs"
                          >
                            <Tag className="w-3 h-3" />
                            Tag
                          </button>

                          <button
                            onClick={() => {/* Copy transaction details */}}
                            className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 hover:bg-gray-50 text-xs"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Explorer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 max-w-sm w-full mx-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Export Transaction History</h3>
            
            <div className="space-y-2">
              <button
                onClick={() => handleExport('csv')}
                className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs"
              >
                <div className="font-medium">CSV Export</div>
                <div className="text-gray-500">Spreadsheet compatible format</div>
              </button>
              
              <button
                onClick={() => handleExport('json')}
                className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs"
              >
                <div className="font-medium">JSON Export</div>
                <div className="text-gray-500">Complete portfolio data</div>
              </button>
              
              <button
                onClick={() => handleExport('tax')}
                className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs"
              >
                <div className="font-medium">Tax Report</div>
                <div className="text-gray-500">Capital gains/losses for tax filing</div>
              </button>
            </div>
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Button - Fixed at bottom */}
      <div className="flex-shrink-0 pt-2">
        <button
          onClick={() => setShowExportModal(true)}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2 text-xs font-medium flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Download className="w-3 h-3" />
          Export History ({filteredTransactions.length} transactions)
        </button>
      </div>
    </div>
  )
} 