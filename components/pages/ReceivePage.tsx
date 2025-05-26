"use client"

import React, { useState, useEffect, useRef } from 'react'
import { 
  Download, 
  Copy, 
  Check 
} from 'lucide-react'
import type { WalletData } from '@/types/wallet'

interface ReceivePageProps {
  activeWallet: WalletData | null
  onNavigate: (page: 'home' | 'wallet' | 'send' | 'receive' | 'settings' | 'add-wallet' | 'pin-setup') => void
}

export default function ReceivePage({
  activeWallet,
  onNavigate
}: ReceivePageProps) {
  const [copied, setCopied] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Generate QR code when wallet changes
  useEffect(() => {
    if (activeWallet?.address) {
      generateQRCode(activeWallet.address)
    }
  }, [activeWallet?.address])

  const generateQRCode = async (address: string) => {
    try {
      const QRCode = (await import('qrcode')).default
      const canvas = canvasRef.current
      if (canvas) {
        await QRCode.toCanvas(canvas, address, {
          width: 200,
          margin: 2,
          color: {
            dark: '#0891b2', // Cyan-600
            light: '#ffffff'
          }
        })
        const dataUrl = canvas.toDataURL()
        setQrCodeDataUrl(dataUrl)
      }
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  const copyAddress = () => {
    if (activeWallet) {
      navigator.clipboard.writeText(activeWallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!activeWallet) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Download className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-gray-500 text-xs">No wallet selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Compact Wallet Info */}
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-3 border border-gray-100/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-900">{activeWallet.name}</div>
            <div className="text-xs text-gray-500 capitalize">{activeWallet.network}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-gray-900">{activeWallet.balance.toFixed(6)} BTC</div>
            <div className="text-xs text-gray-400">Balance</div>
          </div>
        </div>
      </div>

      {/* Compact QR Code Section */}
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 border border-gray-100/30 text-center">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Receive Bitcoin</h3>
        <p className="text-gray-500 text-xs mb-4">Share this QR code or address</p>
        
        {/* QR Code */}
        <div className="flex justify-center mb-4">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            {qrCodeDataUrl ? (
              <img 
                src={qrCodeDataUrl} 
                alt="Bitcoin Address QR Code" 
                className="w-40 h-40"
              />
            ) : (
              <div className="w-40 h-40 bg-gray-50 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <div className="grid grid-cols-2 gap-0.5">
                      {Array.from({length: 4}).map((_, i) => (
                        <div key={i} className="w-1 h-1 bg-cyan-600 rounded-sm"></div>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">Generating...</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hidden canvas for QR generation */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Compact Address Section */}
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-3 border border-gray-100/30">
        <label className="text-xs font-medium text-gray-700 block mb-2">Bitcoin Address</label>
        <div className="bg-gray-50 rounded-lg p-2.5 mb-3">
          <div className="font-mono text-xs break-all text-gray-900 leading-relaxed">
            {activeWallet.address}
          </div>
        </div>
        
        <button
          onClick={copyAddress}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl h-10 text-xs font-medium active:scale-95 transition-all"
        >
          {copied ? (
            <div className="flex items-center justify-center gap-2">
              <Check className="w-3.5 h-3.5" />
              <span>Copied!</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Address</span>
            </div>
          )}
        </button>
      </div>

      {/* Compact Info Card */}
      <div className="bg-cyan-50/80 backdrop-blur-sm rounded-xl p-3 border border-cyan-100/50">
        <div className="flex items-start gap-2.5">
          <div className="w-5 h-5 bg-cyan-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-cyan-600 text-xs font-bold">i</span>
          </div>
          <div className="space-y-1">
            <div className="text-cyan-800 text-xs font-medium">Receiving Tips</div>
            <div className="text-cyan-700 text-xs space-y-0.5">
              <div>• Only send {activeWallet.network} Bitcoin to this address</div>
              <div>• Transactions confirm in 10-60 minutes</div>
              <div>• Safe to share publicly</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 