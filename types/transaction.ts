// Enhanced Bitcoin Transaction Types for Comprehensive History Tracking

export interface UTXO {
  txid: string
  vout: number
  value: number // satoshis
  address: string
  scriptPubKey: string
  confirmations: number
  isOwned: boolean // whether this address belongs to the user
}

export interface TransactionInput {
  txid: string
  vout: number
  value: number // satoshis
  address: string
  isOwned: boolean
  scriptSig?: string
}

export interface TransactionOutput {
  value: number // satoshis
  address: string
  isOwned: boolean
  scriptPubKey: string
  vout: number
}

export interface TransactionFee {
  amount: number // satoshis
  rate: number // sat/vB
  size: number // bytes
}

export interface EnhancedTransaction {
  // Basic transaction data
  id: string
  txHash: string
  blockHeight?: number
  confirmations: number
  timestamp: number
  
  // Transaction structure
  inputs: TransactionInput[]
  outputs: TransactionOutput[]
  fee: TransactionFee
  
  // User-centric analysis
  type: 'received' | 'sent' | 'self_transfer' | 'consolidation'
  direction: 'incoming' | 'outgoing' | 'internal'
  netAmount: number // net BTC change for user (positive = received, negative = sent)
  totalReceived: number // total BTC received to owned addresses
  totalSent: number // total BTC sent from owned addresses
  
  // Address analysis
  ownedInputAddresses: string[]
  ownedOutputAddresses: string[]
  externalAddresses: string[]
  changeAddresses: string[]
  
  // Cost basis and P/L
  costBasis?: CostBasisData
  realizedPnL?: number
  
  // User metadata
  label?: string
  category?: TransactionCategory
  notes?: string
  tags?: string[]
  
  // Status
  status: 'confirmed' | 'pending' | 'failed'
  
  // Wallet context
  walletId: string
  walletName: string
}

export interface CostBasisData {
  priceAtTime: number // USD/BTC when transaction occurred
  totalCostBasis: number // USD cost basis for this transaction
  averageCostBasis?: number // average cost basis if using averaging method
  method: 'fifo' | 'lifo' | 'average' | 'specific'
  
  // For received transactions
  acquisitionCost?: number
  
  // For sent transactions
  disposalProceeds?: number
  realizedGainLoss?: number
}

export type TransactionCategory = 
  | 'purchase' 
  | 'sale' 
  | 'transfer_in' 
  | 'transfer_out' 
  | 'mining' 
  | 'airdrop' 
  | 'gift_received' 
  | 'gift_sent' 
  | 'payment' 
  | 'refund' 
  | 'exchange' 
  | 'dca' 
  | 'other'

export interface TransactionFilter {
  walletIds?: string[]
  types?: ('received' | 'sent' | 'self_transfer' | 'consolidation')[]
  categories?: TransactionCategory[]
  dateRange?: {
    start: number
    end: number
  }
  amountRange?: {
    min: number
    max: number
  }
  addresses?: string[]
  tags?: string[]
  searchQuery?: string
  status?: ('confirmed' | 'pending' | 'failed')[]
}

export interface TransactionGroup {
  date: string // YYYY-MM-DD
  transactions: EnhancedTransaction[]
  totalReceived: number
  totalSent: number
  netAmount: number
  realizedPnL: number
  unrealizedPnL: number
}

export interface PortfolioSnapshot {
  timestamp: number
  totalBalance: number // BTC
  totalCostBasis: number // USD
  currentValue: number // USD
  unrealizedPnL: number // USD
  realizedPnL: number // USD (lifetime)
  dayChange: number // USD
  weekChange: number // USD
  monthChange: number // USD
  yearChange: number // USD
  roi: number // percentage
}

export interface AddressOwnership {
  address: string
  walletId: string
  derivationPath: string
  isChange: boolean
  firstUsed?: number
  lastUsed?: number
  totalReceived: number
  totalSent: number
  currentBalance: number
  transactionCount: number
}

// Export data structures
export interface TransactionExportData {
  transaction: EnhancedTransaction
  fiatValue: number
  fiatCurrency: string
  exportTimestamp: number
}

export interface PortfolioExportData {
  wallets: {
    id: string
    name: string
    balance: number
    costBasis: number
    unrealizedPnL: number
  }[]
  transactions: TransactionExportData[]
  summary: PortfolioSnapshot
  exportTimestamp: number
  exportFormat: 'csv' | 'json' | 'pdf'
} 