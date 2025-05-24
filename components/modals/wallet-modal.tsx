"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Wallet, Edit, Trash2, Check, Plus } from "lucide-react"
import type { WalletData } from "@/types/wallet"

interface ExtendedWalletData extends WalletData {
  isActive: boolean
  usdBalance: number
}

interface WalletModalProps {
  show: boolean
  onClose: () => void
  wallets: ExtendedWalletData[]
  editingWallet: string | null
  setEditingWallet: (id: string | null) => void
  switchWallet: (id: string) => void
  deleteWallet: (id: string) => void
  updateWalletName: (id: string, name: string) => void
  onAddWallet: () => void
}

export default function WalletModal({
  show,
  onClose,
  wallets,
  editingWallet,
  setEditingWallet,
  switchWallet,
  deleteWallet,
  updateWalletName,
  onAddWallet,
}: WalletModalProps) {
  if (!show) return null

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-3xl p-4 w-full max-h-[75vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">My Wallets</h2>
          <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-3 mb-4">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className={`p-3 rounded-xl border-2 transition-colors ${
                wallet.isActive ? "border-cyan-400 bg-cyan-50" : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      wallet.isActive ? "bg-cyan-400" : "bg-gray-200"
                    }`}
                  >
                    <Wallet className={`w-5 h-5 ${wallet.isActive ? "text-white" : "text-gray-600"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingWallet === wallet.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={wallet.name}
                          onChange={(e) => updateWalletName(wallet.id, e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setEditingWallet(null)}>
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium text-gray-900 text-sm truncate">{wallet.name}</div>
                        <div className="text-xs text-gray-500">{wallet.balance.toFixed(4)} BTC</div>
                        <div className="text-xs text-gray-500">${wallet.usdBalance.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!wallet.isActive && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8"
                        onClick={() => setEditingWallet(wallet.id)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {wallets.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8 text-red-500 hover:text-red-600"
                          onClick={() => deleteWallet(wallet.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {!wallet.isActive && (
                <Button
                  variant="outline"
                  className="w-full mt-3 rounded-lg h-9 text-sm"
                  onClick={() => switchWallet(wallet.id)}
                >
                  Switch to this wallet
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button
          className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-xl h-12 text-sm font-medium"
          onClick={onAddWallet}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Wallet
        </Button>
      </div>
    </div>
  )
}
