import { useState, useEffect, useCallback } from 'react'

interface ExchangeRates {
  USD: number
  EUR: number
  GBP: number
  JPY: number
  INR: number
  AUD: number
  CHF: number
}

interface CurrencyRatesHook {
  rates: ExchangeRates
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  refreshRates: () => void
}

export function useCurrencyRates(isOnHomePage: boolean = false): CurrencyRatesHook {
  const [rates, setRates] = useState<ExchangeRates>({
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 150,
    INR: 83,
    AUD: 1.52,
    CHF: 0.88
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  // Cache management - only fetch if cache is older than 90 seconds
  const isCacheValid = () => {
    if (!lastUpdated) return false
    const now = new Date()
    const cacheAge = now.getTime() - lastUpdated.getTime()
    return cacheAge < 90000 // 90 seconds to conserve API quota
  }

  const fetchRates = useCallback(async () => {
    // Only fetch if on home page and cache is expired
    if (!isOnHomePage) {
      console.log('💱 Skipping exchange rate fetch - not on home page')
      return
    }
    
    // Skip if cache is still valid
    if (isCacheValid()) {
      console.log('💱 Using cached exchange rates (90s cache)')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      // Use your ExchangeRate API key with v6 endpoint
      const apiUrl = 'https://v6.exchangerate-api.com/v6/5c1d26d26beaddb89e4da467/latest/USD'
      
      console.log(`💱 Fetching exchange rates from ExchangeRate API (quota: 1500/month)`)
      
      const response = await fetch(apiUrl, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'BitcoinWallet/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Check if API call was successful
      if (data.result !== 'success') {
        throw new Error(`API Error: ${data['error-type'] || 'Unknown error'}`)
      }
      
      const ratesData = data.conversion_rates
      
      if (ratesData && ratesData.EUR && ratesData.GBP && ratesData.JPY) {
        const newRates = {
          USD: 1, // Base currency
          EUR: Number(ratesData.EUR) || 0.92,
          GBP: Number(ratesData.GBP) || 0.79,
          JPY: Number(ratesData.JPY) || 150,
          INR: Number(ratesData.INR) || 83,
          AUD: Number(ratesData.AUD) || 1.52,
          CHF: Number(ratesData.CHF) || 0.88
        }
        
        setRates(newRates)
        setLastUpdated(new Date())
        console.log(`✅ Exchange rates updated successfully:`, newRates)
      } else {
        throw new Error('API response missing required currencies')
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch exchange rates'
      console.warn(`⚠️ Exchange rate fetch failed: ${errorMessage}`)
      setError(errorMessage)
      
      // Only update timestamp if we don't have any rates yet
      if (!lastUpdated) {
        console.log('💱 Using fallback rates (will retry on next interval)')
        setLastUpdated(new Date())
      }
    } finally {
      setIsLoading(false)
    }
  }, [isOnHomePage, lastUpdated])

  // Manual refresh function
  const refreshRates = useCallback(() => {
    if (isOnHomePage) {
      setLastUpdated(null) // Force refresh by invalidating cache
      fetchRates()
    }
  }, [isOnHomePage, fetchRates])

  useEffect(() => {
    // Fetch rates on mount if on home page
    if (isOnHomePage) {
      fetchRates()
    }
    
    // Set up interval - check every 90 seconds, but only fetch if on home page
    const interval = setInterval(() => {
      if (isOnHomePage) {
        fetchRates()
      }
    }, 90 * 1000) // 90 seconds to conserve API quota
    
    return () => clearInterval(interval)
  }, [isOnHomePage, fetchRates])

  return {
    rates,
    isLoading,
    error,
    lastUpdated,
    refreshRates
  }
} 