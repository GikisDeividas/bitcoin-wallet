"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, ArrowLeft, Check, Eye, EyeOff, Copy, AlertTriangle, Shield } from "lucide-react"
import type { WalletData } from "@/types/wallet"
import { generateBitcoinWallet, importWalletFromMnemonic, isValidMnemonic } from "@/lib/bitcoin-wallet"

interface AddWalletModalProps {
  show: boolean
  onClose: () => void
  onAddWallet: (wallet: WalletData) => void
}

type Step = 'method' | 'name' | 'seed-display' | 'seed-confirm' | 'import-seed' | 'success'

export default function AddWalletModal({ show, onClose, onAddWallet }: AddWalletModalProps) {
  const [step, setStep] = useState<Step>('method')
  const [walletMethod, setWalletMethod] = useState<'generate' | 'import'>('generate')
  const [walletName, setWalletName] = useState('')
  const [generatedWallet, setGeneratedWallet] = useState<Awaited<ReturnType<typeof generateBitcoinWallet>> | null>(null)
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

  const reset = () => {
    setStep('method')
    setWalletMethod('generate')
    setWalletName('')
    setGeneratedWallet(null)
    setSeedVisible(false)
    setConfirmationWords(['', '', ''])
    setImportSeed('')
    setCopied(false)
    setConfirmationsChecked({ stored: false, backup: false, responsibility: false })
    onClose()
  }

  const handleMethodSelect = (method: 'generate' | 'import') => {
    setWalletMethod(method)
    setStep('name')
  }

  const handleNameSubmit = async () => {
    if (walletMethod === 'generate') {
      setIsGenerating(true)
      try {
        // Generate new wallet (now async)
        const wallet = await generateBitcoinWallet()
        setGeneratedWallet(wallet)
        setStep('seed-display')
      } catch (error) {
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
      setTimeout(() => setCopied(false), 2000)
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
    setIsGenerating(true)
    try {
      if (!isValidMnemonic(importSeed)) {
        throw new Error('Invalid seed phrase format')
      }
      
      const wallet = await importWalletFromMnemonic(importSeed)
      createWallet(wallet)
    } catch (error) {
      alert(`Error importing wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const createWallet = (walletData: Awaited<ReturnType<typeof generateBitcoinWallet>>) => {
    const newWallet: WalletData = {
      id: `wallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: walletName,
      address: walletData.address,
      balance: 0,
      transactions: []
    }
    
    onAddWallet(newWallet)
    setStep('success')
    
    setTimeout(() => {
      reset()
    }, 2000)
  }

  if (!show) return null

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-3xl p-4 w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 'method' ? 'Add Wallet' :
             step === 'name' ? 'Wallet Name' :
             step === 'seed-display' ? 'Your Seed Phrase' :
             step === 'seed-confirm' ? 'Confirm Seed Phrase' :
             step === 'import-seed' ? 'Import Wallet' :
             'Success!'}
          </h2>
          <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={reset}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {step === 'method' && (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm mb-4">Choose how you'd like to add your wallet:</p>
            
            <Button
              variant="outline"
              className="w-full p-4 h-auto rounded-lg border-2 hover:border-cyan-400 hover:bg-cyan-50"
              onClick={() => handleMethodSelect('generate')}
            >
              <div className="flex items-center">
                <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center mr-4">
                  <Shield className="w-6 h-6 text-cyan-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">Create New Wallet</div>
                  <div className="text-sm text-gray-500">Generate a new wallet with secure seed phrase</div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full p-4 h-auto rounded-lg border-2 hover:border-cyan-400 hover:bg-cyan-50"
              onClick={() => handleMethodSelect('import')}
            >
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mr-4">
                  <ArrowLeft className="w-6 h-6 text-gray-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">Import Existing Wallet</div>
                  <div className="text-sm text-gray-500">Restore wallet using seed phrase</div>
                </div>
              </div>
            </Button>
          </div>
        )}

        {step === 'name' && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              className="flex items-center gap-1 p-0 h-auto text-gray-600 hover:text-gray-900 text-sm"
              onClick={() => setStep('method')}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Wallet Name</label>
              <Input
                placeholder="Enter a name for your wallet"
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                className="rounded-lg h-10"
                autoFocus
              />
            </div>

            <Button
              className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-10"
              onClick={handleNameSubmit}
              disabled={!walletName.trim() || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Continue'}
            </Button>
          </div>
        )}

        {step === 'seed-display' && generatedWallet && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-red-800 text-sm">Critical Security Information</h3>
                  <p className="text-red-700 text-xs mt-1">
                    This seed phrase is the ONLY way to recover your wallet. Write it down and store it safely offline.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Your 12-Word Seed Phrase</label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setSeedVisible(!seedVisible)}
                  >
                    {seedVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={handleSeedCopy}
                  >
                    <Copy className="w-4 h-4" />
                    {copied && <span className="ml-1 text-xs">Copied!</span>}
                  </Button>
                </div>
              </div>
              
              <div className={`grid grid-cols-3 gap-2 p-4 bg-gray-50 rounded-lg border ${!seedVisible ? 'blur-sm' : ''}`}>
                {generatedWallet.mnemonic.split(' ').map((word, index) => (
                  <div key={index} className="flex items-center p-2 bg-white rounded border">
                    <span className="text-xs text-gray-500 w-6">{index + 1}.</span>
                    <span className="text-sm font-mono">{word}</span>
                  </div>
                ))}
              </div>
              
              {!seedVisible && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setSeedVisible(true)}
                    className="bg-white"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Show Seed Phrase
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs text-gray-600">
                ⚠️ Anyone with this seed phrase can access your Bitcoin. Never share it online or with anyone.
              </p>
              
              <Button
                className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-10"
                onClick={() => setStep('seed-confirm')}
                disabled={!seedVisible}
              >
                I've Written It Down Safely
              </Button>
            </div>
          </div>
        )}

        {step === 'seed-confirm' && generatedWallet && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              className="flex items-center gap-1 p-0 h-auto text-gray-600 hover:text-gray-900 text-sm"
              onClick={() => setStep('seed-display')}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            <p className="text-sm text-gray-600 mb-4">
              Please enter the following words from your seed phrase to confirm you've written it down correctly:
            </p>

            <div className="space-y-3">
              {[2, 5, 8].map((wordIndex, i) => (
                <div key={i}>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Word #{wordIndex + 1}
                  </label>
                  <Input
                    placeholder={`Enter word #${wordIndex + 1}`}
                    value={confirmationWords[i]}
                    onChange={(e) => {
                      const newWords = [...confirmationWords]
                      newWords[i] = e.target.value
                      setConfirmationWords(newWords)
                    }}
                    className="rounded-lg h-9"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2 mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Please confirm:</p>
              
              {[
                { key: 'stored', text: 'I have stored my seed phrase in a safe place' },
                { key: 'backup', text: 'I understand this is my only backup' },
                { key: 'responsibility', text: 'I take full responsibility for securing my seed phrase' }
              ].map(({ key, text }) => (
                <label key={key} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={confirmationsChecked[key as keyof typeof confirmationsChecked]}
                    onChange={(e) => setConfirmationsChecked(prev => ({
                      ...prev,
                      [key]: e.target.checked
                    }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">{text}</span>
                </label>
              ))}
            </div>

            <Button
              className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-10"
              onClick={handleSeedConfirm}
              disabled={
                confirmationWords.some(word => !word.trim()) ||
                !Object.values(confirmationsChecked).every(Boolean)
              }
            >
              Create Wallet
            </Button>
          </div>
        )}

        {step === 'import-seed' && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              className="flex items-center gap-1 p-0 h-auto text-gray-600 hover:text-gray-900 text-sm"
              onClick={() => setStep('name')}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Seed Phrase</label>
              <textarea
                placeholder="Enter your 12-word seed phrase separated by spaces"
                value={importSeed}
                onChange={(e) => setImportSeed(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none h-24 text-sm"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter your 12-word recovery phrase separated by spaces
              </p>
            </div>

            <Button
              className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-10"
              onClick={handleImportSubmit}
              disabled={!importSeed.trim() || isGenerating}
            >
              {isGenerating ? 'Importing...' : 'Import Wallet'}
            </Button>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Wallet Created!</h2>
            <p className="text-sm text-gray-600">Your Bitcoin wallet "{walletName}" has been created successfully.</p>
          </div>
        )}
      </div>
    </div>
  )
}
