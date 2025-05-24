import { useState, useEffect, useCallback } from 'react'
import { walletStorage, type PriceCacheData } from '@/lib/storage'

interface BitcoinPriceData {
  usd: number
  usd_24h_change: number
  last_updated_at: number
}

interface UseBitcoinPriceReturn {
  price: number | null
  change24h: number | null
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function useBitcoinPrice(): UseBitcoinPriceReturn {
  const [price, setPrice] = useState<number | null>(null)
  const [change24h, setChange24h] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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
    try {
      setError(null)
      
      // Only show loading if we don't have cached data
      if (price === null) {
        setIsLoading(true)
      }
      
      // CoinGecko API for Bitcoin price
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true',
        {
          headers: {
            'Accept': 'application/json',
          },
          // Add timeout and other options
          signal: AbortSignal.timeout(10000), // 10 second timeout
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const bitcoinData: BitcoinPriceData = data.bitcoin

      if (!bitcoinData || typeof bitcoinData.usd !== 'number') {
        throw new Error('Invalid data received from API')
      }

      const newPrice = bitcoinData.usd
      const newChange24h = bitcoinData.usd_24h_change || 0
      const newLastUpdated = new Date(bitcoinData.last_updated_at * 1000)

      // Update state
      setPrice(newPrice)
      setChange24h(newChange24h)
      setLastUpdated(newLastUpdated)
      setIsLoading(false)

      // Save to cache
      const cacheData: PriceCacheData = {
        price: newPrice,
        change24h: newChange24h,
        lastUpdated: newLastUpdated.getTime(),
        timestamp: Date.now(),
      }
      
      walletStorage.savePriceCache(cacheData)

    } catch (err) {
      console.error('Failed to fetch Bitcoin price:', err)
      
      // Set error but keep cached data if available
      setError(err instanceof Error ? err.message : 'Failed to fetch price')
      setIsLoading(false)
      
      // If we have no cached data, show a fallback
      if (price === null) {
        setPrice(0)
        setChange24h(0)
        setLastUpdated(new Date())
      }
    }
  }, [price])

  // Initial fetch and set up interval
  useEffect(() => {
    // Fetch immediately if no cached data
    const cachedData = walletStorage.loadPriceCache()
    if (!cachedData) {
      fetchBitcoinPrice()
    }

    // Set up interval for regular updates (30 seconds)
    const interval = setInterval(fetchBitcoinPrice, 30000)

    // Cleanup interval on unmount
    return () => clearInterval(interval)
  }, [fetchBitcoinPrice])

  // Fetch when browser tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if our cached data is stale (older than 2 minutes)
        const cachedData = walletStorage.loadPriceCache()
        if (!cachedData || Date.now() - cachedData.timestamp > 2 * 60 * 1000) {
          fetchBitcoinPrice()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchBitcoinPrice])

  return {
    price,
    change24h,
    isLoading,
    error,
    lastUpdated,
  }
} 