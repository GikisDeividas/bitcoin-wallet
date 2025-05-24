"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, QrCode } from "lucide-react"
import type { WalletData, SendData } from "@/types/wallet"

interface SendModalProps {
  show: boolean
  onClose: () => void
  wallet: WalletData
  onSend?: (amount: number, address: string) => void
}

export default function SendModal({ show, onClose, wallet, onSend }: SendModalProps) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<SendData>({
    address: "",
    amount: "",
    usdAmount: "",
    note: "",
  })

  const btcPrice = 43247.82

  const handleAmountChange = (value: string, type: "btc" | "usd") => {
    if (type === "btc") {
      setData((prev) => ({
        ...prev,
        amount: value,
        usdAmount: value ? (Number.parseFloat(value) * btcPrice).toFixed(2) : "",
      }))
    } else {
      setData((prev) => ({
        ...prev,
        usdAmount: value,
        amount: value ? (Number.parseFloat(value) / btcPrice).toFixed(8) : "",
      }))
    }
  }

  const handleNext = () => {
    if (step === 1) {
      setStep(2)
    } else if (step === 2) {
      if (onSend) {
        onSend(parseFloat(data.amount), data.address)
      }
      setStep(3)
      setTimeout(() => {
        reset()
      }, 3000)
    }
  }

  const reset = () => {
    setStep(1)
    setData({ address: "", amount: "", usdAmount: "", note: "" })
    onClose()
  }

  if (!show) return null

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-4 mx-4 w-full max-w-sm max-h-[80vh] overflow-y-auto">
        {step === 1 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Send Bitcoin</h2>
              <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={reset}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="text-sm text-gray-600">Sending from</div>
              <div className="font-medium text-gray-900 text-sm">{wallet.name}</div>
              <div className="text-sm text-gray-500">{wallet.balance.toFixed(4)} BTC available</div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Recipient Address</label>
                <div className="relative">
                  <Input
                    placeholder="Enter Bitcoin address"
                    value={data.address}
                    onChange={(e) => setData((prev) => ({ ...prev, address: e.target.value }))}
                    className="rounded-lg pr-12 h-10 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 w-8 h-8"
                  >
                    <QrCode className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Amount (BTC)</label>
                  <Input
                    placeholder="0.00000000"
                    value={data.amount}
                    onChange={(e) => handleAmountChange(e.target.value, "btc")}
                    className="rounded-lg h-10 text-sm"
                    type="number"
                    step="0.00000001"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Amount (USD)</label>
                  <Input
                    placeholder="0.00"
                    value={data.usdAmount}
                    onChange={(e) => handleAmountChange(e.target.value, "usd")}
                    className="rounded-lg h-10 text-sm"
                    type="number"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Note (Optional)</label>
                <Input
                  placeholder="Add a note..."
                  value={data.note}
                  onChange={(e) => setData((prev) => ({ ...prev, note: e.target.value }))}
                  className="rounded-lg h-10 text-sm"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Network Fee</span>
                  <span className="text-gray-900">~$2.50</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-600">Total</span>
                  <span className="text-gray-900">
                    {data.usdAmount ? `$${(Number.parseFloat(data.usdAmount) + 2.5).toFixed(2)}` : "$2.50"}
                  </span>
                </div>
              </div>

              <Button
                className="w-full bg-slate-700 hover:bg-slate-800 text-white rounded-lg h-11 text-sm font-medium"
                onClick={handleNext}
                disabled={!data.address || !data.amount}
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Confirm Transaction</h2>
              <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={reset}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-1">{data.amount} BTC</div>
                  <div className="text-lg text-gray-600">${data.usdAmount}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">From</label>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-900">{wallet.name}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">To</label>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-900 break-all font-mono leading-relaxed">{data.address}</p>
                  </div>
                </div>

                {data.note && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">Note</label>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-900">{data.note}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-lg h-11 text-sm" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  className="flex-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg h-11 text-sm font-medium"
                  onClick={handleNext}
                >
                  Send Bitcoin
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Transaction Sent</h2>
            <p className="text-sm text-gray-600 mb-6">Your Bitcoin is being processed on the network</p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="text-lg font-bold text-gray-900 mb-2">{data.amount} BTC</div>
              <div className="text-sm text-gray-600 mb-1">From: {wallet.name}</div>
              <div className="text-sm text-gray-600">Transaction ID: tx1a2b3c4d5e6f...</div>
            </div>

            <p className="text-sm text-gray-500">You'll receive a notification when the transaction is confirmed</p>
          </div>
        )}
      </div>
    </div>
  )
}
