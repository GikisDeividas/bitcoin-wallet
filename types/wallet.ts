export interface WalletTransaction {
  id: string
  type: 'sent' | 'received'
  amount: number
  date: string
  status: 'completed' | 'pending' | 'failed'
  from?: string
  to?: string
  txHash?: string
}

export interface WalletData {
  id: string
  name: string
  address: string
  balance: number
  transactions: WalletTransaction[]
  network: 'testnet' | 'mainnet'
  derivationPath: string
  createdAt: number
}

// This data is NEVER stored - only used temporarily during wallet creation
export interface WalletCreationData {
  name: string
  address: string
  network: 'testnet' | 'mainnet'
  derivationPath: string
}

// Temporary data for transaction signing - NEVER stored
export interface TransactionSigningData {
  mnemonic: string
  privateKey: string
  publicKey: string
}

export interface SendData {
  address: string
  amount: string
  usdAmount: string
  note: string
}
