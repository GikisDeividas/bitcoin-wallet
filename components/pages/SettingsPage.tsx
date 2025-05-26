"use client"

import React, { useState } from 'react'
import { 
  Settings, 
  ChevronRight, 
  Key, 
  Copy, 
  RefreshCw 
} from 'lucide-react'
import type { WalletData } from '@/types/wallet'

interface SettingsPageProps {
  activeWallet: WalletData | null
  wallets: WalletData[]
  settings: {
    pinEnabled: boolean
    pinCode: string
    autoLockTime: number
    hideBalance: boolean
    currency: string
    network: string
    notifications: boolean
  }
  onUpdateSettings: (newSettings: any) => void
  onNavigate: (page: 'home' | 'wallet' | 'send' | 'receive' | 'settings' | 'add-wallet' | 'pin-setup' | 'history' | 'swap') => void
  onClearWalletData: () => void
}

export default function SettingsPage({
  activeWallet,
  wallets,
  settings,
  onUpdateSettings,
  onNavigate,
  onClearWalletData
}: SettingsPageProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportMnemonic, setExportMnemonic] = useState('')
  const [exportedKey, setExportedKey] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const handleSettingToggle = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    onUpdateSettings(newSettings)
  }

  const exportPrivateKey = async () => {
    if (!activeWallet || !exportMnemonic.trim()) {
      setExportedKey('')
      return
    }

    setIsExporting(true)
    try {
      const { exportPrivateKey: exportKey } = await import('@/lib/bitcoin-wallet')
      const result = await exportKey(
        exportMnemonic,
        activeWallet.derivationPath || "m/44'/0'/0'/0/0",
        activeWallet.network || 'mainnet',
        activeWallet.address
      )
      setExportedKey(result.privateKey)
    } catch (error) {
      setExportedKey('Error: ' + (error instanceof Error ? error.message : 'Export failed'))
    } finally {
      setIsExporting(false)
    }
  }

  const clearWalletData = () => {
    if (confirm('Clear all wallet data? Make sure you have your seed phrases backed up.')) {
      onClearWalletData()
    }
  }

  return (
    <div className="h-full overflow-y-auto space-y-2">
      {/* Display */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100/50">
        <div className="p-3">
          <h3 className="font-medium text-gray-900 text-xs mb-3">Display</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-700">Hide Balance</div>
                <div className="text-xs text-gray-500">Hide amounts for privacy</div>
              </div>
              <button
                onClick={() => handleSettingToggle('hideBalance', !settings.hideBalance)}
                className={`w-10 h-5 rounded-full transition-all ${
                  settings.hideBalance ? 'bg-cyan-500' : 'bg-gray-200'
                }`}
                aria-label={`${settings.hideBalance ? 'Show' : 'Hide'} balance amounts`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.hideBalance ? 'translate-x-5' : 'translate-x-0.5'
                }`}></div>
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Display Currency</label>
              <select
                value={settings.currency}
                onChange={(e) => handleSettingToggle('currency', e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent bg-white"
                aria-label="Select display currency"
                title="Choose your preferred display currency"
              >
                <option value="USD">🇺🇸 USD - US Dollar</option>
                <option value="EUR">🇪🇺 EUR - Euro</option>
                <option value="GBP">🇬🇧 GBP - British Pound</option>
                <option value="JPY">🇯🇵 JPY - Japanese Yen</option>
                <option value="INR">🇮🇳 INR - Indian Rupee</option>
                <option value="AUD">🇦🇺 AUD - Australian Dollar</option>
                <option value="CHF">🇨🇭 CHF - Swiss Franc</option>
                <option value="BTC">₿ BTC - Bitcoin</option>
              </select>
              <div className="text-xs text-gray-500 mt-1">
                BTC balance is always shown. Fiat value updates every 30 seconds.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100/50">
        <div className="p-3">
          <h3 className="font-medium text-gray-900 text-xs mb-3">Security</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-700">PIN Protection</div>
                <div className="text-xs text-gray-500">{settings.pinEnabled ? 'Enabled' : 'Tap to setup'}</div>
              </div>
              <button
                onClick={() => {
                  if (!settings.pinEnabled) {
                    onNavigate('pin-setup')
                  } else {
                    handleSettingToggle('pinEnabled', false)
                    handleSettingToggle('pinCode', '')
                  }
                }}
                className={`w-10 h-5 rounded-full transition-all ${
                  settings.pinEnabled ? 'bg-cyan-500' : 'bg-gray-200'
                }`}
                aria-label={`${settings.pinEnabled ? 'Disable' : 'Enable'} PIN protection`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.pinEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-700">Notifications</div>
                <div className="text-xs text-gray-500">Transaction alerts</div>
              </div>
              <button
                onClick={() => handleSettingToggle('notifications', !settings.notifications)}
                className={`w-10 h-5 rounded-full transition-all ${
                  settings.notifications ? 'bg-cyan-500' : 'bg-gray-200'
                }`}
                aria-label={`${settings.notifications ? 'Disable' : 'Enable'} notifications`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.notifications ? 'translate-x-5' : 'translate-x-0.5'
                }`}></div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100/50">
        <div className="p-3">
          <button
            className="w-full flex items-center justify-between text-left"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <h3 className="font-medium text-gray-900 text-xs">Advanced</h3>
            <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
          </button>
          
          {showAdvanced && (
            <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Network</label>
                <select
                  value={settings.network}
                  onChange={(e) => handleSettingToggle('network', e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent bg-white"
                  aria-label="Select Bitcoin network"
                  title="Choose default network for new wallets"
                >
                  <option value="mainnet">Bitcoin Mainnet</option>
                  <option value="testnet">Bitcoin Testnet</option>
                </select>
              </div>

              <div className="space-y-1">
                {activeWallet && (
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg p-2 text-xs font-medium active:scale-95 transition-all text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Key className="w-3 h-3" />
                      <span>Export Private Key</span>
                    </div>
                  </button>
                )}

                <button
                  onClick={clearWalletData}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 rounded-lg p-2 text-xs font-medium active:scale-95 transition-all text-left"
                >
                  Clear All Wallet Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* About - Compact */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100/50">
        <div className="p-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs font-medium text-gray-900">Rabbit Wallet</div>
              <div className="text-xs text-gray-500">v1.0.0 • {wallets.length} wallets</div>
            </div>
            <div className="w-6 h-6 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-full flex items-center justify-center">
              <div className="text-cyan-600 text-xs">🐰</div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Export Key</h3>
                <button
                  onClick={() => {
                    setShowExportModal(false)
                    setExportMnemonic('')
                    setExportedKey('')
                  }}
                  className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <span className="text-gray-600 text-xs">✕</span>
                </button>
              </div>

              {!exportedKey ? (
                <div className="space-y-3">
                  <textarea
                    placeholder="Enter seed phrase..."
                    value={exportMnemonic}
                    onChange={(e) => setExportMnemonic(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400 font-mono resize-none"
                    rows={3}
                  />
                  <button
                    className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl h-10 text-xs font-medium disabled:opacity-50 active:scale-95 transition-all"
                    onClick={exportPrivateKey}
                    disabled={isExporting || !exportMnemonic.trim()}
                  >
                    {isExporting ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Exporting...</span>
                      </div>
                    ) : (
                      'Export'
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono text-xs break-all max-h-24 overflow-y-auto">
                    {exportedKey}
                  </div>
                  <button
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl h-10 text-xs font-medium active:scale-95 transition-all"
                    onClick={() => {
                      if (!exportedKey.startsWith('Error:')) {
                        navigator.clipboard.writeText(exportedKey)
                      }
                    }}
                    disabled={exportedKey.startsWith('Error:')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 