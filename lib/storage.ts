import type { WalletData } from '@/types/wallet'

// Storage keys
const STORAGE_KEYS = {
  WALLETS: 'bitcoin_wallet_wallets',
  SETTINGS: 'bitcoin_wallet_settings',
  PRICE_CACHE: 'bitcoin_wallet_price_cache',
  TRANSACTIONS: 'bitcoin_wallet_transactions',
  APP_VERSION: 'bitcoin_wallet_version',
} as const

// Current app version for data migration
const CURRENT_VERSION = '1.0.0'

// Types
interface PriceCacheData {
  price: number
  change24h: number
  lastUpdated: number
  timestamp: number
}

interface AppSettings {
  theme: 'light' | 'dark'
  currency: 'USD' | 'EUR' | 'GBP'
  notifications: boolean
  autoLock: boolean
  autoLockTime: number // minutes
}

interface TransactionData {
  id: string
  walletId: string
  type: 'sent' | 'received'
  amount: number
  address: string
  timestamp: number
  confirmed: boolean
  txHash?: string
}

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  currency: 'USD',
  notifications: true,
  autoLock: true,
  autoLockTime: 5,
}

// Storage utilities
class WalletStorage {
  // Check if localStorage is available
  private isStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined') return false
      const test = '__storage_test__'
      localStorage.setItem(test, 'test')
      localStorage.removeItem(test)
      return true
    } catch {
      return false
    }
  }

  // Safe get from localStorage
  private safeGet(key: string): string | null {
    if (!this.isStorageAvailable()) return null
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  // Safe set to localStorage
  private safeSet(key: string, value: string): boolean {
    if (!this.isStorageAvailable()) return false
    try {
      localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  }

  // Safe remove from localStorage
  private safeRemove(key: string): boolean {
    if (!this.isStorageAvailable()) return false
    try {
      localStorage.removeItem(key)
      return true
    } catch {
      return false
    }
  }

  // Initialize storage and handle migrations
  initialize(): void {
    if (!this.isStorageAvailable()) return

    const currentVersion = this.safeGet(STORAGE_KEYS.APP_VERSION)
    
    if (!currentVersion) {
      // First time setup
      this.safeSet(STORAGE_KEYS.APP_VERSION, CURRENT_VERSION)
      this.saveSettings(DEFAULT_SETTINGS)
    } else if (currentVersion !== CURRENT_VERSION) {
      // Handle version migration here in the future
      this.safeSet(STORAGE_KEYS.APP_VERSION, CURRENT_VERSION)
    }
  }

  // Wallet persistence
  saveWallets(wallets: WalletData[]): boolean {
    try {
      const data = JSON.stringify(wallets)
      return this.safeSet(STORAGE_KEYS.WALLETS, data)
    } catch {
      return false
    }
  }

  loadWallets(): WalletData[] {
    try {
      const data = this.safeGet(STORAGE_KEYS.WALLETS)
      if (!data) return []
      
      const wallets = JSON.parse(data) as WalletData[]
      
      // Validate wallet data structure
      return wallets.filter(wallet => 
        wallet &&
        typeof wallet.id === 'string' &&
        typeof wallet.name === 'string' &&
        typeof wallet.balance === 'number' &&
        typeof wallet.address === 'string'
      )
    } catch {
      return []
    }
  }

  // Settings persistence
  saveSettings(settings: Partial<AppSettings>): boolean {
    try {
      const currentSettings = this.loadSettings()
      const newSettings = { ...currentSettings, ...settings }
      const data = JSON.stringify(newSettings)
      return this.safeSet(STORAGE_KEYS.SETTINGS, data)
    } catch {
      return false
    }
  }

  loadSettings(): AppSettings {
    try {
      const data = this.safeGet(STORAGE_KEYS.SETTINGS)
      if (!data) return DEFAULT_SETTINGS
      
      const settings = JSON.parse(data) as AppSettings
      
      // Merge with defaults to handle missing properties
      return { ...DEFAULT_SETTINGS, ...settings }
    } catch {
      return DEFAULT_SETTINGS
    }
  }

  // Price cache persistence
  savePriceCache(priceData: PriceCacheData): boolean {
    try {
      const data = JSON.stringify(priceData)
      return this.safeSet(STORAGE_KEYS.PRICE_CACHE, data)
    } catch {
      return false
    }
  }

  loadPriceCache(): PriceCacheData | null {
    try {
      const data = this.safeGet(STORAGE_KEYS.PRICE_CACHE)
      if (!data) return null
      
      const cache = JSON.parse(data) as PriceCacheData
      
      // Check if cache is still valid (max 5 minutes old)
      const now = Date.now()
      const cacheAge = now - cache.timestamp
      const maxAge = 5 * 60 * 1000 // 5 minutes
      
      if (cacheAge > maxAge) {
        this.safeRemove(STORAGE_KEYS.PRICE_CACHE)
        return null
      }
      
      return cache
    } catch {
      return null
    }
  }

  // Transaction persistence
  saveTransactions(transactions: TransactionData[]): boolean {
    try {
      const data = JSON.stringify(transactions)
      return this.safeSet(STORAGE_KEYS.TRANSACTIONS, data)
    } catch {
      return false
    }
  }

  loadTransactions(): TransactionData[] {
    try {
      const data = this.safeGet(STORAGE_KEYS.TRANSACTIONS)
      if (!data) return []
      
      const transactions = JSON.parse(data) as TransactionData[]
      
      // Validate transaction data structure
      return transactions.filter(tx => 
        tx &&
        typeof tx.id === 'string' &&
        typeof tx.walletId === 'string' &&
        typeof tx.amount === 'number' &&
        ['sent', 'received'].includes(tx.type)
      )
    } catch {
      return []
    }
  }

  addTransaction(transaction: TransactionData): boolean {
    const transactions = this.loadTransactions()
    
    // Check if transaction already exists
    const exists = transactions.some(tx => tx.id === transaction.id)
    if (exists) return false
    
    transactions.unshift(transaction) // Add to beginning
    
    // Keep only last 100 transactions
    const limitedTransactions = transactions.slice(0, 100)
    
    return this.saveTransactions(limitedTransactions)
  }

  // Clear all data (for testing or reset)
  clearAll(): boolean {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        this.safeRemove(key)
      })
      return true
    } catch {
      return false
    }
  }

  // Export data for backup
  exportData(): string | null {
    try {
      const data = {
        wallets: this.loadWallets(),
        settings: this.loadSettings(),
        transactions: this.loadTransactions(),
        version: CURRENT_VERSION,
        timestamp: Date.now(),
      }
      return JSON.stringify(data, null, 2)
    } catch {
      return null
    }
  }

  // Get storage usage info
  getStorageInfo(): { used: number; available: boolean } {
    if (!this.isStorageAvailable()) {
      return { used: 0, available: false }
    }

    try {
      let used = 0
      Object.values(STORAGE_KEYS).forEach(key => {
        const data = this.safeGet(key)
        if (data) used += data.length
      })
      
      return { used, available: true }
    } catch {
      return { used: 0, available: false }
    }
  }
}

// Create singleton instance
export const walletStorage = new WalletStorage()

// Export types for use in components
export type { 
  PriceCacheData, 
  AppSettings, 
  TransactionData 
} 