import { walletStorage } from './storage'

export interface CostBasisEntry {
  transactionId: string
  walletId: string
  date: number
  amount: number // BTC amount
  type: 'buy' | 'sell' | 'received' | 'sent'
  priceAtTime: number // USD price when transaction occurred
  costBasis: number // USD cost basis
  currentValue?: number // Current USD value
  unrealizedPnL?: number // Current unrealized P&L
}

export interface PortfolioMetrics {
  totalCostBasis: number
  currentValue: number
  totalUnrealizedPnL: number
  totalRealizedPnL: number
  dayPnL: number
  weekPnL: number
  monthPnL: number
  yearPnL: number
}

class CostBasisService {
  private readonly COINGECKO_API_KEY = 'CG-psh8FpdPnabRcc9BiHhWXmji'
  private priceCache = new Map<string, number>()

  // Fetch historical Bitcoin price for a specific date
  async getHistoricalPrice(timestamp: number): Promise<number> {
    const dateKey = new Date(timestamp).toISOString().split('T')[0] // YYYY-MM-DD format
    
    // Check cache first
    if (this.priceCache.has(dateKey)) {
      return this.priceCache.get(dateKey)!
    }

    try {
      // Use CoinGecko API to get historical price
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${this.formatDateForAPI(timestamp)}&x_cg_demo_api_key=${this.COINGECKO_API_KEY}`,
        {
          headers: {
            'Accept': 'application/json',
            'x-cg-demo-api-key': this.COINGECKO_API_KEY,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`)
      }

      const data = await response.json()
      const price = data.market_data?.current_price?.usd || 0

      // Cache the result
      this.priceCache.set(dateKey, price)
      
      console.log(`📈 Historical price for ${dateKey}: $${price}`)
      return price
    } catch (error) {
      console.warn(`Failed to fetch historical price for ${dateKey}:`, error)
      
      // Fallback: use current price or estimate
      try {
        const currentPriceResponse = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&x_cg_demo_api_key=${this.COINGECKO_API_KEY}`
        )
        const currentData = await currentPriceResponse.json()
        const fallbackPrice = currentData.bitcoin?.usd || 50000 // Default fallback
        
        this.priceCache.set(dateKey, fallbackPrice)
        return fallbackPrice
      } catch {
        // Ultimate fallback
        const fallbackPrice = 50000
        this.priceCache.set(dateKey, fallbackPrice)
        return fallbackPrice
      }
    }
  }

  private formatDateForAPI(timestamp: number): string {
    const date = new Date(timestamp)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}` // DD-MM-YYYY format for CoinGecko
  }

  // Calculate cost basis for all transactions
  async calculateCostBasis(walletId: string, transactions: any[]): Promise<CostBasisEntry[]> {
    const costBasisEntries: CostBasisEntry[] = []

    for (const tx of transactions) {
      try {
        const historicalPrice = await this.getHistoricalPrice(tx.date)
        
        const entry: CostBasisEntry = {
          transactionId: tx.id || `${tx.date}-${tx.amount}`,
          walletId,
          date: tx.date,
          amount: Math.abs(tx.amount),
          type: tx.type === 'received' ? 'received' : 'sent',
          priceAtTime: historicalPrice,
          costBasis: Math.abs(tx.amount) * historicalPrice,
        }

        costBasisEntries.push(entry)
      } catch (error) {
        console.warn(`Failed to calculate cost basis for transaction ${tx.id}:`, error)
      }
    }

    // Save to storage
    this.saveCostBasisEntries(walletId, costBasisEntries)
    
    return costBasisEntries
  }

  // Calculate portfolio metrics with current Bitcoin price
  calculatePortfolioMetrics(
    costBasisEntries: CostBasisEntry[], 
    currentBtcPrice: number,
    totalBtcBalance: number
  ): PortfolioMetrics {
    const now = Date.now()
    const oneDayAgo = now - (24 * 60 * 60 * 1000)
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000)
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000)
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000)

    // Calculate total cost basis (only for received/bought transactions)
    const receivedEntries = costBasisEntries.filter(entry => entry.type === 'received')
    const totalCostBasis = receivedEntries.reduce((sum, entry) => sum + entry.costBasis, 0)

    // Current portfolio value
    const currentValue = totalBtcBalance * currentBtcPrice

    // Total unrealized P&L
    const totalUnrealizedPnL = currentValue - totalCostBasis

    // Calculate P&L for different time periods
    const dayEntries = costBasisEntries.filter(entry => entry.date >= oneDayAgo)
    const weekEntries = costBasisEntries.filter(entry => entry.date >= oneWeekAgo)
    const monthEntries = costBasisEntries.filter(entry => entry.date >= oneMonthAgo)
    const yearEntries = costBasisEntries.filter(entry => entry.date >= oneYearAgo)

    const calculatePeriodPnL = (entries: CostBasisEntry[]) => {
      const receivedInPeriod = entries.filter(e => e.type === 'received')
      const costBasisInPeriod = receivedInPeriod.reduce((sum, e) => sum + e.costBasis, 0)
      const btcInPeriod = receivedInPeriod.reduce((sum, e) => sum + e.amount, 0)
      const currentValueInPeriod = btcInPeriod * currentBtcPrice
      return currentValueInPeriod - costBasisInPeriod
    }

    return {
      totalCostBasis,
      currentValue,
      totalUnrealizedPnL,
      totalRealizedPnL: 0, // TODO: Calculate from sell transactions
      dayPnL: calculatePeriodPnL(dayEntries),
      weekPnL: calculatePeriodPnL(weekEntries),
      monthPnL: calculatePeriodPnL(monthEntries),
      yearPnL: calculatePeriodPnL(yearEntries),
    }
  }

  // Storage methods
  private saveCostBasisEntries(walletId: string, entries: CostBasisEntry[]) {
    const key = `cost-basis-${walletId}`
    localStorage.setItem(key, JSON.stringify(entries))
  }

  loadCostBasisEntries(walletId: string): CostBasisEntry[] {
    const key = `cost-basis-${walletId}`
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  }

  // Update cost basis entries with current values
  updateCurrentValues(entries: CostBasisEntry[], currentBtcPrice: number): CostBasisEntry[] {
    return entries.map(entry => ({
      ...entry,
      currentValue: entry.amount * currentBtcPrice,
      unrealizedPnL: (entry.amount * currentBtcPrice) - entry.costBasis
    }))
  }

  // Get aggregated cost basis for all wallets
  async getAggregatedCostBasis(wallets: any[], currentBtcPrice: number): Promise<{
    entries: CostBasisEntry[]
    metrics: PortfolioMetrics
  }> {
    let allEntries: CostBasisEntry[] = []
    let totalBtcBalance = 0

    for (const wallet of wallets) {
      // Load existing entries or calculate new ones
      let entries = this.loadCostBasisEntries(wallet.id)
      
      if (entries.length === 0 && wallet.transactions?.length > 0) {
        entries = await this.calculateCostBasis(wallet.id, wallet.transactions)
      }

      // Update with current values
      entries = this.updateCurrentValues(entries, currentBtcPrice)
      
      allEntries = [...allEntries, ...entries]
      totalBtcBalance += wallet.balance || 0
    }

    const metrics = this.calculatePortfolioMetrics(allEntries, currentBtcPrice, totalBtcBalance)

    return { entries: allEntries, metrics }
  }
}

export const costBasisService = new CostBasisService() 