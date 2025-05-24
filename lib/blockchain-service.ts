"use client"

import { WalletTransaction } from '@/types/wallet'

export interface BlockchainBalance {
  confirmed: number
  unconfirmed: number
  total: number
}

export interface BlockchainTransaction {
  txid: string
  version: number
  locktime: number
  size: number
  weight: number
  fee: number
  vin: Array<{
    txid: string
    vout: number
    prevout: {
      scriptpubkey: string
      scriptpubkey_asm: string
      scriptpubkey_type: string
      scriptpubkey_address: string
      value: number
    }
    scriptsig: string
    scriptsig_asm: string
    is_coinbase: boolean
    sequence: number
  }>
  vout: Array<{
    scriptpubkey: string
    scriptpubkey_asm: string
    scriptpubkey_type: string
    scriptpubkey_address?: string
    value: number
  }>
  status: {
    confirmed: boolean
    block_height?: number
    block_hash?: string
    block_time?: number
  }
}

export interface UTXOInfo {
  txid: string
  vout: number
  value: number
  status: {
    confirmed: boolean
    block_height?: number
  }
}

export class BlockchainService {
  private readonly apiProviders = {
    testnet: [
      'https://mempool.space/testnet/api',          // Fastest response
      'https://blockstream.info/testnet/api',
      // CORS proxy fallbacks (slower but more reliable if CORS is an issue)
      'https://corsproxy.io/?https://mempool.space/testnet/api',
      'https://corsproxy.io/?https://blockstream.info/testnet/api'
    ],
    mainnet: [
      'https://mempool.space/api',                  // Fastest response
      'https://blockstream.info/api',
      // CORS proxy fallbacks (slower but more reliable if CORS is an issue)
      'https://corsproxy.io/?https://mempool.space/api',
      'https://corsproxy.io/?https://blockstream.info/api'
    ]
  }

  private cache = new Map<string, { data: any; timestamp: number }>()
  private readonly CACHE_DURATION = 10000 // 10 seconds cache for slower, less frequent requests
  private currentProviderIndex = 0

  constructor(private network: 'testnet' | 'mainnet') {}

  private getBaseUrl(): string {
    const providers = this.apiProviders[this.network]
    return providers[this.currentProviderIndex % providers.length]
  }

  private async fetchWithFallback<T>(endpoint: string, cacheKey?: string): Promise<T> {
    const key = cacheKey || endpoint
    const cached = this.cache.get(key)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log(`✅ Using cached data for ${endpoint}`)
      return cached.data
    }

    const providers = this.apiProviders[this.network]
    let lastError: Error | null = null
    const maxTimeout = 5000 // Reduced to 5 seconds for faster response

    // Try each provider with faster timeout
    for (let i = 0; i < providers.length; i++) {
      try {
        const baseUrl = providers[(this.currentProviderIndex + i) % providers.length]
        const fullUrl = `${baseUrl}${endpoint}`
        console.log(`🌐 Trying provider ${i + 1}/${providers.length}: ${baseUrl}`)
        
        // Create AbortController for better timeout control
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), maxTimeout)
        
        const response = await fetch(fullUrl, {
          headers: {
            'Accept': 'application/json',
          },
          mode: 'cors',
          signal: controller.signal
        })
        
        clearTimeout(timeoutId) // Clear timeout if request succeeds
        
        console.log(`📡 Response: ${response.status} ${response.statusText}`)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        this.cache.set(key, { data, timestamp: Date.now() })
        
        // Update successful provider index
        this.currentProviderIndex = (this.currentProviderIndex + i) % providers.length
        console.log(`✅ Success with provider: ${baseUrl}`)
        
        return data
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.warn(`❌ Provider ${i + 1} failed: ${providers[(this.currentProviderIndex + i) % providers.length]}`)
        
        // More specific error handling
        if (errorMessage.includes('aborted') || errorMessage.includes('timeout')) {
          console.warn(`⏰ Timeout after ${maxTimeout/1000}s`)
        } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('CORS')) {
          console.warn(`🚫 CORS/Network issue`)
        } else {
          console.warn(`🔥 Error: ${errorMessage}`)
        }
        
        lastError = error instanceof Error ? error : new Error('Unknown error')
        continue
      }
    }

    // If all providers failed but we have cached data (even expired), use it
    if (cached) {
      console.warn(`🆘 All providers failed, using stale cache from ${new Date(cached.timestamp).toLocaleTimeString()}`)
      console.warn(`Last error: ${lastError?.message}`)
      return cached.data
    }
    
    console.error(`💥 Complete failure - no data available for ${endpoint}`)
    throw lastError || new Error('All blockchain providers failed')
  }

  async getAddressBalance(address: string): Promise<BlockchainBalance> {
    try {
      // Validate address is compatible with current network
      const addressValidation = this.validateAddressNetwork(address)
      if (!addressValidation.isValid) {
        console.warn(`Address ${address} is not compatible with ${this.network}: ${addressValidation.reason}`)
        return { confirmed: 0, unconfirmed: 0, total: 0 }
      }

      const data = await this.fetchWithFallback<{
        address: string
        chain_stats: { funded_txo_count: number; funded_txo_sum: number; spent_txo_count: number; spent_txo_sum: number }
        mempool_stats: { funded_txo_count: number; funded_txo_sum: number; spent_txo_count: number; spent_txo_sum: number }
      }>(`/address/${address}`, `balance_${address}`)

      const confirmed = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum
      const unconfirmed = data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum
      
      return {
        confirmed: confirmed / 100000000, // Convert satoshis to BTC
        unconfirmed: unconfirmed / 100000000,
        total: (confirmed + unconfirmed) / 100000000
      }
    } catch (error) {
      console.error(`💥 Failed to fetch balance for ${address}:`, error instanceof Error ? error.message : 'Unknown error')
      
      // Check if we have any cached data (even expired) for this address
      const cachedKey = `balance_${address}`
      const cached = this.cache.get(cachedKey)
      if (cached) {
        console.warn(`🚨 Using expired cache for balance`)
        return cached.data
      }
      
      console.warn(`⚠️ No data available, returning zero balance`)
      // Return zero balance as safe fallback
      return { confirmed: 0, unconfirmed: 0, total: 0 }
    }
  }

  async getAddressTransactions(address: string): Promise<WalletTransaction[]> {
    try {
      // Validate address is compatible with current network
      const addressValidation = this.validateAddressNetwork(address)
      if (!addressValidation.isValid) {
        console.warn(`Address ${address} is not compatible with ${this.network}: ${addressValidation.reason}`)
        return []
      }

      const transactions = await this.fetchWithFallback<BlockchainTransaction[]>(
        `/address/${address}/txs`,
        `txs_${address}`
      )

      return transactions.map(tx => this.convertToWalletTransaction(tx, address))
    } catch (error) {
      console.error(`💥 Failed to fetch transactions for ${address}:`, error instanceof Error ? error.message : 'Unknown error')
      
      // Check if we have any cached data (even expired) for this address
      const cachedKey = `txs_${address}`
      const cached = this.cache.get(cachedKey)
      if (cached) {
        console.warn(`🚨 Using expired cache for transactions`)
        return cached.data.map((tx: BlockchainTransaction) => this.convertToWalletTransaction(tx, address))
      }
      
      console.warn(`⚠️ No transaction data available, returning empty array`)
      return []
    }
  }

  async getAddressUTXOs(address: string): Promise<UTXOInfo[]> {
    try {
      return await this.fetchWithFallback<UTXOInfo[]>(`/address/${address}/utxo`, `utxo_${address}`)
    } catch (error) {
      console.error(`Error fetching UTXOs for ${address}:`, error)
      return []
    }
  }

  async broadcastTransaction(txHex: string): Promise<string> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: txHex
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Transaction broadcast failed: ${errorText}`)
      }

      return await response.text() // Returns transaction ID
    } catch (error) {
      console.error('Error broadcasting transaction:', error)
      throw error
    }
  }

  private convertToWalletTransaction(tx: BlockchainTransaction, userAddress: string): WalletTransaction {
    // Calculate if this is incoming or outgoing transaction
    const isIncoming = tx.vout.some(output => 
      output.scriptpubkey_address === userAddress
    )
    
    const isOutgoing = tx.vin.some(input => 
      input.prevout?.scriptpubkey_address === userAddress
    )

    // Calculate amount
    let amount = 0
    if (isIncoming && !isOutgoing) {
      // Pure incoming
      amount = tx.vout
        .filter(output => output.scriptpubkey_address === userAddress)
        .reduce((sum, output) => sum + output.value, 0) / 100000000
    } else if (isOutgoing && !isIncoming) {
      // Pure outgoing
      amount = tx.vin
        .filter(input => input.prevout?.scriptpubkey_address === userAddress)
        .reduce((sum, input) => sum + input.prevout.value, 0) / 100000000
      
      // Subtract change returned to user
      const changeBack = tx.vout
        .filter(output => output.scriptpubkey_address === userAddress)
        .reduce((sum, output) => sum + output.value, 0) / 100000000
      
      amount = amount - changeBack
    } else if (isIncoming && isOutgoing) {
      // Self transaction or complex transaction
      const totalIn = tx.vin
        .filter(input => input.prevout?.scriptpubkey_address === userAddress)
        .reduce((sum, input) => sum + input.prevout.value, 0)
      
      const totalOut = tx.vout
        .filter(output => output.scriptpubkey_address === userAddress)
        .reduce((sum, output) => sum + output.value, 0)
      
      amount = Math.abs(totalOut - totalIn) / 100000000
    }

    const type: 'sent' | 'received' = isIncoming && !isOutgoing ? 'received' : 'sent'
    
    // Get other party address
    let otherAddress = ''
    if (type === 'sent') {
      // Find recipient address (not user's address)
      const recipient = tx.vout.find(output => 
        output.scriptpubkey_address && output.scriptpubkey_address !== userAddress
      )
      otherAddress = recipient?.scriptpubkey_address || ''
    } else {
      // Find sender address (not user's address)
      const sender = tx.vin.find(input => 
        input.prevout?.scriptpubkey_address && input.prevout.scriptpubkey_address !== userAddress
      )
      otherAddress = sender?.prevout?.scriptpubkey_address || ''
    }

    return {
      id: tx.txid,
      type,
      amount,
      date: tx.status.block_time ? new Date(tx.status.block_time * 1000).toISOString() : new Date().toISOString(),
      status: tx.status.confirmed ? 'completed' : 'pending',
      from: type === 'sent' ? userAddress : otherAddress,
      to: type === 'sent' ? otherAddress : userAddress,
      txHash: tx.txid
    }
  }

  async getTransactionDetails(txid: string): Promise<BlockchainTransaction | null> {
    try {
      return await this.fetchWithFallback<BlockchainTransaction>(`/tx/${txid}`, `tx_${txid}`)
    } catch (error) {
      console.error(`Error fetching transaction ${txid}:`, error)
      return null
    }
  }

  // Get current network fee estimates (satoshis per vbyte)
  async getFeeEstimates(): Promise<{ fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number; minimumFee: number }> {
    try {
      return await this.fetchWithFallback<any>('/fee-estimates', 'fee_estimates')
    } catch (error) {
      console.error('Error fetching fee estimates:', error)
      // Return fallback fees
      return {
        fastestFee: 20,
        halfHourFee: 15,
        hourFee: 10,
        economyFee: 5,
        minimumFee: 1
      }
    }
  }

  clearCache(): void {
    this.cache.clear()
  }

  // 🔍 VALIDATION: Check if address is compatible with current network
  private validateAddressNetwork(address: string): { isValid: boolean; reason?: string } {
    // Testnet address patterns
    const testnetP2PKH = /^[mn]/  // starts with 'm' or 'n'
    const testnetBech32 = /^tb1/  // starts with 'tb1'
    
    // Mainnet address patterns  
    const mainnetP2PKH = /^[13]/  // starts with '1' or '3'
    const mainnetBech32 = /^bc1/  // starts with 'bc1'
    
    const isTestnetAddress = testnetP2PKH.test(address) || testnetBech32.test(address)
    const isMainnetAddress = mainnetP2PKH.test(address) || mainnetBech32.test(address)
    
    if (this.network === 'testnet' && isMainnetAddress) {
      return { 
        isValid: false, 
        reason: 'Mainnet address cannot be queried on testnet' 
      }
    }
    
    if (this.network === 'mainnet' && isTestnetAddress) {
      return { 
        isValid: false, 
        reason: 'Testnet address cannot be queried on mainnet' 
      }
    }
    
    if (!isTestnetAddress && !isMainnetAddress) {
      return { 
        isValid: false, 
        reason: 'Invalid Bitcoin address format' 
      }
    }
    
    return { isValid: true }
  }
}

// Singleton instances for each network
let testnetService: BlockchainService | null = null
let mainnetService: BlockchainService | null = null

export function getBlockchainService(network: 'testnet' | 'mainnet'): BlockchainService {
  if (network === 'testnet') {
    if (!testnetService) {
      testnetService = new BlockchainService('testnet')
    }
    return testnetService
  } else {
    if (!mainnetService) {
      mainnetService = new BlockchainService('mainnet')
    }
    return mainnetService
  }
} 