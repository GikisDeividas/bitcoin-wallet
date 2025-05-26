"use client"

import React, { useState, useEffect } from 'react'
import { Plus, Wallet, Download, Shield, Check, Copy, RefreshCw, ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WalletData } from '@/types/wallet'

interface AddWalletPageProps {
  wallets: WalletData[]
  onWalletCreated: (wallet: WalletData) => void
  onCancel: () => void
  setIsCreatingWallet: (creating: boolean) => void
}

type WalletStep = 'method' | 'name' | 'seed-display' | 'seed-confirm' | 'import-seed'

export default function AddWalletPage({ 
  wallets, 
  onWalletCreated, 
  onCancel,
  setIsCreatingWallet 
}: AddWalletPageProps) {
  const [step, setStep] = useState<WalletStep>('method')
  const [walletMethod, setWalletMethod] = useState<'generate' | 'import'>('generate')
  const [walletName, setWalletName] = useState('')
  const [generatedWallet, setGeneratedWallet] = useState<any>(null)
  const [seedVisible, setSeedVisible] = useState(false)
  const [confirmationWords, setConfirmationWords] = useState<string[]>(['', '', ''])
  const [importSeed, setImportSeed] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmationsChecked, setConfirmationsChecked] = useState({
    stored: false,
    backup: false,
    responsibility: false
  })
  const [isGenerating, setIsGenerating] = useState(false)

  // Set global flag when entering wallet creation
  useEffect(() => {
    setIsCreatingWallet(true)
    console.log('🚀 WALLET CREATION STARTED - Auto-refresh DISABLED')
    
    return () => {
      setIsCreatingWallet(false)
      console.log('🚀 WALLET CREATION ENDED - Auto-refresh ENABLED')
    }
  }, [setIsCreatingWallet])

  const resetAndGoBack = () => {
    setStep('method')
    setWalletMethod('generate')
    setWalletName('')
    setGeneratedWallet(null)
    setSeedVisible(false)
    setConfirmationWords(['', '', ''])
    setImportSeed('')
    setCopied(false)
    setConfirmationsChecked({ stored: false, backup: false, responsibility: false })
    
    setIsCreatingWallet(false)
    console.log('🚀 Wallet creation cancelled')
    onCancel()
  }

  const handleMethodSelect = (method: 'generate' | 'import') => {
    setWalletMethod(method)
    setStep('name')
  }

  const handleNameSubmit = async () => {
    if (!walletName.trim()) {
      alert('Please enter a wallet name')
      return
    }
    
    if (walletMethod === 'generate') {
      setIsGenerating(true)
      try {
        const network = 'mainnet'
        const { generateBitcoinWallet } = await import('@/lib/bitcoin-wallet')
        const wallet = await generateBitcoinWallet(network)
        setGeneratedWallet(wallet)
        setStep('seed-display')
      } catch (error) {
        console.error('Error generating wallet:', error)
        alert(`Error generating wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsGenerating(false)
      }
    } else {
      setStep('import-seed')
    }
  }

  const handleSeedCopy = () => {
    if (generatedWallet) {
      navigator.clipboard.writeText(generatedWallet.mnemonic)
      setCopied(true)
    }
  }

  const handleSeedConfirm = () => {
    if (!generatedWallet) return
    
    const words = generatedWallet.mnemonic.split(' ')
    const randomIndices = [2, 5, 8] // Check 3rd, 6th, and 9th words
    
    const isValid = randomIndices.every((index, i) => 
      confirmationWords[i].toLowerCase().trim() === words[index]
    )

    if (isValid && Object.values(confirmationsChecked).every(Boolean)) {
      createWallet(generatedWallet)
    } else {
      alert('Please verify the seed phrase words and confirm all statements.')
    }
  }

  const handleImportSubmit = async () => {
    if (!importSeed.trim()) {
      alert('Please enter a seed phrase')
      return
    }
    
    setIsGenerating(true)
    try {
      const { isValidMnemonic, importWalletFromMnemonic } = await import('@/lib/bitcoin-wallet')
      
      if (!isValidMnemonic(importSeed)) {
        throw new Error('Invalid seed phrase format')
      }
      
      const network = 'mainnet'
      const wallet = await importWalletFromMnemonic(importSeed, network)
      createWallet(wallet)
    } catch (error) {
      console.error('Error importing wallet:', error)
      alert(`Error importing wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const createWallet = (walletData: any) => {
    console.log('🚀 Creating wallet - final step')
    
    const newWallet: WalletData = {
      id: `wallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: walletName,
      address: walletData.address,
      balance: 0,
      transactions: [],
      network: walletData.network,
      derivationPath: walletData.derivationPath,
      createdAt: Date.now()
    }
    
    // Reset state
    setStep('method')
    setWalletMethod('generate')
    setWalletName('')
    setGeneratedWallet(null)
    setSeedVisible(false)
    setConfirmationWords(['', '', ''])
    setImportSeed('')
    setCopied(false)
    setConfirmationsChecked({ stored: false, backup: false, responsibility: false })
    
    setIsCreatingWallet(false)
    console.log('🚀 Wallet creation completed')
    
    onWalletCreated(newWallet)
  }

  // Method selection step
  if (step === 'method') {
    return (
      <div className="space-y-3 pb-2">
        {/* Back button for method selection */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={resetAndGoBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Wallet</span>
          </button>
          <button
            onClick={resetAndGoBack}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center active:scale-95 transition-all"
            aria-label="Cancel wallet creation"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Plus className="w-6 h-6 text-cyan-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Add New Wallet</h2>
          <p className="text-gray-600 text-xs">Choose how you'd like to add your wallet</p>
        </div>
        
        <Button
          variant="outline"
          className="w-full p-3 h-auto rounded-2xl border border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/50 active:scale-95 transition-all"
          onClick={() => handleMethodSelect('generate')}
        >
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-xl flex items-center justify-center mr-3">
              <Plus className="w-4 h-4 text-cyan-600" />
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-900 text-sm">Create New Wallet</div>
              <div className="text-xs text-gray-500 leading-tight">Generate a new wallet with<br />secure seed phrase</div>
            </div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="w-full p-3 h-auto rounded-2xl border border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/50 active:scale-95 transition-all"
          onClick={() => handleMethodSelect('import')}
        >
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center mr-3">
              <Download className="w-4 h-4 text-gray-600" />
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-900 text-sm">Import Existing Wallet</div>
              <div className="text-xs text-gray-500">Restore wallet using seed phrase</div>
            </div>
          </div>
        </Button>
      </div>
    )
  }

  // Name input step
  if (step === 'name') {
    return (
      <div className="space-y-3 pb-2">
        {/* Back button for name step */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setStep('method')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <button
            onClick={resetAndGoBack}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center active:scale-95 transition-all"
            aria-label="Cancel wallet creation"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-6 h-6 text-cyan-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Name Your Wallet</h2>
          <p className="text-gray-600 text-xs">Choose a name to identify this wallet</p>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-2">Wallet Name</label>
          <input
            type="text"
            placeholder="Enter a name for your wallet"
            value={walletName}
            onChange={(e) => setWalletName(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent bg-white"
            autoFocus
          />
        </div>

        <Button
          className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-2xl h-11 text-sm font-medium active:scale-95 transition-all"
          onClick={handleNameSubmit}
          disabled={isGenerating || !walletName.trim()}
        >
          {isGenerating ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              {walletMethod === 'generate' ? 'Generating...' : 'Next'}
            </div>
          ) : (
            walletMethod === 'generate' ? 'Generate Wallet' : 'Next'
          )}
        </Button>
      </div>
    )
  }

  // Seed phrase display step (for new wallets)
  if (step === 'seed-display') {
    return (
      <div className="space-y-3 pb-2">
        {/* Back button for seed display step */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setStep('name')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <button
            onClick={resetAndGoBack}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center active:scale-95 transition-all"
            aria-label="Cancel wallet creation"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Your Seed Phrase</h2>
          <p className="text-gray-600 text-xs">Write down these 12 words in order and store them safely</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <span className="text-red-800 text-xs font-medium">Critical Security Warning</span>
          </div>
          <ul className="text-red-700 text-xs space-y-0.5">
            <li>• This is the ONLY way to recover your Bitcoin</li>
            <li>• Anyone with this phrase can steal your funds</li>
            <li>• We never store these words - only you have them</li>
            <li>• Losing this phrase means losing your Bitcoin forever</li>
          </ul>
        </div>

        {generatedWallet && (
          <div className="bg-gray-50 rounded-2xl p-3 mb-3">
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-700">Seed Phrase</span>
            </div>
            
            {seedVisible ? (
              <div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {generatedWallet.mnemonic.split(' ').map((word: string, i: number) => (
                    <div key={i} className="bg-white rounded-xl p-2 text-center border border-gray-200">
                      <div className="text-xs text-gray-500">{i + 1}</div>
                      <div className="font-mono text-xs font-medium">{word}</div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-xs h-9 rounded-xl border-gray-200 hover:bg-gray-100"
                    onClick={handleSeedCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="flex-1 text-xs h-9 rounded-xl border-gray-200 hover:bg-gray-100"
                    onClick={() => setSeedVisible(false)}
                  >
                    Hide
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                className="text-center py-8 text-gray-500 cursor-pointer hover:bg-gray-100 rounded-xl transition-colors border-2 border-dashed border-gray-300"
                onClick={() => setSeedVisible(true)}
              >
                <p className="text-sm font-medium">Click to reveal seed phrase</p>
                <p className="text-xs mt-1">Take all the time you need</p>
              </div>
            )}
          </div>
        )}

        <Button
          className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-2xl h-11 text-sm font-medium active:scale-95 transition-all"
          onClick={() => setStep('seed-confirm')}
          disabled={!seedVisible}
        >
          I've Stored My Seed Phrase Safely
        </Button>
      </div>
    )
  }

  // Seed phrase confirmation step
  if (step === 'seed-confirm') {
    const words = generatedWallet?.mnemonic.split(' ') || []
    const randomIndices = [2, 5, 8] // Check 3rd, 6th, and 9th words
    
    return (
      <div className="space-y-3 pb-2">
        {/* Back button for seed confirmation step */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setStep('seed-display')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <button
            onClick={resetAndGoBack}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center active:scale-95 transition-all"
            aria-label="Cancel wallet creation"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-cyan-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-cyan-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Confirm Your Seed Phrase</h2>
          <p className="text-gray-600 text-xs">Enter the requested words to verify you wrote them down correctly</p>
        </div>

        <div className="space-y-3 mb-4">
          {randomIndices.map((wordIndex, i) => (
            <div key={i}>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Word #{wordIndex + 1}
              </label>
              <input
                type="text"
                placeholder={`Enter word #${wordIndex + 1}`}
                value={confirmationWords[i]}
                onChange={(e) => {
                  const newWords = [...confirmationWords]
                  newWords[i] = e.target.value
                  setConfirmationWords(newWords)
                }}
                className="w-full p-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent bg-white"
              />
            </div>
          ))}
        </div>

        <div className="space-y-2 mb-4">
          {[
            { key: 'stored', text: 'I have written down my seed phrase and stored it safely' },
            { key: 'backup', text: 'I understand this is the only way to recover my wallet' },
            { key: 'responsibility', text: 'I take full responsibility for keeping my seed phrase secure' }
          ].map(({ key, text }) => (
            <label key={key} className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmationsChecked[key as keyof typeof confirmationsChecked]}
                onChange={(e) => {
                  setConfirmationsChecked({
                    ...confirmationsChecked,
                    [key]: e.target.checked
                  })
                }}
                className="mt-0.5 w-4 h-4 text-cyan-600 rounded focus:ring-cyan-400"
              />
              <span className="text-xs text-gray-700">{text}</span>
            </label>
          ))}
        </div>

        <Button
          className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-2xl h-11 text-sm font-medium active:scale-95 transition-all"
          onClick={handleSeedConfirm}
          disabled={
            !randomIndices.every((index, i) => 
              confirmationWords[i].toLowerCase().trim() === words[index]
            ) || !Object.values(confirmationsChecked).every(Boolean)
          }
        >
          Create Wallet
        </Button>
      </div>
    )
  }

  // Import seed phrase step
  if (step === 'import-seed') {
    return (
      <div className="space-y-3 pb-2">
        {/* Back button for import step */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setStep('name')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <button
            onClick={resetAndGoBack}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center active:scale-95 transition-all"
            aria-label="Cancel wallet creation"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Download className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Import Wallet</h2>
          <p className="text-gray-600 text-xs">Enter your existing seed phrase to restore your wallet</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <span className="text-blue-800 text-xs font-medium">Import Instructions</span>
          </div>
          <ul className="text-blue-700 text-xs space-y-0.5">
            <li>• Enter your 12 or 24 word seed phrase</li>
            <li>• Separate each word with a space</li>
            <li>• Make sure the words are in the correct order</li>
            <li>• This will restore all associated addresses and funds</li>
          </ul>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-2">Seed Phrase</label>
          <textarea
            placeholder="Enter your seed phrase (12 or 24 words)..."
            value={importSeed}
            onChange={(e) => setImportSeed(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent font-mono resize-none bg-white"
            rows={3}
          />
        </div>

        <Button
          className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-2xl h-11 text-sm font-medium active:scale-95 transition-all"
          onClick={handleImportSubmit}
          disabled={isGenerating || !importSeed.trim()}
        >
          {isGenerating ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Importing Wallet...
            </div>
          ) : (
            'Import Wallet'
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-2">
      <div className="text-center">
        <p className="text-gray-600">Loading wallet creation...</p>
      </div>
    </div>
  )
} 