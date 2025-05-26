"use client"

import React, { useState } from 'react'
import { 
  Wallet, 
  RefreshCw, 
  Plus, 
  Key, 
  Copy, 
  ChevronRight 
} from 'lucide-react'
import type { WalletData } from '@/types/wallet'

interface ExchangeRates {
  USD: number
  EUR: number
  GBP: number
  JPY: number
  INR: number
  AUD: number
  CHF: number
}

interface WalletPageProps {
  wallets: WalletData[]
  selectedWallet: WalletData | null
  bitcoinPrice: number | null
  isRefreshing: boolean
  formatCurrency: (amount: number, currency?: string, showSymbol?: boolean) => string
  onSelectWallet: (wallet: WalletData) => void
  onNavigate: (page: 'home' | 'wallet' | 'send' | 'receive' | 'settings' | 'add-wallet' | 'pin-setup') => void
  onRefreshBalances: () => void
  settings: {
    currency: string
    showBalance: boolean
  }
  currencyRates?: ExchangeRates
  getPriceInCurrency?: (currency: string) => number | null
}

export default function WalletPage({
  wallets,
  selectedWallet,
  bitcoinPrice,
  isRefreshing,
  formatCurrency,
  onSelectWallet,
  onNavigate,
  onRefreshBalances,
  settings,
  currencyRates,
  getPriceInCurrency
}: WalletPageProps) {
  const [exportWalletId, setExportWalletId] = useState<string | null>(null)
  const [exportMnemonic, setExportMnemonic] = useState('')
  const [exportedKey, setExportedKey] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null)
  const [editWalletName, setEditWalletName] = useState('')

  // Fixed currency conversion logic using direct price data
  const getFiatValue = (btcAmount: number) => {
    if (settings.currency === 'BTC') return btcAmount
    
    // Use direct currency prices from CoinGecko if available
    if (getPriceInCurrency) {
      const priceInCurrency = getPriceInCurrency(settings.currency)
      if (priceInCurrency) {
        return btcAmount * priceInCurrency
      }
    }
    
    // Fallback to USD conversion with exchange rates
    if (!bitcoinPrice || !currencyRates) return 0
    
    const usdValue = btcAmount * bitcoinPrice
    const rate = currencyRates[settings.currency as keyof typeof currencyRates]
    
    if (settings.currency === 'USD') return usdValue
    return rate ? usdValue / rate : usdValue // Fixed: divide by rate for proper conversion
  }

  const exportPrivateKey = async (wallet: WalletData) => {
    if (!exportMnemonic.trim()) {
      alert('Please enter your seed phrase')
      return
    }

    setIsExporting(true)
    try {
      const { exportPrivateKey: exportKey } = await import('@/lib/bitcoin-wallet')
      const result = await exportKey(
        exportMnemonic,
        wallet.derivationPath || "m/44'/0'/0'/0/0",
        wallet.network || 'mainnet',
        wallet.address
      )
      setExportedKey(result.privateKey)
    } catch (error) {
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleEditWallet = (wallet: WalletData) => {
    setEditingWalletId(wallet.id)
    setEditWalletName(wallet.name)
  }

  const handleSaveWalletName = () => {
    if (!editWalletName.trim()) {
      alert('Please enter a wallet name')
      return
    }

    const wallet = wallets.find(w => w.id === editingWalletId)
    if (wallet) {
      const updatedWallet = { ...wallet, name: editWalletName.trim() }
      onSelectWallet(updatedWallet)
      
      // Update in storage
      const { walletStorage } = require('@/lib/storage')
      const updatedWallets = wallets.map(w => w.id === editingWalletId ? updatedWallet : w)
      walletStorage.saveWallets(updatedWallets)
    }

    setEditingWalletId(null)
    setEditWalletName('')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 px-1">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Wallets</h2>
          <p className="text-sm text-gray-500">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={onRefreshBalances}
          disabled={isRefreshing}
          className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
          aria-label="Refresh wallet balances"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Scrollable wallet list */}
      <div className="flex-1 overflow-y-auto space-y-3 -mx-4 px-4">
        {wallets.map((wallet) => (
          <div key={wallet.id} className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border transition-all ${
            selectedWallet?.id === wallet.id 
              ? 'border-cyan-200 bg-cyan-50/80' 
              : 'border-gray-100 hover:border-gray-200'
          }`}>
            <button
              className="w-full p-4 text-left"
              onClick={() => onSelectWallet(wallet)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selectedWallet?.id === wallet.id 
                      ? 'bg-gradient-to-br from-cyan-100 to-cyan-200' 
                      : 'bg-gradient-to-br from-gray-100 to-gray-200'
                  }`}>
                    <Wallet className={`w-5 h-5 ${
                      selectedWallet?.id === wallet.id ? 'text-cyan-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{wallet.name}</div>
                    <div className="text-sm text-gray-500 font-bold">{wallet.balance.toFixed(6)} BTC</div>
                    {bitcoinPrice && settings.currency !== 'BTC' && (
                      <div className="text-xs text-gray-400">
                        {formatCurrency(getFiatValue(wallet.balance), settings.currency)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 capitalize">{wallet.network}</div>
                  <div className="text-xs text-gray-400">
                    {wallet.transactions?.length || 0} txs
                  </div>
                  {selectedWallet?.id === wallet.id && (
                    <div className="w-2 h-2 bg-cyan-500 rounded-full mt-1 ml-auto"></div>
                  )}
                </div>
              </div>
            </button>
            
            {/* Action buttons for each wallet */}
            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={() => handleEditWallet(wallet)}
                className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl py-2 text-xs font-medium active:scale-95 transition-all"
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit</span>
                </div>
              </button>
              <button
                onClick={() => setExportWalletId(wallet.id)}
                className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl py-2 text-xs font-medium active:scale-95 transition-all"
              >
                <div className="flex items-center justify-center gap-2">
                  <Key className="w-3 h-3" />
                  <span>Export</span>
                </div>
              </button>
            </div>
          </div>
        ))}

        {wallets.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Wallets Yet</h3>
            <p className="text-gray-500 text-sm mb-6">Create your first Bitcoin wallet to get started</p>
          </div>
        )}
      </div>

      {/* Add wallet button - fixed at bottom */}
      <div className="pt-4 mt-4 border-t border-gray-100">
        <button
          className="w-full bg-cyan-100 hover:bg-cyan-200 text-cyan-600 rounded-2xl h-12 text-sm font-medium active:scale-95 transition-all"
          onClick={() => onNavigate('add-wallet')}
        >
          <div className="flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Add Wallet</span>
          </div>
        </button>
      </div>

      {/* Export Modal */}
      {exportWalletId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Export Private Key</h3>
                <button
                  onClick={() => {
                    setExportWalletId(null)
                    setExportMnemonic('')
                    setExportedKey('')
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <span className="text-gray-600">✕</span>
                </button>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
                <div className="text-red-800 text-sm">
                  <strong>⚠️ Security Warning</strong><br />
                  Never share your private key. Anyone with access can steal your Bitcoin.
                </div>
              </div>

              {!exportedKey ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Seed Phrase for {wallets.find(w => w.id === exportWalletId)?.name}
                    </label>
                    <textarea
                      placeholder="Enter your 12 or 24 word seed phrase..."
                      value={exportMnemonic}
                      onChange={(e) => setExportMnemonic(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent font-mono resize-none"
                      rows={3}
                    />
                  </div>

                  <button
                    className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-2xl h-12 text-sm font-medium disabled:opacity-50 active:scale-95 transition-all"
                    onClick={() => {
                      const wallet = wallets.find(w => w.id === exportWalletId)
                      if (wallet) exportPrivateKey(wallet)
                    }}
                    disabled={isExporting || !exportMnemonic.trim()}
                  >
                    {isExporting ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Exporting...</span>
                      </div>
                    ) : (
                      'Export Private Key'
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Private Key
                    </label>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-xs break-all">
                      {exportedKey}
                    </div>
                  </div>

                  <button
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-2xl h-12 text-sm font-medium active:scale-95 transition-all"
                    onClick={() => {
                      navigator.clipboard.writeText(exportedKey)
                      alert('Private key copied to clipboard')
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Copy className="w-4 h-4" />
                      <span>Copy Private Key</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Wallet Name Modal */}
      {editingWalletId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Edit Wallet Name</h3>
                <button
                  onClick={() => {
                    setEditingWalletId(null)
                    setEditWalletName('')
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <span className="text-gray-600">✕</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Wallet Name
                  </label>
                  <input
                    type="text"
                    value={editWalletName}
                    onChange={(e) => setEditWalletName(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                    placeholder="Enter wallet name"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingWalletId(null)
                      setEditWalletName('')
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl h-12 text-sm font-medium active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveWalletName}
                    disabled={!editWalletName.trim()}
                    className="flex-1 bg-cyan-100 hover:bg-cyan-200 text-cyan-600 rounded-2xl h-12 text-sm font-medium disabled:opacity-50 active:scale-95 transition-all"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 