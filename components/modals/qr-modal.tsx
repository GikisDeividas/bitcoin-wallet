"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Copy, Share } from "lucide-react"
import type { WalletData } from "@/types/wallet"

interface QRModalProps {
  show: boolean
  onClose: () => void
  wallet: WalletData
}

export default function QRModal({ show, onClose, wallet }: QRModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const generateQRCode = () => (
    <svg width="160" height="160" viewBox="0 0 200 200" className="bg-white p-3 rounded-xl">
      <rect width="200" height="200" fill="white" />
      <g fill="black">
        <rect x="10" y="10" width="50" height="50" />
        <rect x="140" y="10" width="50" height="50" />
        <rect x="10" y="140" width="50" height="50" />
        <rect x="20" y="20" width="30" height="30" fill="white" />
        <rect x="150" y="20" width="30" height="30" fill="white" />
        <rect x="20" y="150" width="30" height="30" fill="white" />
        <rect x="30" y="30" width="10" height="10" fill="black" />
        <rect x="160" y="30" width="10" height="10" fill="black" />
        <rect x="30" y="160" width="10" height="10" fill="black" />
        {/* Additional QR pattern elements */}
        <rect x="70" y="20" width="10" height="10" />
        <rect x="90" y="20" width="10" height="10" />
        <rect x="110" y="20" width="10" height="10" />
        <rect x="80" y="60" width="10" height="10" />
        <rect x="100" y="60" width="10" height="10" />
        <rect x="120" y="60" width="10" height="10" />
      </g>
    </svg>
  )

  if (!show) return null

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-4 mx-4 w-full max-w-sm max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Receive Bitcoin</h2>
          <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="text-center mb-4">
          <div className="flex justify-center mb-4">{generateQRCode()}</div>
          <p className="text-sm text-gray-600 mb-2">Scan this QR code to send Bitcoin to your wallet</p>
          <p className="text-sm font-medium text-gray-900">{wallet.name}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Your Bitcoin Address</label>
            <div className="bg-gray-50 rounded-lg p-3 border">
              <p className="text-sm text-gray-900 break-all font-mono leading-relaxed">{wallet.address}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 rounded-lg h-10 text-sm" onClick={handleCopyAddress}>
              <Copy className="w-4 h-4 mr-2" />
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-lg h-10 text-sm"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: "Bitcoin Address",
                    text: wallet.address,
                  })
                }
              }}
            >
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>

          <div className="bg-cyan-50 rounded-lg p-4">
            <p className="text-sm text-cyan-800 mb-3 font-medium">
              <strong>Testnet Address:</strong> This is a Bitcoin testnet address for testing purposes.
            </p>
            <p className="text-sm text-cyan-800">
              <strong>Get free test Bitcoin:</strong> Visit a testnet faucet like{' '}
              <a 
                href="https://coinfaucet.eu/en/btc-testnet/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline font-medium hover:text-cyan-900"
              >
                coinfaucet.eu
              </a>
              {' '}or{' '}
              <a 
                href="https://testnet-faucet.mempool.co/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline font-medium hover:text-cyan-900"
              >
                mempool testnet faucet
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
