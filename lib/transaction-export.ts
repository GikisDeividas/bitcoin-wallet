import type { 
  EnhancedTransaction, 
  PortfolioSnapshot,
  TransactionExportData,
  PortfolioExportData
} from '@/types/transaction'
import type { WalletData } from '@/types/wallet'

export class TransactionExportService {
  
  // Export transactions to CSV format
  exportToCSV(
    transactions: EnhancedTransaction[], 
    portfolioSnapshot: PortfolioSnapshot | null,
    currency: string = 'USD'
  ): string {
    const headers = [
      'Date',
      'Time',
      'Type',
      'Category',
      'Amount (BTC)',
      'Net Amount (BTC)',
      `Value (${currency})`,
      `Cost Basis (${currency})`,
      `Realized P&L (${currency})`,
      `Unrealized P&L (${currency})`,
      'Fee (BTC)',
      'Fee Rate (sat/vB)',
      'Confirmations',
      'Status',
      'Transaction Hash',
      'From Addresses',
      'To Addresses',
      'Label',
      'Category',
      'Tags',
      'Notes',
      'Wallet'
    ]

    const rows = transactions.map(tx => {
      const date = new Date(tx.timestamp)
      const currentPrice = this.getCurrentBitcoinPrice(currency)
      const currentValue = Math.abs(tx.netAmount) * currentPrice
      const unrealizedPnL = tx.costBasis ? currentValue - tx.costBasis.totalCostBasis : 0

      return [
        date.toISOString().split('T')[0], // Date
        date.toTimeString().split(' ')[0], // Time
        tx.type,
        tx.direction,
        tx.netAmount.toFixed(8),
        tx.netAmount.toFixed(8),
        currentValue.toFixed(2),
        tx.costBasis?.totalCostBasis?.toFixed(2) || '0.00',
        tx.realizedPnL?.toFixed(2) || '0.00',
        unrealizedPnL.toFixed(2),
        (tx.fee.amount / 100000000).toFixed(8),
        tx.fee.rate.toFixed(1),
        tx.confirmations.toString(),
        tx.status,
        tx.txHash,
        tx.externalAddresses.join('; '),
        tx.ownedOutputAddresses.join('; '),
        tx.label || '',
        tx.category || '',
        tx.tags?.join(', ') || '',
        tx.notes || '',
        tx.walletName
      ]
    })

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return csvContent
  }

  // Export transactions to JSON format
  exportToJSON(
    transactions: EnhancedTransaction[],
    wallets: WalletData[],
    portfolioSnapshot: PortfolioSnapshot | null,
    currency: string = 'USD'
  ): PortfolioExportData {
    const currentPrice = this.getCurrentBitcoinPrice(currency)
    
    const exportData: PortfolioExportData = {
      wallets: wallets.map(wallet => ({
        id: wallet.id,
        name: wallet.name,
        balance: wallet.balance,
        costBasis: this.calculateWalletCostBasis(wallet, transactions),
        unrealizedPnL: this.calculateWalletUnrealizedPnL(wallet, transactions, currentPrice)
      })),
      transactions: transactions.map(tx => ({
        transaction: tx,
        fiatValue: Math.abs(tx.netAmount) * currentPrice,
        fiatCurrency: currency,
        exportTimestamp: Date.now()
      })),
      summary: portfolioSnapshot || this.createDefaultSnapshot(),
      exportTimestamp: Date.now(),
      exportFormat: 'json'
    }

    return exportData
  }

  // Download CSV file
  downloadCSV(
    transactions: EnhancedTransaction[],
    portfolioSnapshot: PortfolioSnapshot | null,
    currency: string = 'USD',
    filename?: string
  ) {
    const csvContent = this.exportToCSV(transactions, portfolioSnapshot, currency)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename || `rabbit-wallet-history-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download JSON file
  downloadJSON(
    transactions: EnhancedTransaction[],
    wallets: WalletData[],
    portfolioSnapshot: PortfolioSnapshot | null,
    currency: string = 'USD',
    filename?: string
  ) {
    const jsonData = this.exportToJSON(transactions, wallets, portfolioSnapshot, currency)
    const jsonString = JSON.stringify(jsonData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' })
    
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename || `rabbit-wallet-portfolio-${new Date().toISOString().split('T')[0]}.json`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Generate tax report (specialized CSV for tax purposes)
  exportTaxReport(
    transactions: EnhancedTransaction[],
    currency: string = 'USD',
    taxYear?: number
  ): string {
    const year = taxYear || new Date().getFullYear()
    const taxTransactions = transactions.filter(tx => {
      const txYear = new Date(tx.timestamp).getFullYear()
      return txYear === year && (tx.realizedPnL !== undefined && tx.realizedPnL !== 0)
    })

    const headers = [
      'Date Acquired',
      'Date Sold',
      'Asset',
      'Amount',
      'Cost Basis',
      'Sale Proceeds',
      'Gain/Loss',
      'Term',
      'Transaction Hash',
      'Notes'
    ]

    const rows = taxTransactions.map(tx => {
      const saleDate = new Date(tx.timestamp)
      const isLongTerm = tx.costBasis && 
        (tx.timestamp - (tx.costBasis as any).acquisitionDate) > (365 * 24 * 60 * 60 * 1000)

      return [
        tx.costBasis ? new Date((tx.costBasis as any).acquisitionDate || tx.timestamp).toISOString().split('T')[0] : '',
        saleDate.toISOString().split('T')[0],
        'Bitcoin (BTC)',
        Math.abs(tx.netAmount).toFixed(8),
        tx.costBasis?.totalCostBasis?.toFixed(2) || '0.00',
        tx.costBasis?.disposalProceeds?.toFixed(2) || '0.00',
        tx.realizedPnL?.toFixed(2) || '0.00',
        isLongTerm ? 'Long-term' : 'Short-term',
        tx.txHash,
        tx.notes || ''
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return csvContent
  }

  // Download tax report
  downloadTaxReport(
    transactions: EnhancedTransaction[],
    currency: string = 'USD',
    taxYear?: number,
    filename?: string
  ) {
    const year = taxYear || new Date().getFullYear()
    const csvContent = this.exportTaxReport(transactions, currency, year)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename || `rabbit-wallet-tax-report-${year}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Helper methods
  private getCurrentBitcoinPrice(currency: string): number {
    // This would normally fetch from the price service
    // For now, return a placeholder
    return 50000 // USD
  }

  private calculateWalletCostBasis(wallet: WalletData, transactions: EnhancedTransaction[]): number {
    return transactions
      .filter(tx => tx.walletId === wallet.id && tx.type === 'received' && tx.costBasis)
      .reduce((sum, tx) => sum + (tx.costBasis?.totalCostBasis || 0), 0)
  }

  private calculateWalletUnrealizedPnL(
    wallet: WalletData, 
    transactions: EnhancedTransaction[], 
    currentPrice: number
  ): number {
    const costBasis = this.calculateWalletCostBasis(wallet, transactions)
    const currentValue = wallet.balance * currentPrice
    return currentValue - costBasis
  }

  private createDefaultSnapshot(): PortfolioSnapshot {
    return {
      timestamp: Date.now(),
      totalBalance: 0,
      totalCostBasis: 0,
      currentValue: 0,
      unrealizedPnL: 0,
      realizedPnL: 0,
      dayChange: 0,
      weekChange: 0,
      monthChange: 0,
      yearChange: 0,
      roi: 0
    }
  }

  // Generate summary statistics
  generateSummaryStats(transactions: EnhancedTransaction[]): {
    totalTransactions: number
    totalReceived: number
    totalSent: number
    totalFees: number
    averageTransactionSize: number
    largestTransaction: number
    smallestTransaction: number
    totalRealizedPnL: number
    winRate: number
  } {
    const totalTransactions = transactions.length
    const receivedTxs = transactions.filter(tx => tx.type === 'received')
    const sentTxs = transactions.filter(tx => tx.type === 'sent')
    
    const totalReceived = receivedTxs.reduce((sum, tx) => sum + tx.totalReceived, 0)
    const totalSent = sentTxs.reduce((sum, tx) => sum + tx.totalSent, 0)
    const totalFees = transactions.reduce((sum, tx) => sum + (tx.fee.amount / 100000000), 0)
    
    const amounts = transactions.map(tx => Math.abs(tx.netAmount))
    const averageTransactionSize = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0
    const largestTransaction = amounts.length > 0 ? Math.max(...amounts) : 0
    const smallestTransaction = amounts.length > 0 ? Math.min(...amounts) : 0
    
    const realizedTxs = transactions.filter(tx => tx.realizedPnL !== undefined && tx.realizedPnL !== 0)
    const totalRealizedPnL = realizedTxs.reduce((sum, tx) => sum + (tx.realizedPnL || 0), 0)
    const profitableTxs = realizedTxs.filter(tx => (tx.realizedPnL || 0) > 0)
    const winRate = realizedTxs.length > 0 ? (profitableTxs.length / realizedTxs.length) * 100 : 0

    return {
      totalTransactions,
      totalReceived,
      totalSent,
      totalFees,
      averageTransactionSize,
      largestTransaction,
      smallestTransaction,
      totalRealizedPnL,
      winRate
    }
  }
}

// Export singleton instance
export const transactionExportService = new TransactionExportService() 