import type { 
  EnhancedTransaction, 
  TransactionInput, 
  TransactionOutput, 
  TransactionFee,
  CostBasisData,
  AddressOwnership,
  TransactionCategory,
  UTXO
} from '@/types/transaction'
import type { WalletData, WalletTransaction } from '@/types/wallet'

interface RawBitcoinTransaction {
  txid: string
  hash: string
  version: number
  size: number
  vsize: number
  weight: number
  locktime: number
  vin: Array<{
    txid: string
    vout: number
    scriptSig: {
      asm: string
      hex: string
    }
    prevout?: {
      scriptpubkey: string
      scriptpubkey_asm: string
      scriptpubkey_type: string
      scriptpubkey_address: string
      value: number
    }
    sequence: number
  }>
  vout: Array<{
    value: number
    n: number
    scriptpubkey: string
    scriptpubkey_asm: string
    scriptpubkey_type: string
    scriptpubkey_address?: string
  }>
  status: {
    confirmed: boolean
    block_height?: number
    block_hash?: string
    block_time?: number
  }
  fee: number
}

// UTXO with cost basis information
interface UTXOWithCostBasis {
  txid: string
  vout: number
  amount: number // in BTC
  acquisitionPrice: number // USD price when acquired
  acquisitionCost: number // Total USD cost
  acquisitionDate: number // timestamp
  walletId: string
  isSpent: boolean
  spentInTx?: string
  spentDate?: number
}

// Cost basis lot for tracking
interface CostBasisLot {
  amount: number // BTC amount
  acquisitionPrice: number // USD per BTC
  acquisitionCost: number // Total USD cost
  acquisitionDate: number // timestamp
  txid: string
  remainingAmount: number // BTC amount not yet spent
}

export class TransactionAnalyzer {
  private addressOwnership: Map<string, AddressOwnership> = new Map()
  private costBasisMethod: 'fifo' | 'lifo' | 'average' = 'fifo'
  private priceCache: Map<string, number> = new Map()
  
  // Enhanced cost basis tracking
  private utxoInventory: Map<string, UTXOWithCostBasis> = new Map() // key: txid:vout
  private costBasisLots: CostBasisLot[] = [] // Ordered list for FIFO/LIFO
  private totalAcquisitionCost: number = 0
  private totalBitcoinHeld: number = 0

  constructor() {
    this.loadAddressOwnership()
    this.loadCostBasisData()
  }

  // Load address ownership data from storage
  private loadAddressOwnership() {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('address-ownership')
        if (stored) {
          const data = JSON.parse(stored)
          this.addressOwnership = new Map(Object.entries(data))
        }
      }
    } catch (error) {
      console.warn('Failed to load address ownership data:', error)
    }
  }

  // Save address ownership data to storage
  private saveAddressOwnership() {
    try {
      if (typeof window !== 'undefined') {
        const data = Object.fromEntries(this.addressOwnership)
        localStorage.setItem('address-ownership', JSON.stringify(data))
      }
    } catch (error) {
      console.warn('Failed to save address ownership data:', error)
    }
  }

  // Load cost basis data from storage
  private loadCostBasisData() {
    try {
      if (typeof window !== 'undefined') {
        const utxoData = localStorage.getItem('utxo-inventory')
        if (utxoData) {
          const utxos = JSON.parse(utxoData)
          this.utxoInventory = new Map(Object.entries(utxos))
        }

        const lotsData = localStorage.getItem('cost-basis-lots')
        if (lotsData) {
          this.costBasisLots = JSON.parse(lotsData)
        }

        const totalsData = localStorage.getItem('cost-basis-totals')
        if (totalsData) {
          const totals = JSON.parse(totalsData)
          this.totalAcquisitionCost = totals.totalAcquisitionCost || 0
          this.totalBitcoinHeld = totals.totalBitcoinHeld || 0
        }
      }
    } catch (error) {
      console.warn('Failed to load cost basis data:', error)
    }
  }

  // Save cost basis data to storage
  private saveCostBasisData() {
    try {
      if (typeof window !== 'undefined') {
        // Save UTXO inventory
        const utxoData = Object.fromEntries(this.utxoInventory)
        localStorage.setItem('utxo-inventory', JSON.stringify(utxoData))

        // Save cost basis lots
        localStorage.setItem('cost-basis-lots', JSON.stringify(this.costBasisLots))

        // Save totals
        const totals = {
          totalAcquisitionCost: this.totalAcquisitionCost,
          totalBitcoinHeld: this.totalBitcoinHeld
        }
        localStorage.setItem('cost-basis-totals', JSON.stringify(totals))
      }
    } catch (error) {
      console.warn('Failed to save cost basis data:', error)
    }
  }

  // Register wallet addresses for ownership tracking
  registerWalletAddresses(wallet: WalletData, addresses: string[]) {
    addresses.forEach((address, index) => {
      this.addressOwnership.set(address, {
        address,
        walletId: wallet.id,
        derivationPath: `${wallet.derivationPath}/${index}`,
        isChange: index > 0, // First address is receiving, others are change
        totalReceived: 0,
        totalSent: 0,
        currentBalance: 0,
        transactionCount: 0
      })
    })
    this.saveAddressOwnership()
  }

  // Check if an address is owned by the user
  isOwnedAddress(address: string): boolean {
    return this.addressOwnership.has(address)
  }

  // Get wallet ID for an address
  getWalletIdForAddress(address: string): string | null {
    return this.addressOwnership.get(address)?.walletId || null
  }

  // Analyze a raw Bitcoin transaction
  async analyzeTransaction(
    rawTx: RawBitcoinTransaction, 
    walletId: string,
    walletName: string
  ): Promise<EnhancedTransaction> {
    // Parse inputs
    const inputs: TransactionInput[] = rawTx.vin.map(input => ({
      txid: input.txid,
      vout: input.vout,
      value: input.prevout?.value || 0,
      address: input.prevout?.scriptpubkey_address || '',
      isOwned: this.isOwnedAddress(input.prevout?.scriptpubkey_address || ''),
      scriptSig: input.scriptSig.hex
    }))

    // Parse outputs
    const outputs: TransactionOutput[] = rawTx.vout.map(output => ({
      value: output.value,
      address: output.scriptpubkey_address || '',
      isOwned: this.isOwnedAddress(output.scriptpubkey_address || ''),
      scriptPubKey: output.scriptpubkey,
      vout: output.n
    }))

    // Calculate fee
    const totalInputValue = inputs.reduce((sum, input) => sum + input.value, 0)
    const totalOutputValue = outputs.reduce((sum, output) => sum + output.value, 0)
    const fee: TransactionFee = {
      amount: rawTx.fee || (totalInputValue - totalOutputValue),
      rate: rawTx.fee / rawTx.vsize,
      size: rawTx.size
    }

    // Analyze transaction type and amounts
    const ownedInputs = inputs.filter(input => input.isOwned)
    const ownedOutputs = outputs.filter(output => output.isOwned)
    const externalOutputs = outputs.filter(output => !output.isOwned)

    const totalSent = ownedInputs.reduce((sum, input) => sum + input.value, 0)
    const totalReceived = ownedOutputs.reduce((sum, output) => sum + output.value, 0)
    const netAmount = totalReceived - totalSent

    // Determine transaction type
    let type: 'received' | 'sent' | 'self_transfer' | 'consolidation'
    let direction: 'incoming' | 'outgoing' | 'internal'

    if (ownedInputs.length === 0 && ownedOutputs.length > 0) {
      // Pure receive
      type = 'received'
      direction = 'incoming'
    } else if (ownedInputs.length > 0 && externalOutputs.length > 0) {
      // Sending to external addresses
      type = 'sent'
      direction = 'outgoing'
    } else if (ownedInputs.length > 0 && ownedOutputs.length > 0 && externalOutputs.length === 0) {
      // All outputs go to owned addresses
      if (ownedInputs.length > 1 && ownedOutputs.length === 1) {
        type = 'consolidation'
      } else {
        type = 'self_transfer'
      }
      direction = 'internal'
    } else {
      type = 'sent'
      direction = 'outgoing'
    }

    // Categorize addresses
    const ownedInputAddresses = ownedInputs.map(input => input.address)
    const ownedOutputAddresses = ownedOutputs.map(output => output.address)
    const externalAddresses = externalOutputs.map(output => output.address)
    const changeAddresses = ownedOutputs
      .filter(output => this.addressOwnership.get(output.address)?.isChange)
      .map(output => output.address)

    // Get cost basis data
    const costBasis = await this.calculateCostBasis(rawTx, type, Math.abs(netAmount))

    const enhancedTx: EnhancedTransaction = {
      id: rawTx.txid,
      txHash: rawTx.hash,
      blockHeight: rawTx.status.block_height,
      confirmations: rawTx.status.confirmed ? 6 : 0, // Simplified
      timestamp: rawTx.status.block_time ? rawTx.status.block_time * 1000 : Date.now(),
      
      inputs,
      outputs,
      fee,
      
      type,
      direction,
      netAmount: netAmount / 100000000, // Convert to BTC
      totalReceived: totalReceived / 100000000,
      totalSent: totalSent / 100000000,
      
      ownedInputAddresses,
      ownedOutputAddresses,
      externalAddresses,
      changeAddresses,
      
      costBasis,
      realizedPnL: costBasis?.realizedGainLoss,
      
      status: rawTx.status.confirmed ? 'confirmed' : 'pending',
      walletId,
      walletName
    }

    // Update address ownership statistics
    this.updateAddressStatistics(enhancedTx)

    return enhancedTx
  }

  // Calculate cost basis for a transaction
  private async calculateCostBasis(
    rawTx: RawBitcoinTransaction, 
    type: string, 
    amount: number
  ): Promise<CostBasisData | undefined> {
    try {
      const timestamp = rawTx.status.block_time ? rawTx.status.block_time * 1000 : Date.now()
      const priceAtTime = await this.getHistoricalPrice(timestamp)
      const btcAmount = amount / 100000000 // Convert satoshis to BTC
      
      const costBasisData: CostBasisData = {
        priceAtTime,
        totalCostBasis: btcAmount * priceAtTime,
        method: this.costBasisMethod
      }

      if (type === 'received') {
        // Record acquisition
        costBasisData.acquisitionCost = costBasisData.totalCostBasis
        this.recordAcquisition(rawTx.txid, btcAmount, priceAtTime, timestamp)
        
      } else if (type === 'sent') {
        // Calculate realized gain/loss using proper cost basis matching
        const disposalProceeds = costBasisData.totalCostBasis
        const acquisitionCost = this.calculateAcquisitionCost(btcAmount)
        
        costBasisData.disposalProceeds = disposalProceeds
        costBasisData.realizedGainLoss = disposalProceeds - acquisitionCost
        
        // Record disposal
        this.recordDisposal(btcAmount, timestamp, rawTx.txid)
      }

      return costBasisData
    } catch (error) {
      console.warn('Failed to calculate cost basis:', error)
      return undefined
    }
  }

  // Get historical Bitcoin price
  private async getHistoricalPrice(timestamp: number): Promise<number> {
    const dateKey = new Date(timestamp).toISOString().split('T')[0]
    
    if (this.priceCache.has(dateKey)) {
      return this.priceCache.get(dateKey)!
    }

    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${this.formatDateForAPI(timestamp)}`
      )
      const data = await response.json()
      const price = data.market_data?.current_price?.usd || 50000
      
      this.priceCache.set(dateKey, price)
      return price
    } catch (error) {
      console.warn('Failed to fetch historical price:', error)
      return 50000 // Fallback price
    }
  }

  private formatDateForAPI(timestamp: number): string {
    const date = new Date(timestamp)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  // Record Bitcoin acquisition (received transaction)
  private recordAcquisition(txid: string, amount: number, price: number, timestamp: number) {
    const acquisitionCost = amount * price

    // Add to cost basis lots
    const lot: CostBasisLot = {
      amount,
      acquisitionPrice: price,
      acquisitionCost,
      acquisitionDate: timestamp,
      txid,
      remainingAmount: amount
    }

    // Insert in correct position based on method
    if (this.costBasisMethod === 'fifo') {
      this.costBasisLots.push(lot) // FIFO: add to end
    } else if (this.costBasisMethod === 'lifo') {
      this.costBasisLots.unshift(lot) // LIFO: add to beginning
    } else {
      this.costBasisLots.push(lot) // Average: order doesn't matter
    }

    // Update totals
    this.totalAcquisitionCost += acquisitionCost
    this.totalBitcoinHeld += amount

    this.saveCostBasisData()
  }

  // Calculate acquisition cost for disposal (sent transaction)
  private calculateAcquisitionCost(amountToSell: number): number {
    if (this.costBasisMethod === 'average') {
      return this.calculateAverageCostBasis(amountToSell)
    }

    let remainingToSell = amountToSell
    let totalAcquisitionCost = 0

    // For FIFO/LIFO, we already have lots in correct order
    for (const lot of this.costBasisLots) {
      if (remainingToSell <= 0 || lot.remainingAmount <= 0) continue

      const amountFromThisLot = Math.min(remainingToSell, lot.remainingAmount)
      const costFromThisLot = amountFromThisLot * lot.acquisitionPrice

      totalAcquisitionCost += costFromThisLot
      remainingToSell -= amountFromThisLot

      if (remainingToSell <= 0) break
    }

    return totalAcquisitionCost
  }

  // Calculate average cost basis
  private calculateAverageCostBasis(amount: number): number {
    if (this.totalBitcoinHeld <= 0) return 0
    
    const averagePrice = this.totalAcquisitionCost / this.totalBitcoinHeld
    return amount * averagePrice
  }

  // Record Bitcoin disposal (sent transaction)
  private recordDisposal(amountToSell: number, timestamp: number, txid: string) {
    if (this.costBasisMethod === 'average') {
      this.recordAverageDisposal(amountToSell, timestamp)
      return
    }

    let remainingToSell = amountToSell

    // For FIFO/LIFO, consume lots in order
    for (const lot of this.costBasisLots) {
      if (remainingToSell <= 0 || lot.remainingAmount <= 0) continue

      const amountFromThisLot = Math.min(remainingToSell, lot.remainingAmount)
      
      // Update lot
      lot.remainingAmount -= amountFromThisLot
      
      // Update totals
      const costReduction = amountFromThisLot * lot.acquisitionPrice
      this.totalAcquisitionCost -= costReduction
      this.totalBitcoinHeld -= amountFromThisLot
      
      remainingToSell -= amountFromThisLot

      if (remainingToSell <= 0) break
    }

    // Clean up empty lots
    this.costBasisLots = this.costBasisLots.filter(lot => lot.remainingAmount > 0.00000001)

    this.saveCostBasisData()
  }

  // Record disposal using average cost method
  private recordAverageDisposal(amount: number, timestamp: number) {
    if (this.totalBitcoinHeld <= 0) return

    const averagePrice = this.totalAcquisitionCost / this.totalBitcoinHeld
    const costReduction = amount * averagePrice

    // Update totals
    this.totalAcquisitionCost -= costReduction
    this.totalBitcoinHeld -= amount

    // Proportionally reduce all lots
    const reductionRatio = amount / (this.totalBitcoinHeld + amount)
    
    this.costBasisLots.forEach(lot => {
      const lotReduction = lot.remainingAmount * reductionRatio
      lot.remainingAmount -= lotReduction
    })

    // Clean up empty lots
    this.costBasisLots = this.costBasisLots.filter(lot => lot.remainingAmount > 0.00000001)

    this.saveCostBasisData()
  }

  // Get current unrealized P&L
  getCurrentUnrealizedPnL(currentPrice: number): number {
    const currentValue = this.totalBitcoinHeld * currentPrice
    return currentValue - this.totalAcquisitionCost
  }

  // Get portfolio summary
  getPortfolioSummary(currentPrice: number) {
    return {
      totalBitcoinHeld: this.totalBitcoinHeld,
      totalAcquisitionCost: this.totalAcquisitionCost,
      currentValue: this.totalBitcoinHeld * currentPrice,
      unrealizedPnL: this.getCurrentUnrealizedPnL(currentPrice),
      averageCostBasis: this.totalBitcoinHeld > 0 ? this.totalAcquisitionCost / this.totalBitcoinHeld : 0,
      costBasisLots: this.costBasisLots.length,
      method: this.costBasisMethod
    }
  }

  // Reset cost basis data (for testing or fresh start)
  resetCostBasisData() {
    this.utxoInventory.clear()
    this.costBasisLots = []
    this.totalAcquisitionCost = 0
    this.totalBitcoinHeld = 0
    this.saveCostBasisData()
  }

  // Update address statistics
  private updateAddressStatistics(tx: EnhancedTransaction) {
    // Update statistics for owned addresses
    [...tx.ownedInputAddresses, ...tx.ownedOutputAddresses].forEach(address => {
      const ownership = this.addressOwnership.get(address)
      if (ownership) {
        ownership.transactionCount++
        ownership.lastUsed = tx.timestamp
        if (!ownership.firstUsed) {
          ownership.firstUsed = tx.timestamp
        }
      }
    })

    // Update sent/received amounts
    tx.inputs.forEach(input => {
      if (input.isOwned) {
        const ownership = this.addressOwnership.get(input.address)
        if (ownership) {
          ownership.totalSent += input.value / 100000000
        }
      }
    })

    tx.outputs.forEach(output => {
      if (output.isOwned) {
        const ownership = this.addressOwnership.get(output.address)
        if (ownership) {
          ownership.totalReceived += output.value / 100000000
        }
      }
    })

    this.saveAddressOwnership()
  }

  // Convert legacy transaction to enhanced transaction
  async convertLegacyTransaction(
    legacyTx: WalletTransaction,
    walletId: string,
    walletName: string
  ): Promise<EnhancedTransaction> {
    const timestamp = new Date(legacyTx.date).getTime()
    const amount = Math.abs(legacyTx.amount)
    
    // Create simplified enhanced transaction
    const enhancedTx: EnhancedTransaction = {
      id: legacyTx.id,
      txHash: legacyTx.txHash || legacyTx.id,
      confirmations: legacyTx.status === 'completed' ? 6 : 0,
      timestamp,
      
      // Simplified structure for legacy transactions
      inputs: [],
      outputs: [],
      fee: { amount: 0, rate: 0, size: 0 },
      
      type: legacyTx.type === 'received' ? 'received' : 'sent',
      direction: legacyTx.type === 'received' ? 'incoming' : 'outgoing',
      netAmount: legacyTx.type === 'received' ? amount : -amount,
      totalReceived: legacyTx.type === 'received' ? amount : 0,
      totalSent: legacyTx.type === 'sent' ? amount : 0,
      
      ownedInputAddresses: legacyTx.type === 'sent' ? [legacyTx.from || ''] : [],
      ownedOutputAddresses: legacyTx.type === 'received' ? [legacyTx.to || ''] : [],
      externalAddresses: legacyTx.type === 'sent' ? [legacyTx.to || ''] : [legacyTx.from || ''],
      changeAddresses: [],
      
      status: legacyTx.status === 'completed' ? 'confirmed' : 
              legacyTx.status === 'pending' ? 'pending' : 'failed',
      walletId,
      walletName
    }

    // Add cost basis
    enhancedTx.costBasis = await this.calculateCostBasis(
      {
        txid: legacyTx.id,
        status: { 
          confirmed: legacyTx.status === 'completed',
          block_time: Math.floor(timestamp / 1000)
        }
      } as any,
      enhancedTx.type,
      amount * 100000000 // Convert to satoshis
    )

    return enhancedTx
  }

  // Auto-categorize transaction based on patterns
  categorizeTransaction(tx: EnhancedTransaction): TransactionCategory {
    // Simple heuristics for auto-categorization
    if (tx.type === 'received') {
      if (tx.totalReceived < 0.001) return 'airdrop'
      if (tx.totalReceived > 1) return 'purchase'
      return 'transfer_in'
    } else if (tx.type === 'sent') {
      if (tx.totalSent < 0.01) return 'payment'
      return 'transfer_out'
    } else if (tx.type === 'consolidation') {
      return 'other'
    }
    
    return 'other'
  }

  // Get address ownership data
  getAddressOwnership(): Map<string, AddressOwnership> {
    return this.addressOwnership
  }

  // Set cost basis method
  setCostBasisMethod(method: 'fifo' | 'lifo' | 'average') {
    this.costBasisMethod = method
  }
}

// Export singleton instance
export const transactionAnalyzer = new TransactionAnalyzer() 