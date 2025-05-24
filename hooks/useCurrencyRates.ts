import { useState, useEffect } from 'react'

interface ExchangeRates {
  EUR: number
  GBP: number
  USD: number
}

interface CurrencyRatesHook {
  rates: ExchangeRates
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function useCurrencyRates(): CurrencyRatesHook {
  const [rates, setRates] = useState<ExchangeRates>({
    USD: 1,
    EUR: 0.92,
    GBP: 0.79
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchRates = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Try multiple free exchange rate APIs
      const apis = [
        'https://api.exchangerate-api.com/v4/latest/USD',
        'https://open.er-api.com/v6/latest/USD'
      ]
      
      let success = false
      
      for (const apiUrl of apis) {
        try {
          console.log(`💱 Fetching exchange rates from: ${apiUrl}`)
          
          const response = await fetch(apiUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000) // 8 second timeout
          })
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          
          const data = await response.json()
          
          if (data.rates && data.rates.EUR && data.rates.GBP) {
            setRates({
              USD: 1,
              EUR: data.rates.EUR,
              GBP: data.rates.GBP
            })
            setLastUpdated(new Date())
            console.log(`✅ Exchange rates updated:`, { EUR: data.rates.EUR, GBP: data.rates.GBP })
            success = true
            break
          }
        } catch (err) {
          console.warn(`❌ Exchange rate API failed: ${apiUrl}`, err)
          continue
        }
      }
      
      if (!success) {
        throw new Error('All exchange rate APIs failed')
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch exchange rates'
      console.warn(`⚠️ Using fallback exchange rates: ${errorMessage}`)
      setError(errorMessage)
      
      // Use fallback rates (approximate current rates)
      setRates({
        USD: 1,
        EUR: 0.92,  // Approximate EUR/USD
        GBP: 0.79   // Approximate GBP/USD  
      })
      setLastUpdated(new Date())
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Fetch rates on mount
    fetchRates()
    
    // Update every 30 minutes
    const interval = setInterval(fetchRates, 30 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  return {
    rates,
    isLoading,
    error,
    lastUpdated
  }
} 