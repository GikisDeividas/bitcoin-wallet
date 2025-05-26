"use client"

import React, { useState, useEffect } from 'react'
import { 
  ArrowUpDown, 
  TrendingUp,
  Clock,
  AlertCircle
} from 'lucide-react'
import type { WalletData } from '@/types/wallet'

interface SwapPageProps {
  activeWallet: WalletData | null
  bitcoinPrice: number | null
  formatCurrency: (amount: number, currency?: string, showSymbol?: boolean) => string
  settings: {
    currency: string
    showBalance: boolean
  }
  onNavigate: (page: 'home' | 'wallet' | 'send' | 'receive' | 'settings' | 'add-wallet' | 'pin-setup' | 'history' | 'swap') => void
  getPriceInCurrency: (currency: string) => number | null
}

interface StablecoinPrices {
  usdc: number
  usdt: number
}

export default function SwapPage({
  activeWallet,
  bitcoinPrice,
  formatCurrency,
  settings,
  onNavigate,
  getPriceInCurrency
}: SwapPageProps) {
  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [fromCurrency, setFromCurrency] = useState('BTC')
  const [toCurrency, setToCurrency] = useState('USDC')
  const [stablecoinPrices, setStablecoinPrices] = useState<StablecoinPrices | null>(null)

  // Available currencies for swap (only BTC, USDC, USDT)
  const currencies = [
    { code: 'BTC', name: 'Bitcoin', symbol: '₿' },
    { code: 'USDC', name: 'USD Coin', symbol: '$' },
    { code: 'USDT', name: 'Tether', symbol: '$' },
  ]

  // Fetch stablecoin prices
  useEffect(() => {
    const fetchStablecoinPrices = async () => {
      try {
        const apiKey = 'CG-psh8FpdPnabRcc9BiHhWXmji'
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether&vs_currencies=usd&x_cg_demo_api_key=${apiKey}`, {
          headers: {
            'Accept': 'application/json',
            'x-cg-demo-api-key': apiKey,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setStablecoinPrices({
            usdc: data['usd-coin']?.usd || 1.0,
            usdt: data.tether?.usd || 1.0,
          })
        }
      } catch (error) {
        // Fallback to 1:1 USD parity
        setStablecoinPrices({
          usdc: 1.0,
          usdt: 1.0,
        })
      }
    }

    fetchStablecoinPrices()
    const interval = setInterval(fetchStablecoinPrices, 5 * 60 * 1000) // Update every 5 minutes
    return () => clearInterval(interval)
  }, [])

  // Calculate conversion using USDC/USDT as intermediaries
  const calculateConversion = (amount: string, from: string, to: string) => {
    if (!amount || !bitcoinPrice || !stablecoinPrices) return ''
    
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount)) return ''

    if (from === to) return amount

    // Get USD values
    let fromUsdValue: number
    let toUsdValue: number

    // Convert from currency to USD
    if (from === 'BTC') {
      fromUsdValue = numAmount * bitcoinPrice
    } else if (from === 'USDC') {
      fromUsdValue = numAmount * stablecoinPrices.usdc
    } else if (from === 'USDT') {
      fromUsdValue = numAmount * stablecoinPrices.usdt
    } else {
      return ''
    }

    // Convert USD to target currency
    if (to === 'BTC') {
      return (fromUsdValue / bitcoinPrice).toFixed(8)
    } else if (to === 'USDC') {
      return (fromUsdValue / stablecoinPrices.usdc).toFixed(6)
    } else if (to === 'USDT') {
      return (fromUsdValue / stablecoinPrices.usdt).toFixed(6)
    }

    return ''
  }

  const handleFromAmountChange = (value: string) => {
    setFromAmount(value)
    setToAmount(calculateConversion(value, fromCurrency, toCurrency))
  }

  const handleToAmountChange = (value: string) => {
    setToAmount(value)
    setFromAmount(calculateConversion(value, toCurrency, fromCurrency))
  }

  const handleSwapCurrencies = () => {
    const tempCurrency = fromCurrency
    const tempAmount = fromAmount
    
    setFromCurrency(toCurrency)
    setToCurrency(tempCurrency)
    setFromAmount(toAmount)
    setToAmount(tempAmount)
  }

  const getExchangeRate = () => {
    if (!bitcoinPrice || !stablecoinPrices || fromCurrency === toCurrency) return null

    if (fromCurrency === 'BTC') {
      if (toCurrency === 'USDC') {
        return `1 BTC = ${(bitcoinPrice / stablecoinPrices.usdc).toFixed(2)} USDC`
      } else if (toCurrency === 'USDT') {
        return `1 BTC = ${(bitcoinPrice / stablecoinPrices.usdt).toFixed(2)} USDT`
      }
    } else if (toCurrency === 'BTC') {
      if (fromCurrency === 'USDC') {
        return `1 USDC = ${(stablecoinPrices.usdc / bitcoinPrice).toFixed(8)} BTC`
      } else if (fromCurrency === 'USDT') {
        return `1 USDT = ${(stablecoinPrices.usdt / bitcoinPrice).toFixed(8)} BTC`
      }
    } else {
      // USDC <-> USDT
      if (fromCurrency === 'USDC' && toCurrency === 'USDT') {
        return `1 USDC = ${(stablecoinPrices.usdc / stablecoinPrices.usdt).toFixed(6)} USDT`
      } else if (fromCurrency === 'USDT' && toCurrency === 'USDC') {
        return `1 USDT = ${(stablecoinPrices.usdt / stablecoinPrices.usdc).toFixed(6)} USDC`
      }
    }

    return null
  }

  if (!activeWallet) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ArrowUpDown className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">No wallet selected</p>
        </div>
      </div>
    )
  }

  // Calculate fiat value using the same logic as home/wallet pages
  const getFiatValue = (btcAmount: number) => {
    if (settings.currency === 'BTC') return btcAmount
    
    // Use direct currency prices from CoinGecko if available
    const priceInCurrency = getPriceInCurrency(settings.currency)
    if (priceInCurrency) {
      return btcAmount * priceInCurrency
    }
    
    // Fallback to USD price
    if (!bitcoinPrice) return 0
    return btcAmount * bitcoinPrice
  }

  return (
    <div className="h-full flex flex-col">
      {/* Compact Wallet Info */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 mb-3 border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-900">{activeWallet.name}</div>
            <div className="text-xs text-gray-500">{activeWallet.balance.toFixed(6)} BTC available</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-gray-900">
              {settings.showBalance ? formatCurrency(getFiatValue(activeWallet.balance), settings.currency) : '••••••'}
            </div>
            <div className="text-xs text-gray-500">Balance</div>
          </div>
        </div>
      </div>

      {/* Compact Swap Interface */}
      <div className="flex-1 space-y-3">
        {/* From Currency */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">From</label>
            <select
              value={fromCurrency}
              onChange={(e) => {
                setFromCurrency(e.target.value)
                setToAmount(calculateConversion(fromAmount, e.target.value, toCurrency))
              }}
              className="text-xs font-medium text-gray-900 bg-transparent border-0 outline-0"
              aria-label="Select currency to swap from"
              title="Choose the currency you want to swap from"
            >
              {currencies.map(currency => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code}
                </option>
              ))}
            </select>
          </div>
          
          <input
            type="number"
            placeholder="0.00"
            value={fromAmount}
            onChange={(e) => handleFromAmountChange(e.target.value)}
            className="w-full text-xl font-bold bg-transparent border-0 outline-0 placeholder-gray-400"
          />
        </div>

        {/* Compact Swap Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSwapCurrencies}
            className="w-10 h-10 bg-cyan-100 hover:bg-cyan-200 rounded-full flex items-center justify-center active:scale-95 transition-all"
            aria-label="Swap currencies"
            title="Swap the from and to currencies"
          >
            <ArrowUpDown className="w-4 h-4 text-cyan-600" />
          </button>
        </div>

        {/* To Currency */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">To</label>
            <select
              value={toCurrency}
              onChange={(e) => {
                setToCurrency(e.target.value)
                setToAmount(calculateConversion(fromAmount, fromCurrency, e.target.value))
              }}
              className="text-xs font-medium text-gray-900 bg-transparent border-0 outline-0"
              aria-label="Select currency to swap to"
              title="Choose the currency you want to swap to"
            >
              {currencies.map(currency => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code}
                </option>
              ))}
            </select>
          </div>
          
          <input
            type="number"
            placeholder="0.00"
            value={toAmount}
            onChange={(e) => handleToAmountChange(e.target.value)}
            className="w-full text-xl font-bold bg-transparent border-0 outline-0 placeholder-gray-400"
          />
        </div>

        {/* Compact Exchange Rate Info */}
        {getExchangeRate() && (
          <div className="bg-cyan-50/80 backdrop-blur-sm rounded-xl p-3 border border-cyan-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-cyan-600" />
                <span className="text-xs font-medium text-cyan-800">Exchange Rate</span>
              </div>
              <div className="text-xs font-medium text-cyan-800">
                {getExchangeRate()}
              </div>
            </div>
          </div>
        )}

        {/* Compact Coming Soon Notice */}
        <div className="bg-yellow-50/80 backdrop-blur-sm rounded-xl p-3 border border-yellow-100">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-3 h-3 text-yellow-600" />
            </div>
            <div>
              <div className="text-yellow-800 text-xs font-medium mb-1">Swap Feature Coming Soon</div>
              <div className="text-yellow-700 text-xs space-y-0.5">
                <div>• Real-time currency exchange rates</div>
                <div>• Instant Bitcoin ↔ Fiat conversions</div>
                <div>• Low fees and secure transactions</div>
                <div>• Integration with major exchanges</div>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Preview Button (Disabled) */}
        <button
          disabled
          className="w-full bg-gray-200 text-gray-500 rounded-xl h-10 text-xs font-medium cursor-not-allowed"
        >
          <div className="flex items-center justify-center gap-2">
            <AlertCircle className="w-3 h-3" />
            <span>Swap Feature Coming Soon</span>
          </div>
        </button>
      </div>
    </div>
  )
} 