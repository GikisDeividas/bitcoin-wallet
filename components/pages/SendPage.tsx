"use client"

import React, { useState, useEffect } from 'react'
import { 
  Send, 
  RefreshCw, 
  Check,
  QrCode
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

interface SendPageProps {
  activeWallet: WalletData | null
  bitcoinPrice: number | null
  formatCurrency: (amount: number, currency?: string, showSymbol?: boolean) => string
  onNavigate: (page: 'home' | 'wallet' | 'send' | 'receive' | 'settings' | 'add-wallet' | 'pin-setup') => void
  onUpdateWallet: (wallet: WalletData) => void
  settings: {
    currency: string
    showBalance: boolean
  }
  currencyRates?: ExchangeRates
  getPriceInCurrency?: (currency: string) => number | null
}

export default function SendPage({
  activeWallet,
  bitcoinPrice,
  formatCurrency,
  onNavigate,
  onUpdateWallet,
  settings,
  currencyRates,
  getPriceInCurrency
}: SendPageProps) {
  const [recipientAddress, setRecipientAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [amountUSD, setAmountUSD] = useState('')
  const [useUSD, setUseUSD] = useState(false)
  const [fee, setFee] = useState(10) // sat/vbyte
  const [mnemonic, setMnemonic] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showSeedInput, setShowSeedInput] = useState(false)
  const [txResult, setTxResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [addressError, setAddressError] = useState('')
  const [estimatedFee, setEstimatedFee] = useState(0)
  const [showQRScanner, setShowQRScanner] = useState(false)

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

  // Get automatic fee rate
  const getAutomaticFeeRate = async () => {
    try {
      const { getBlockchainService } = await import('@/lib/blockchain-service')
      const service = getBlockchainService(activeWallet?.network || 'mainnet')
      const feeEstimates = await service.getFeeEstimates()
      return feeEstimates.halfHourFee || 10
    } catch (error) {
      console.error('Failed to get fee estimates:', error)
      return 10
    }
  }

  // Validate Bitcoin address
  const validateAddress = (address: string) => {
    if (!address.trim()) {
      setAddressError('')
      return false
    }

    const network = activeWallet?.network || 'mainnet'
    const testnetP2PKH = /^[mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/
    const testnetBech32 = /^tb1[a-z0-9]{39,59}$/
    const mainnetP2PKH = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/
    const mainnetBech32 = /^bc1[a-z0-9]{39,59}$/
    
    const isTestnetAddress = testnetP2PKH.test(address) || testnetBech32.test(address)
    const isMainnetAddress = mainnetP2PKH.test(address) || mainnetBech32.test(address)
    
    if (network === 'testnet' && isMainnetAddress) {
      setAddressError('Cannot send to mainnet address from testnet wallet')
      return false
    }
    
    if (network === 'mainnet' && isTestnetAddress) {
      setAddressError('Cannot send to testnet address from mainnet wallet')
      return false
    }
    
    if (!isTestnetAddress && !isMainnetAddress) {
      setAddressError('Invalid Bitcoin address format')
      return false
    }

    if (address === activeWallet?.address) {
      setAddressError('Cannot send to your own address')
      return false
    }
    
    setAddressError('')
    return true
  }

  // Estimate transaction fee
  const estimateTransactionFee = async () => {
    if (!activeWallet || !amount) return

    try {
      const { getBlockchainService } = await import('@/lib/blockchain-service')
      const service = getBlockchainService(activeWallet.network || 'mainnet')
      const utxos = await service.getAddressUTXOs(activeWallet.address)
      
      const currentFeeRate = await getAutomaticFeeRate()
      setFee(currentFeeRate)
      
      const estimatedSize = (utxos.length * 148) + (2 * 34) + 10
      const estimatedFeeAmount = (estimatedSize * currentFeeRate) / 100000000
      
      setEstimatedFee(estimatedFeeAmount)
    } catch (error) {
      console.error('Fee estimation failed:', error)
    }
  }

  useEffect(() => {
    estimateTransactionFee()
  }, [amount, activeWallet])

  const sendTransaction = async () => {
    if (!activeWallet || !mnemonic.trim()) {
      setError('Please enter your seed phrase')
      return
    }

    if (!validateAddress(recipientAddress)) {
      setError('Please fix the address error before sending')
      return
    }

    const amountBTC = useUSD && bitcoinPrice ? parseFloat(amountUSD) / bitcoinPrice : parseFloat(amount)
    
    if (amountBTC + estimatedFee > activeWallet.balance) {
      setError(`Insufficient funds. Balance: ${activeWallet.balance.toFixed(6)} BTC, Required: ${(amountBTC + estimatedFee).toFixed(6)} BTC (including estimated fee)`)
      return
    }

    setIsSending(true)
    setError('')
    
    try {
      const { createTransactionSigner } = await import('@/lib/transaction-signer')
      const { isValidMnemonic } = await import('@/lib/bitcoin-wallet')
      const { getBlockchainService } = await import('@/lib/blockchain-service')
      
      if (!isValidMnemonic(mnemonic)) {
        throw new Error('Invalid seed phrase format')
      }

      const signer = createTransactionSigner(activeWallet.network || 'mainnet')
      
      const signedTx = await signer.createAndSignTransaction(
        mnemonic,
        activeWallet.derivationPath || "m/44'/0'/0'/0/0",
        recipientAddress,
        amountBTC,
        fee,
        activeWallet.address
      )

      const service = getBlockchainService(activeWallet.network || 'mainnet')
      const txid = await service.broadcastTransaction(signedTx.txHex)
      
      setTxResult({ 
        txid: signedTx.txid, 
        amount: amountBTC, 
        recipient: recipientAddress, 
        fee: signedTx.fee / 100000000 
      })
      
      // Update wallet balance locally
      const estimatedNewBalance = activeWallet.balance - amountBTC - (signedTx.fee / 100000000)
      const updatedWallet = {
        ...activeWallet,
        balance: Math.max(0, estimatedNewBalance),
        transactions: [{
          id: signedTx.txid,
          type: 'sent' as const,
          amount: amountBTC,
          date: new Date().toISOString(),
          status: 'pending' as const,
          from: activeWallet.address,
          to: recipientAddress,
          txHash: signedTx.txid
        }, ...(activeWallet.transactions || [])].slice(0, 50)
      }
      
      onUpdateWallet(updatedWallet)
      
      setMnemonic('')
      setRecipientAddress('')
      setAmount('')
      setAmountUSD('')
      setShowSeedInput(false)

    } catch (error) {
      console.error('Transaction failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed'
      setError(`Transaction failed: ${errorMessage}`)
    } finally {
      setIsSending(false)
    }
  }

  const canSend = recipientAddress.trim() && 
                 amount && 
                 parseFloat(amount) > 0 && 
                 activeWallet && 
                 parseFloat(amount) <= activeWallet.balance &&
                 !addressError

  if (!activeWallet) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Send className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">No wallet selected</p>
        </div>
      </div>
    )
  }

  // Success state
  if (txResult) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-cyan-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sent Successfully!</h3>
          <p className="text-gray-500 text-sm mb-6">Your Bitcoin has been sent</p>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 mb-6 border border-gray-100">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Amount</span>
                <span className="font-medium text-gray-900">{txResult.amount.toFixed(6)} BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Fee</span>
                <span className="font-medium text-gray-900">{txResult.fee.toFixed(6)} BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">TX ID</span>
                <span className="font-mono text-xs text-gray-900">{txResult.txid.slice(0,8)}...{txResult.txid.slice(-8)}</span>
              </div>
            </div>
          </div>

          <button
            className="w-full bg-cyan-100 hover:bg-cyan-200 text-cyan-600 rounded-3xl h-12 text-sm font-medium active:scale-95 transition-all"
            onClick={() => {
              setTxResult(null)
              setShowSeedInput(false)
            }}
          >
            Send Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Wallet Info */}
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 mb-4 border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">{activeWallet.name}</div>
            <div className="text-xs text-gray-500">{activeWallet.balance.toFixed(6)} BTC available</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {bitcoinPrice && settings.currency !== 'BTC' ? formatCurrency(getFiatValue(activeWallet.balance), settings.currency) : `${activeWallet.balance.toFixed(6)} BTC`}
            </div>
            <div className="text-xs text-gray-500">Balance</div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 space-y-4">
        {/* Recipient */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 border border-gray-100">
          <label className="text-sm font-medium text-gray-700 block mb-2">To</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Bitcoin address"
              value={recipientAddress}
              onChange={(e) => {
                setRecipientAddress(e.target.value)
                validateAddress(e.target.value)
              }}
              className={`w-full text-sm bg-transparent border-0 outline-0 font-mono placeholder-gray-400 pr-10 ${
                addressError ? 'text-red-600' : ''
              }`}
            />
            <button
              onClick={() => setShowQRScanner(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 bg-gray-50 hover:bg-gray-100 rounded-2xl flex items-center justify-center transition-colors"
              aria-label="Scan QR code"
            >
              <QrCode className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          {addressError && (
            <p className="text-red-500 text-xs mt-1">{addressError}</p>
          )}
        </div>

        {/* Amount */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Amount</label>
            <div className="flex bg-gray-100 rounded-2xl p-1">
              <button
                onClick={() => setUseUSD(false)}
                className={`px-3 py-1 text-xs font-medium rounded-xl ${
                  !useUSD ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                BTC
              </button>
              <button
                onClick={() => setUseUSD(true)}
                className={`px-3 py-1 text-xs font-medium rounded-xl ${
                  useUSD ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
                disabled={!bitcoinPrice}
              >
                USD
              </button>
            </div>
          </div>
          
          <input
            type="number"
            placeholder={useUSD ? "0.00" : "0.00000000"}
            value={useUSD ? amountUSD : amount}
            onChange={(e) => {
              if (useUSD) {
                setAmountUSD(e.target.value)
                if (bitcoinPrice && e.target.value) {
                  setAmount((parseFloat(e.target.value) / bitcoinPrice).toString())
                }
              } else {
                setAmount(e.target.value)
                if (bitcoinPrice && e.target.value) {
                  setAmountUSD((parseFloat(e.target.value) * bitcoinPrice).toString())
                }
              }
            }}
            className="w-full text-lg font-medium bg-transparent border-0 outline-0 placeholder-gray-400"
          />
          
                      {amount && bitcoinPrice && (
            <div className="text-xs font-medium text-gray-500 mt-1">
              ≈ {useUSD ? `${parseFloat(amount).toFixed(6)} BTC` : formatCurrency(parseFloat(amount) * bitcoinPrice)}
              {estimatedFee > 0 && (
                <span className="ml-2 text-cyan-600 font-medium">
                  + {estimatedFee.toFixed(6)} BTC network fee
                </span>
              )}
            </div>
          )}
        </div>

        {/* Network Fee Info */}
        {estimatedFee > 0 && (
          <div className="bg-cyan-50/80 backdrop-blur-sm rounded-3xl p-4 border border-cyan-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-cyan-800">Network Fee</div>
                <div className="text-xs text-cyan-600">Automatic • {fee} sat/vB</div>
              </div>
              <div className="text-sm font-medium text-cyan-800">
                {estimatedFee.toFixed(6)} BTC
              </div>
            </div>
          </div>
        )}

        {/* Send Button */}
        {canSend && !showSeedInput && (
          <button
            onClick={() => setShowSeedInput(true)}
            className="w-full bg-cyan-100 hover:bg-cyan-200 text-cyan-600 rounded-3xl h-12 text-sm font-medium active:scale-95 transition-all"
          >
            Continue
          </button>
        )}

        {/* Seed Input */}
        {showSeedInput && (
          <div className="space-y-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 border border-gray-100">
              <label className="text-sm font-medium text-gray-700 block mb-2">Seed Phrase</label>
              <textarea
                placeholder="Enter your seed phrase to sign the transaction..."
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                className="w-full h-20 text-sm bg-transparent border-0 outline-0 font-mono placeholder-gray-400 resize-none"
                rows={3}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-3xl p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowSeedInput(false)}
                className="flex-1 bg-gray-100 text-gray-700 rounded-3xl h-12 text-sm font-medium active:scale-95 transition-all"
              >
                Back
              </button>
              <button
                onClick={sendTransaction}
                disabled={!mnemonic.trim() || isSending}
                className="flex-1 bg-cyan-100 hover:bg-cyan-200 text-cyan-600 rounded-3xl h-12 text-sm font-medium disabled:opacity-50 active:scale-95 transition-all"
              >
                {isSending ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </div>
                ) : (
                  'Send Bitcoin'
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full mx-4">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-cyan-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <QrCode className="w-6 h-6 text-cyan-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Scan QR Code</h3>
              <p className="text-gray-500 text-sm">Position the QR code within the frame</p>
            </div>

            {/* QR Scanner Placeholder */}
            <div className="bg-gray-100 rounded-2xl h-40 flex items-center justify-center mb-6">
              <div className="text-center">
                <div className="w-16 h-16 border-2 border-dashed border-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <QrCode className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-xs">Camera access required</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowQRScanner(false)}
                className="flex-1 bg-gray-100 text-gray-700 rounded-2xl h-10 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // For now, just close the modal
                  // In a real implementation, this would start the camera
                  setShowQRScanner(false)
                }}
                className="flex-1 bg-cyan-100 hover:bg-cyan-200 text-cyan-600 rounded-2xl h-10 text-sm font-medium"
              >
                Start Camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 