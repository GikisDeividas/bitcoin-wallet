"use client"

import React, { useState } from 'react'
import { Lock, ArrowLeft } from 'lucide-react'

interface PinSetupPageProps {
  onPinCreated: (pin: string) => void
  onCancel: () => void
}

export default function PinSetupPage({ onPinCreated, onCancel }: PinSetupPageProps) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'create' | 'confirm'>('create')

  const handlePinSubmit = () => {
    if (step === 'create') {
      if (pin.length === 6) {
        setStep('confirm')
      }
    } else {
      if (pin === confirmPin) {
        onPinCreated(pin)
      } else {
        alert('PINs do not match')
        setConfirmPin('')
      }
    }
  }

  const handlePinInput = (digit: string) => {
    if (step === 'create') {
      if (pin.length < 6) {
        setPin(pin + digit)
      }
    } else {
      if (confirmPin.length < 6) {
        setConfirmPin(confirmPin + digit)
      }
    }
  }

  const handleBackspace = () => {
    if (step === 'create') {
      setPin(pin.slice(0, -1))
    } else {
      setConfirmPin(confirmPin.slice(0, -1))
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Setup PIN</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-cyan-600" />
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {step === 'create' ? 'Create PIN' : 'Confirm PIN'}
        </h2>
        
        <p className="text-gray-500 text-center mb-8">
          {step === 'create' 
            ? 'Choose a 6-digit PIN to secure your wallet'
            : 'Enter your PIN again to confirm'
          }
        </p>

        {/* PIN Display */}
        <div className="flex gap-3 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 ${
                (step === 'create' ? pin.length : confirmPin.length) > i
                  ? 'bg-cyan-600 border-cyan-600'
                  : 'border-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              onClick={() => handlePinInput(num.toString())}
              className="w-16 h-16 bg-gray-100 hover:bg-gray-200 rounded-2xl text-xl font-semibold text-gray-900 active:scale-95 transition-all"
            >
              {num}
            </button>
          ))}
          
          <div></div>
          
          <button
            onClick={() => handlePinInput('0')}
            className="w-16 h-16 bg-gray-100 hover:bg-gray-200 rounded-2xl text-xl font-semibold text-gray-900 active:scale-95 transition-all"
          >
            0
          </button>
          
          <button
            onClick={handleBackspace}
            className="w-16 h-16 bg-gray-100 hover:bg-gray-200 rounded-2xl text-xl font-semibold text-gray-900 active:scale-95 transition-all"
          >
            ⌫
          </button>
        </div>

        {/* Continue Button */}
        <button
          onClick={handlePinSubmit}
          disabled={(step === 'create' ? pin.length : confirmPin.length) !== 6}
          className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-300 text-white rounded-2xl py-4 text-sm font-medium active:scale-95 transition-all"
        >
          {step === 'create' ? 'Continue' : 'Create PIN'}
        </button>
      </div>
    </div>
  )
} 