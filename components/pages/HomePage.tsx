"use client"

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { 
  RefreshCw, 
  Download, 
  Send, 
  ArrowDownLeft, 
  ArrowUpRight
} from 'lucide-react'
import { useBitcoinPriceHistory } from '@/hooks/useBitcoinPriceHistory'
import WalletCarousel from '@/components/shared/WalletCarousel'
import type { WalletData } from '@/types/wallet'

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface ExchangeRates {
  USD: number
  EUR: number
  GBP: number
  JPY: number
  INR: number
  AUD: number
  CHF: number
}

interface HomePageProps {
  activeWallet: WalletData | null
  wallets: WalletData[]
  totalBalance: number
  totalValueFiat: number
  bitcoinPrice: number | null
  change24h: number | null
  lastUpdated: Date | null
  isLoading: boolean
  error: string | null
  isRefreshing: boolean
  settings: {
    showBalance: boolean
    currency: string
  }
  formatCurrency: (amount: number, currency?: string, showSymbol?: boolean) => string
  onNavigate: (page: 'home' | 'wallet' | 'send' | 'receive' | 'settings' | 'add-wallet' | 'pin-setup' | 'history' | 'swap') => void
  onRefreshWallet: () => void
  onSelectWallet: (wallet: WalletData) => void
  currencyRates?: ExchangeRates
  getPriceInCurrency: (currency: string) => number | null
}

export default function HomePage({
  activeWallet,
  wallets,
  totalBalance,
  totalValueFiat,
  bitcoinPrice,
  change24h,
  lastUpdated,
  isLoading,
  error,
  isRefreshing,
  settings,
  formatCurrency,
  onNavigate,
  onRefreshWallet,
  onSelectWallet,
  currencyRates,
  getPriceInCurrency
}: HomePageProps) {
  const { priceHistory, getPriceHistoryInCurrency } = useBitcoinPriceHistory()

  if (!activeWallet) {
    return <div>No wallet available</div>
  }

  const isPositive = change24h ? change24h >= 0 : true
  
  // Calculate portfolio P/L in fiat
  const portfolioPL = change24h && bitcoinPrice ? (totalBalance * bitcoinPrice * change24h) / 100 : 0

  // Convert Bitcoin price to selected currency using direct price data
  const getBitcoinPriceInCurrency = () => {
    if (settings.currency === 'BTC') return 1 // 1 BTC = 1 BTC
    
    // Use direct currency prices from CoinGecko if available
    const priceInCurrency = getPriceInCurrency(settings.currency)
    if (priceInCurrency) {
      return priceInCurrency
    }
    
    // Fallback to USD conversion with exchange rates
    if (!bitcoinPrice || !currencyRates) return bitcoinPrice
    
    if (settings.currency === 'USD') return bitcoinPrice
    
    const rate = currencyRates[settings.currency as keyof typeof currencyRates]
    return rate ? bitcoinPrice / rate : bitcoinPrice // Fixed: divide by rate for proper conversion
  }

  const bitcoinPriceInCurrency = getBitcoinPriceInCurrency()

  // Prepare chart data from price history
  const [chartData, setChartData] = useState<{
    series: Array<{ name: string; data: number[]; color: string }>
    categories: string[]
  }>({
    series: [{ name: "Bitcoin Price", data: [], color: "#0891b2" }],
    categories: []
  })

  useEffect(() => {
    // Get price history in the selected currency
    const currencyHistory = getPriceHistoryInCurrency(settings.currency)
    
    if (currencyHistory && currencyHistory.length > 0) {
      try {
        const validPrices = currencyHistory.filter(p => p && typeof p.price === 'number' && !isNaN(p.price))
        
        if (validPrices.length > 0) {
          // Take last 5 days of data for cleaner display
          const last5Days = validPrices.slice(-5)
          
          const prices = last5Days.map(p => Math.round(p.price))
          const categories = last5Days.map(p => p.date) // Use the formatted date from API

          setChartData({
            series: [{ 
              name: "Bitcoin Price", 
              data: prices,
              color: "#67e8f9" // Light cyan color
            }],
            categories
          })
        }
      } catch (error) {
        console.warn('Error preparing chart data:', error)
        // Fallback data with proper dates
        const fallbackCategories = []
        const fallbackPrices = []
        const now = new Date()
        
        for (let i = 4; i >= 0; i--) {
          const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formattedDate = `${date.getDate()} ${monthNames[date.getMonth()]}`
          fallbackCategories.push(formattedDate)
          
          // Generate realistic price based on current price
          const basePrice = bitcoinPriceInCurrency || 97000
          const variation = (Math.random() - 0.5) * 0.05 * basePrice // ±2.5% variation
          fallbackPrices.push(Math.round(basePrice + variation))
        }
        
        setChartData({
          series: [{ 
            name: "Bitcoin Price", 
            data: fallbackPrices,
            color: "#67e8f9" // Light cyan color
          }],
          categories: fallbackCategories
        })
      }
    } else {
      // Fallback data when no price history with proper dates
      const fallbackCategories = []
      const fallbackPrices = []
      const now = new Date()
      
      for (let i = 4; i >= 0; i--) {
        const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const formattedDate = `${date.getDate()} ${monthNames[date.getMonth()]}`
        fallbackCategories.push(formattedDate)
        
        // Generate realistic price based on current price
        const basePrice = bitcoinPriceInCurrency || 97000
        const variation = (Math.random() - 0.5) * 0.05 * basePrice // ±2.5% variation
        fallbackPrices.push(Math.round(basePrice + variation))
      }
      
      setChartData({
        series: [{ 
          name: "Bitcoin Price", 
          data: fallbackPrices,
          color: "#67e8f9" // Light cyan color
        }],
        categories: fallbackCategories
      })
    }
  }, [priceHistory, getPriceHistoryInCurrency, settings.currency, bitcoinPriceInCurrency])

  // ApexCharts configuration
  const chartOptions = {
    chart: {
      height: "100%",
      maxWidth: "100%",
      type: "area" as const,
      fontFamily: "Inter, sans-serif",
      dropShadow: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      background: 'transparent',
      sparkline: {
        enabled: false,
      },
      parentHeightOffset: 0,
      offsetX: 0,
      offsetY: 0,
      events: {
        mouseMove: function(event: any, chartContext: any, config: any) {
          // Improve hover detection
        }
      }
    },
    tooltip: {
      enabled: true,
      followCursor: false,
      intersect: false,
      shared: true,
      trigger: 'mousemove',
      hideDelay: 0,
      custom: function({ series, seriesIndex, dataPointIndex, w }: any) {
        if (dataPointIndex < 0 || !chartData.categories[dataPointIndex]) return ''
        
        const date = chartData.categories[dataPointIndex]
        const value = series[seriesIndex][dataPointIndex]
        const formattedValue = formatCurrency(value, settings.currency)
        
        return `
          <div style="
            background: white; 
            border: 1px solid #e5e7eb; 
            border-radius: 8px; 
            padding: 8px 12px; 
            font-family: Inter, sans-serif; 
            font-size: 10px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            pointer-events: none;
          ">
            <div style="color: #374151; font-weight: 500; margin-bottom: 2px;">${date}</div>
            <div style="color: #111827; font-weight: 600;">${formattedValue}</div>
          </div>
        `
      },
      marker: {
        show: true,
        size: 6,
        colors: ['#67e8f9'],
        strokeColors: '#ffffff',
        strokeWidth: 2,
        hover: {
          size: 8,
        }
      },
    },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.3,
        opacityTo: 0,
        shade: "#67e8f9",
        gradientToColors: ["#67e8f9"],
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      width: 3,
      curve: 'smooth' as const,
      colors: ['#67e8f9'], // Light cyan color
      lineCap: 'round' as const,
    },
    grid: {
      show: false,
      strokeDashArray: 0,
      padding: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
      },
      borderColor: 'transparent',
    },
    xaxis: {
      categories: chartData.categories,
      labels: {
        show: true,
        style: {
          colors: '#9ca3af',
          fontSize: '8px', // Very small font
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
        },
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    yaxis: {
      show: true,
      min: (val: number) => {
        // Dynamic Y-axis based on data range
        const minPrice = Math.min(...chartData.series[0].data)
        const maxPrice = Math.max(...chartData.series[0].data)
        const range = maxPrice - minPrice
        const padding = range * 0.1 // 10% padding
        return Math.max(0, minPrice - padding)
      },
      max: (val: number) => {
        const minPrice = Math.min(...chartData.series[0].data)
        const maxPrice = Math.max(...chartData.series[0].data)
        const range = maxPrice - minPrice
        const padding = range * 0.1 // 10% padding
        return maxPrice + padding
      },
      tickAmount: 2, // This will create 3 points
      labels: {
        show: true,
        style: {
          colors: '#9ca3af',
          fontSize: '8px', // Very small font
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
        },
        formatter: (value: number) => {
          if (value >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`
          } else if (value >= 1000) {
            return `${Math.round(value / 1000)}k`
          }
          return Math.round(value).toString()
        }
      },
    },
    legend: {
      show: false,
    },
    plotOptions: {
      area: {
        fillTo: 'end' as const,
      }
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          height: 200
        }
      }
    }],
  }

  return (
    <div className="space-y-4">
      {/* Total Bitcoin Holdings - Top Component - Adjusted spacing */}
      <div className="text-center space-y-1 mt-2">
        {/* Ghost FIAT amount - Ultra subtle */}
        {settings.currency !== 'BTC' && settings.showBalance && (
          <div className="text-gray-300 text-sm font-light">
            {formatCurrency(totalValueFiat)}
          </div>
        )}
        
        {/* Main Bitcoin Balance - Smaller */}
        <div className="text-2xl font-bold text-gray-900 tracking-tight">
          {!settings.showBalance ? (
            '••••••'
          ) : (
            `${totalBalance.toFixed(6)} BTC`
          )}
        </div>
        
        {/* 24h Change - No button wrapper */}
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className={`${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '▲' : '▼'} {change24h ? `${Math.abs(change24h).toFixed(1)}%` : '...'}
          </span>
          {portfolioPL !== 0 && settings.currency !== 'BTC' && (
            <span className="text-gray-500">
              {portfolioPL >= 0 ? '+' : ''}{formatCurrency(Math.abs(portfolioPL))}
            </span>
          )}
        </div>
      </div>

      {/* Bitcoin Price Chart - More compact (15% less height) */}
      <div className="bg-white rounded-2xl p-4 overflow-hidden">
        {/* Chart Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-medium text-gray-700">5-Day Price Action</div>
          <div className="text-xs font-medium text-gray-900">
            {bitcoinPriceInCurrency ? formatCurrency(bitcoinPriceInCurrency, settings.currency) : '...'}
          </div>
        </div>
        
        {/* ApexCharts Area Chart - 15% more compact */}
        <div className="h-44 -mx-4 -mb-4">
          <Chart
            options={chartOptions}
            series={chartData.series}
            type="area"
            height="100%"
            width="100%"
          />
        </div>
      </div>

      {/* Action Buttons - Modern & Compact */}
      <div className="flex gap-3">
        <button
          className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl h-9 text-xs font-medium border border-gray-200/50 active:scale-95 transition-all"
          onClick={() => onNavigate('receive')}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Download className="w-3 h-3" />
            <span>Receive</span>
          </div>
        </button>
        <button
          className="flex-1 bg-cyan-100 hover:bg-cyan-200 text-cyan-600 rounded-2xl h-9 text-xs font-medium shadow-sm active:scale-95 transition-all"
          onClick={() => onNavigate('send')}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Send className="w-3 h-3" />
            <span>Send</span>
          </div>
        </button>
      </div>

      {/* Wallet Carousel - Moved below action buttons */}
      <WalletCarousel
        activeWallet={activeWallet}
        wallets={wallets}
        onNavigate={onNavigate}
        onSelectWallet={onSelectWallet}
      />

      {/* Force Refresh - Minimal */}
      {isRefreshing && (
        <div className="bg-blue-50/80 backdrop-blur-sm rounded-lg p-2 border border-blue-100/50">
          <div className="flex items-center justify-center gap-2 text-blue-700">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span className="text-xs font-medium">Updating...</span>
          </div>
        </div>
      )}

      {/* Recent Transactions - Balanced colors */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-gray-900 text-xs font-semibold">Recent</h3>
          <button
            onClick={onRefreshWallet}
            className="p-1 rounded-md hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="Refresh transactions"
          >
            <RefreshCw className={`w-3 h-3 text-gray-400 hover:text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <div className="space-y-1">
          {activeWallet.transactions?.slice(0, 5).map((tx, i) => {
            const txDate = new Date(tx.date)
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            const formattedDate = `${monthNames[txDate.getMonth()]} ${txDate.getDate()}`
            
            // Balanced colors: cyan for received, black with opacity for sent
            let amountColor = 'text-gray-500' // Default for pending
            let amountPrefix = tx.type === 'received' ? '+' : '-'
            
            if (tx.status === 'completed') {
              amountColor = tx.type === 'received' ? 'text-cyan-600' : 'text-black/80'
            }
            
            return (
              <div key={i} className="bg-white/95 backdrop-blur-sm rounded-lg p-2 shadow-sm border border-gray-100/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Balanced icon colors */}
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                      tx.type === "received" ? "bg-cyan-100" : "bg-gray-100"
                    }`}>
                      {tx.type === "received" ? (
                        <ArrowDownLeft className="w-2.5 h-2.5 text-cyan-600" />
                      ) : (
                        <ArrowUpRight className="w-2.5 h-2.5 text-gray-600" />
                      )}
                    </div>
                    
                    {/* Date */}
                    <div className="text-xs text-gray-700 font-medium">
                      {formattedDate}
                    </div>
                  </div>
                  
                  {/* Amount */}
                  <div className={`text-xs font-semibold ${amountColor}`}>
                    {amountPrefix}{tx.amount.toFixed(6)} BTC
                  </div>
                </div>
              </div>
            )
          })}
          
          {(!activeWallet.transactions || activeWallet.transactions.length === 0) && (
            <div className="bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-sm border border-gray-100/30 text-center">
              <div className="text-gray-500 text-xs">No transactions yet</div>
              <div className="text-gray-400 text-xs mt-0.5">Your transactions will appear here</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 