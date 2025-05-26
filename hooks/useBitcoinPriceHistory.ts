import { useState, useEffect, useCallback } from 'react'

interface PriceHistoryPoint {
  timestamp: number
  price: number
  date: string
}

interface UseBitcoinPriceHistoryReturn {
  priceHistory: PriceHistoryPoint[] | null
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  getPriceHistoryInCurrency: (currency: string) => PriceHistoryPoint[] | null
}

export function useBitcoinPriceHistory(): UseBitcoinPriceHistoryReturn {
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[] | null>(null)
  const [priceHistoryByCurrency, setPriceHistoryByCurrency] = useState<{[key: string]: PriceHistoryPoint[]}>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Helper function to get price history in specific currency
  const getPriceHistoryInCurrency = useCallback((currency: string): PriceHistoryPoint[] | null => {
    const currencyKey = currency.toLowerCase()
    return priceHistoryByCurrency[currencyKey] || priceHistory
  }, [priceHistoryByCurrency, priceHistory])

  const fetchPriceHistory = useCallback(async () => {
    try {
      setError(null)
      setIsLoading(true)

      // Get 7 days of historical data from CoinGecko
      const apiKey = 'CG-psh8FpdPnabRcc9BiHhWXmji'
      const days = 7
      
      // Fetch data for multiple currencies
      const currencies = ['usd', 'eur', 'gbp', 'jpy', 'inr', 'aud', 'chf']
      const currencyPromises = currencies.map(async (currency) => {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=${currency}&days=${days}&interval=daily&x_cg_demo_api_key=${apiKey}`,
          {
            headers: {
              'Accept': 'application/json',
              'x-cg-demo-api-key': apiKey,
            },
            signal: AbortSignal.timeout(15000), // 15 second timeout
          }
        )

        if (!response.ok) {
          throw new Error(`CoinGecko API error for ${currency}: ${response.status}`)
        }

        const data = await response.json()
        
        if (!data.prices || !Array.isArray(data.prices)) {
          throw new Error(`Invalid price data for ${currency}`)
        }

        // Convert to our format
        const historyPoints: PriceHistoryPoint[] = data.prices.map(([timestamp, price]: [number, number]) => {
          const date = new Date(timestamp)
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formattedDate = `${date.getDate()} ${monthNames[date.getMonth()]}`
          
          return {
            timestamp,
            price: Math.round(price),
            date: formattedDate
          }
        })

        return { currency, historyPoints }
      })

      const results = await Promise.all(currencyPromises)
      
      // Organize data by currency
      const historyByCurrency: {[key: string]: PriceHistoryPoint[]} = {}
      let usdHistory: PriceHistoryPoint[] = []

      results.forEach(({ currency, historyPoints }) => {
        historyByCurrency[currency] = historyPoints
        if (currency === 'usd') {
          usdHistory = historyPoints
        }
      })

      setPriceHistoryByCurrency(historyByCurrency)
      setPriceHistory(usdHistory) // Default to USD
      setLastUpdated(new Date())
      setIsLoading(false)

      console.log('✅ Bitcoin price history updated successfully for all currencies')

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch price history'
      console.warn(`⚠️ Price history fetch failed: ${errorMessage}`)
      setError(errorMessage)
      setIsLoading(false)

      // Fallback data if API fails
      if (!priceHistory) {
        const fallbackHistory: PriceHistoryPoint[] = []
        const now = Date.now()
        const oneDayMs = 24 * 60 * 60 * 1000
        
        for (let i = 6; i >= 0; i--) {
          const timestamp = now - (i * oneDayMs)
          const date = new Date(timestamp)
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formattedDate = `${date.getDate()} ${monthNames[date.getMonth()]}`
          
          // Generate realistic price variation
          const basePrice = 97000
          const variation = (Math.random() - 0.5) * 8000 // ±4k variation
          const price = Math.round(basePrice + variation)
          
          fallbackHistory.push({
            timestamp,
            price,
            date: formattedDate
          })
        }
        
        setPriceHistory(fallbackHistory)
        console.log('💱 Using fallback price history data')
      }
    }
  }, [priceHistory])

  // Initial fetch and set up interval
  useEffect(() => {
    fetchPriceHistory()

    // Update every 30 minutes to avoid rate limits
    const interval = setInterval(fetchPriceHistory, 30 * 60 * 1000)

    return () => clearInterval(interval)
  }, [fetchPriceHistory])

  // Fetch when browser tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if our data is stale (older than 30 minutes)
        if (!lastUpdated || Date.now() - lastUpdated.getTime() > 30 * 60 * 1000) {
          fetchPriceHistory()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchPriceHistory, lastUpdated])

  return {
    priceHistory,
    isLoading,
    error,
    lastUpdated,
    getPriceHistoryInCurrency
  }
} 