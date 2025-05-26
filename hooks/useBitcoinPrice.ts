import { useState, useEffect, useCallback } from 'react'
import { walletStorage, type PriceCacheData } from '@/lib/storage'

interface BitcoinPriceData {
  usd: number
  eur: number
  gbp: number
  jpy: number
  inr: number
  aud: number
  chf: number
  usd_24h_change: number
  last_updated_at: number
}

interface UseBitcoinPriceReturn {
  price: number | null
  prices: BitcoinPriceData | null
  change24h: number | null
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  getPriceInCurrency: (currency: string) => number | null
}

export function useBitcoinPrice(enabled: boolean = true): UseBitcoinPriceReturn {
  const [price, setPrice] = useState<number | null>(null)
  const [prices, setPrices] = useState<BitcoinPriceData | null>(null)
  const [change24h, setChange24h] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Helper function to get price in specific currency
  const getPriceInCurrency = useCallback((currency: string): number | null => {
    if (!prices) {
      return price // Fallback to USD price
    }
    
    switch (currency.toUpperCase()) {
      case 'USD': return prices.usd
      case 'EUR': return prices.eur
      case 'GBP': return prices.gbp
      case 'JPY': return prices.jpy
      case 'INR': return prices.inr
      case 'AUD': return prices.aud
      case 'CHF': return prices.chf
      case 'BTC': return 1
      default: return prices.usd
    }
  }, [prices, price])

  // Load cached data on initialization
  useEffect(() => {
    const cachedData = walletStorage.loadPriceCache()
    if (cachedData) {
      setPrice(cachedData.price)
      setChange24h(cachedData.change24h)
      setLastUpdated(new Date(cachedData.lastUpdated))
      setIsLoading(false)
      setError(null)
    }
  }, [])

  const fetchBitcoinPrice = useCallback(async () => {
    if (!enabled) {
      console.log('🚫 Bitcoin price fetch skipped - not on home page')
      return
    }

    try {
      setError(null)
      
      // Only show loading if we don't have cached data
      if (price === null) {
        setIsLoading(true)
      }
      
      console.log('💰 Fetching Bitcoin price from CoinGecko API')
      
      // Use CoinGecko API with your API key for accurate multi-currency data
      const apiKey = 'CG-psh8FpdPnabRcc9BiHhWXmji'
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur,gbp,jpy,inr,aud,chf&include_24hr_change=true&include_last_updated_at=true&x_cg_demo_api_key=${apiKey}`, {
        headers: {
          'Accept': 'application/json',
          'x-cg-demo-api-key': apiKey,
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`)
      }

      const data = await response.json()
      const bitcoinData = data.bitcoin

      if (!bitcoinData || typeof bitcoinData.usd !== 'number') {
        throw new Error('Invalid data received from CoinGecko API')
      }
      
      const priceData: BitcoinPriceData = {
        usd: bitcoinData.usd,
        eur: bitcoinData.eur,
        gbp: bitcoinData.gbp,
        jpy: bitcoinData.jpy,
        inr: bitcoinData.inr,
        aud: bitcoinData.aud,
        chf: bitcoinData.chf,
        usd_24h_change: bitcoinData.usd_24h_change || 0,
        last_updated_at: bitcoinData.last_updated_at || Date.now() / 1000
      }

      // Update state
      setPrice(bitcoinData.usd)
      setPrices(priceData)
      setChange24h(bitcoinData.usd_24h_change || 0)
      setLastUpdated(new Date(bitcoinData.last_updated_at * 1000))
      setIsLoading(false)

      // Save to cache
      const cacheData: PriceCacheData = {
        price: bitcoinData.usd,
        change24h: bitcoinData.usd_24h_change || 0,
        lastUpdated: new Date(bitcoinData.last_updated_at * 1000).getTime(),
        timestamp: Date.now(),
      }
      
      walletStorage.savePriceCache(cacheData)
      console.log('✅ Bitcoin price updated successfully')

    } catch (err) {
      // Set error but keep cached data if available
      setError(err instanceof Error ? err.message : 'Failed to fetch price')
      setIsLoading(false)
      console.warn('⚠️ Bitcoin price fetch failed:', err)
    }
  }, [price, enabled])

  // Initial fetch and set up interval
  useEffect(() => {
    // Always fetch fresh data on mount
    fetchBitcoinPrice()

    // Set up interval for regular updates (5 minutes to avoid rate limits)
    const interval = setInterval(fetchBitcoinPrice, 5 * 60 * 1000)

    // Cleanup interval on unmount
    return () => clearInterval(interval)
  }, [fetchBitcoinPrice])

  // Fetch when browser tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if our cached data is stale (older than 5 minutes)
        const cachedData = walletStorage.loadPriceCache()
        if (!cachedData || Date.now() - cachedData.timestamp > 5 * 60 * 1000) {
          fetchBitcoinPrice()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchBitcoinPrice])

  return {
    price,
    prices,
    change24h,
    isLoading,
    error,
    lastUpdated,
    getPriceInCurrency
  }
} 