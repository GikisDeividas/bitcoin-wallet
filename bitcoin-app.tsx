"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Send,
  Home,
  Wallet,
  Download,
  Settings,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Copy,
  Share,
  QrCode,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Check,
  ArrowLeft,
} from "lucide-react"

interface WalletData {
  id: string
  name: string
  address: string
  balance: number
  usdBalance: number
  isActive: boolean
}

export default function Component() {
  const [showQRModal, setShowQRModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showAddWalletModal, setShowAddWalletModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sendStep, setSendStep] = useState(1)
  const [editingWallet, setEditingWallet] = useState<string | null>(null)
  const [sendData, setSendData] = useState({
    address: "",
    amount: "",
    usdAmount: "",
    note: "",
  })

  const [walletCreationStep, setWalletCreationStep] = useState(1)
  const [walletCreationData, setWalletCreationData] = useState({
    name: "",
    method: "",
    seedPhrase: "",
    privateKey: "",
    derivationPath: "m/44'/0'/0'/0/0",
  })
  const [seedPhraseConfirmed, setSeedPhraseConfirmed] = useState(false)

  // Sample generated seed phrase
  const generatedSeedPhrase = [
    "abandon",
    "ability",
    "able",
    "about",
    "above",
    "absent",
    "absorb",
    "abstract",
    "absurd",
    "abuse",
    "access",
    "accident",
  ]

  const [wallets, setWallets] = useState<WalletData[]>([
    {
      id: "1",
      name: "Main Wallet",
      address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      balance: 0.7065,
      usdBalance: 30547.82,
      isActive: true,
    },
    {
      id: "2",
      name: "Savings",
      address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
      balance: 0.8234,
      usdBalance: 35612.45,
      isActive: false,
    },
    {
      id: "3",
      name: "Trading",
      address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      balance: 0.1566,
      usdBalance: 6772.23,
      isActive: false,
    },
  ])

  const activeWallet = wallets.find((w) => w.isActive) || wallets[0]
  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.usdBalance, 0)
  const totalBTC = wallets.reduce((sum, wallet) => sum + wallet.balance, 0)

  const btcPrice = 43247.82

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(activeWallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAmountChange = (value: string, type: "btc" | "usd") => {
    if (type === "btc") {
      setSendData((prev) => ({
        ...prev,
        amount: value,
        usdAmount: value ? (Number.parseFloat(value) * btcPrice).toFixed(2) : "",
      }))
    } else {
      setSendData((prev) => ({
        ...prev,
        usdAmount: value,
        amount: value ? (Number.parseFloat(value) / btcPrice).toFixed(8) : "",
      }))
    }
  }

  const handleSendNext = () => {
    if (sendStep === 1) {
      setSendStep(2)
    } else if (sendStep === 2) {
      setSendStep(3)
      setTimeout(() => {
        setSendStep(1)
        setSendData({ address: "", amount: "", usdAmount: "", note: "" })
        setShowSendModal(false)
      }, 3000)
    }
  }

  const resetSendModal = () => {
    setSendStep(1)
    setSendData({ address: "", amount: "", usdAmount: "", note: "" })
    setShowSendModal(false)
  }

  const switchWallet = (walletId: string) => {
    setWallets((prev) =>
      prev.map((wallet) => ({
        ...wallet,
        isActive: wallet.id === walletId,
      })),
    )
    setShowWalletModal(false)
  }

  const deleteWallet = (walletId: string) => {
    if (wallets.length <= 1) return

    setWallets((prev) => {
      const filtered = prev.filter((w) => w.id !== walletId)
      if (prev.find((w) => w.id === walletId)?.isActive) {
        filtered[0].isActive = true
      }
      return filtered
    })
  }

  const updateWalletName = (walletId: string, newName: string) => {
    setWallets((prev) => prev.map((wallet) => (wallet.id === walletId ? { ...wallet, name: newName } : wallet)))
    setEditingWallet(null)
  }

  const generateQRCode = (text: string) => {
    return (
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
          <rect x="70" y="20" width="10" height="10" />
          <rect x="90" y="20" width="10" height="10" />
          <rect x="110" y="20" width="10" height="10" />
          <rect x="70" y="40" width="10" height="10" />
          <rect x="110" y="40" width="10" height="10" />
          <rect x="80" y="60" width="10" height="10" />
          <rect x="100" y="60" width="10" height="10" />
          <rect x="120" y="60" width="10" height="10" />
          <rect x="20" y="80" width="10" height="10" />
          <rect x="40" y="80" width="10" height="10" />
          <rect x="70" y="80" width="10" height="10" />
          <rect x="90" y="80" width="10" height="10" />
          <rect x="110" y="80" width="10" height="10" />
          <rect x="130" y="80" width="10" height="10" />
          <rect x="150" y="80" width="10" height="10" />
          <rect x="170" y="80" width="10" height="10" />
          <rect x="30" y="100" width="10" height="10" />
          <rect x="50" y="100" width="10" height="10" />
          <rect x="80" y="100" width="10" height="10" />
          <rect x="120" y="100" width="10" height="10" />
          <rect x="140" y="100" width="10" height="10" />
          <rect x="160" y="100" width="10" height="10" />
          <rect x="20" y="120" width="10" height="10" />
          <rect x="60" y="120" width="10" height="10" />
          <rect x="80" y="120" width="10" height="10" />
          <rect x="100" y="120" width="10" height="10" />
          <rect x="140" y="120" width="10" height="10" />
          <rect x="180" y="120" width="10" height="10" />
          <rect x="70" y="160" width="10" height="10" />
          <rect x="90" y="160" width="10" height="10" />
          <rect x="110" y="160" width="10" height="10" />
          <rect x="130" y="160" width="10" height="10" />
          <rect x="150" y="160" width="10" height="10" />
          <rect x="170" y="160" width="10" height="10" />
          <rect x="70" y="180" width="10" height="10" />
          <rect x="110" y="180" width="10" height="10" />
          <rect x="130" y="180" width="10" height="10" />
          <rect x="170" y="180" width="10" height="10" />
        </g>
      </svg>
    )
  }

  const createWallet = () => {
    let newAddress = ""

    if (walletCreationData.method === "generate") {
      newAddress = `bc1q${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
    } else if (walletCreationData.method === "import-seed") {
      newAddress = `bc1q${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
    } else if (walletCreationData.method === "import-key") {
      newAddress = `bc1q${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
    } else if (walletCreationData.method === "watch-only") {
      newAddress = walletCreationData.privateKey.trim()
    }

    const newWallet: WalletData = {
      id: Date.now().toString(),
      name: walletCreationData.name,
      address: newAddress,
      balance: 0,
      usdBalance: 0,
      isActive: false,
    }

    setWallets((prev) => [...prev, newWallet])

    setWalletCreationData({
      name: "",
      method: "",
      seedPhrase: "",
      privateKey: "",
      derivationPath: "m/44'/0'/0'/0/0",
    })
    setWalletCreationStep(1)
    setSeedPhraseConfirmed(false)
    setShowAddWalletModal(false)
  }

  const resetWalletCreation = () => {
    setShowAddWalletModal(false)
    setWalletCreationStep(1)
    setWalletCreationData({
      name: "",
      method: "",
      seedPhrase: "",
      privateKey: "",
      derivationPath: "m/44'/0'/0'/0/0",
    })
    setSeedPhraseConfirmed(false)
  }

  const [showSettingsModal, setShowSettingsModal] = useState(false)

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      {/* iPhone Frame */}
      <div className="w-[375px] h-[812px] bg-black rounded-[3rem] p-2 shadow-2xl">
        <div className="w-full h-full bg-gray-50 rounded-[2.5rem] overflow-hidden relative">
          {/* iPhone Notch */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-10"></div>

          {/* App Content */}
          <div className="h-full overflow-y-auto">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 pt-8 bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-cyan-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">B</span>
                </div>
                <h1 className="text-lg font-medium text-gray-900">BitWallet</h1>
              </div>
              <div className="text-right">
                <div className="text-base font-medium text-gray-900">${(totalBalance / 1000).toFixed(1)}k</div>
                <div className="text-xs text-cyan-400">+0.9%</div>
              </div>
            </header>

            <main className="px-4 pb-20">
              {/* Active Wallet Selector */}
              <Card className="border-slate-200 rounded-xl mb-3">
                <CardContent className="p-3">
                  <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
                    onClick={() => setShowWalletModal(true)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-cyan-100 rounded-full flex items-center justify-center">
                        <Wallet className="w-3 h-3 text-cyan-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900 text-xs">{activeWallet.name}</div>
                        <div className="text-xs text-gray-500">{activeWallet.balance.toFixed(4)} BTC</div>
                      </div>
                    </div>
                    <MoreHorizontal className="w-3 h-3 text-gray-400" />
                  </Button>
                </CardContent>
              </Card>

              {/* Balance Card */}
              <Card className="bg-slate-800 border-0 rounded-2xl mb-4 shadow-lg">
                <CardContent className="p-4">
                  <div className="mb-3">
                    <div className="text-gray-400 text-xs mb-1">Total Balance</div>
                    <div className="text-white text-2xl font-bold">${totalBalance.toLocaleString()}</div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-gray-400 text-xs">Bitcoin Holdings</div>
                      <div className="text-white text-sm font-medium">{totalBTC.toFixed(4)} BTC</div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-400 text-xs">24h Profit</div>
                      <div className="text-green-400 text-sm font-medium">+$1,234</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Price Chart */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <div className="text-gray-900 text-sm font-medium">Price (6h)</div>
                  <div className="text-cyan-400 text-sm font-medium">$91,561.15</div>
                </div>

                <div className="bg-cyan-50 rounded-xl p-3 h-24 relative">
                  <svg className="w-full h-full" viewBox="0 0 300 80">
                    <path d="M 0 60 Q 75 40 150 45 T 300 35" stroke="#22d3ee" strokeWidth="2" fill="none" />
                  </svg>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>4h</span>
                    <span>2h</span>
                    <span>now</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mb-6">
                <Button
                  className="flex-1 bg-cyan-400 hover:bg-cyan-500 text-white rounded-xl h-12 text-sm font-medium"
                  onClick={() => setShowQRModal(true)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Receive
                </Button>
                <Button
                  className="flex-1 bg-slate-700 hover:bg-slate-800 text-white rounded-xl h-12 text-sm font-medium"
                  onClick={() => setShowSendModal(true)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>

              {/* Recent Transactions */}
              <div>
                <h3 className="text-gray-900 text-sm font-medium mb-3">Recent</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-cyan-100 rounded-full flex items-center justify-center">
                        <ArrowUpRight className="w-3 h-3 text-cyan-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-xs">Receive</div>
                        <div className="text-xs text-gray-500">5/20</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900 text-xs">0.025 BTC</div>
                      <div className="text-xs text-cyan-400">done</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                        <ArrowDownLeft className="w-3 h-3 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-xs">Send</div>
                        <div className="text-xs text-gray-500">5/19</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900 text-xs">0.01 BTC</div>
                      <div className="text-xs text-cyan-400">done</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-cyan-100 rounded-full flex items-center justify-center">
                        <ArrowUpRight className="w-3 h-3 text-cyan-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-xs">Receive</div>
                        <div className="text-xs text-gray-500">5/18</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900 text-xs">0.05 BTC</div>
                      <div className="text-xs text-gray-500">pending</div>
                    </div>
                  </div>
                </div>
              </div>
            </main>

            {/* Bottom Navigation */}
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
              <div className="flex justify-between items-center">
                <Button
                  variant="ghost"
                  className="flex-col gap-0.5 text-cyan-400 hover:text-cyan-500 hover:bg-transparent p-2"
                >
                  <Home className="w-4 h-4" />
                  <span className="text-xs">Home</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex-col gap-0.5 text-gray-400 hover:text-gray-600 hover:bg-transparent p-2"
                  onClick={() => setShowWalletModal(true)}
                >
                  <Wallet className="w-4 h-4" />
                  <span className="text-xs">Wallet</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex-col gap-0.5 text-gray-400 hover:text-gray-600 hover:bg-transparent p-2"
                  onClick={() => setShowSendModal(true)}
                >
                  <Send className="w-4 h-4" />
                  <span className="text-xs">Send</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex-col gap-0.5 text-gray-400 hover:text-gray-600 hover:bg-transparent p-2"
                  onClick={() => setShowQRModal(true)}
                >
                  <Download className="w-4 h-4" />
                  <span className="text-xs">Receive</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex-col gap-0.5 text-gray-400 hover:text-gray-600 hover:bg-transparent p-2"
                  onClick={() => setShowSettingsModal(true)}
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-xs">Settings</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Settings Modal */}
          {showSettingsModal && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
              <div className="bg-white rounded-t-3xl p-4 w-full max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full w-8 h-8"
                    onClick={() => setShowSettingsModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Currency */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Currency</h3>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start rounded-lg h-9 text-xs">
                        USD
                      </Button>
                      <Button variant="outline" className="w-full justify-start rounded-lg h-9 text-xs">
                        EUR
                      </Button>
                      <Button variant="outline" className="w-full justify-start rounded-lg h-9 text-xs">
                        GBP
                      </Button>
                    </div>
                  </div>

                  {/* Security */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Security</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-700">Face ID/Touch ID</div>
                        <Button variant="ghost" className="w-9">
                          On
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-700">PIN</div>
                        <Button variant="ghost" className="w-9">
                          Off
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Notifications */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Notifications</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-700">Price alerts</div>
                        <Button variant="ghost" className="w-9">
                          On
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-700">Transaction alerts</div>
                        <Button variant="ghost" className="w-9">
                          Off
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Network */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Network</h3>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start rounded-lg h-9 text-xs">
                        Mainnet
                      </Button>
                      <Button variant="outline" className="w-full justify-start rounded-lg h-9 text-xs">
                        Testnet
                      </Button>
                    </div>
                  </div>

                  {/* About */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">About</h3>
                    <div className="space-y-2">
                      <Button variant="ghost" className="w-full justify-start rounded-lg h-9 text-xs">
                        App version
                      </Button>
                      <Button variant="ghost" className="w-full justify-start rounded-lg h-9 text-xs">
                        Terms of service
                      </Button>
                      <Button variant="ghost" className="w-full justify-start rounded-lg h-9 text-xs">
                        Privacy policy
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Wallet Management Modal */}
          {showWalletModal && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
              <div className="bg-white rounded-t-3xl p-4 w-full max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">My Wallets</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full w-8 h-8"
                    onClick={() => setShowWalletModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2 mb-4">
                  {wallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      className={`p-3 rounded-xl border-2 transition-colors ${
                        wallet.isActive ? "border-cyan-400 bg-cyan-50" : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              wallet.isActive ? "bg-cyan-400" : "bg-gray-200"
                            }`}
                          >
                            <Wallet className={`w-4 h-4 ${wallet.isActive ? "text-white" : "text-gray-600"}`} />
                          </div>
                          <div className="flex-1">
                            {editingWallet === wallet.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={wallet.name}
                                  onChange={(e) =>
                                    setWallets((prev) =>
                                      prev.map((w) => (w.id === wallet.id ? { ...w, name: e.target.value } : w)),
                                    )
                                  }
                                  className="h-6 text-xs"
                                  autoFocus
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="w-6 h-6"
                                  onClick={() => updateWalletName(wallet.id, wallet.name)}
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div>
                                <div className="font-medium text-gray-900 text-xs">{wallet.name}</div>
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
                                className="w-6 h-6"
                                onClick={() => setEditingWallet(wallet.id)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              {wallets.length > 1 && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="w-6 h-6 text-red-500 hover:text-red-600"
                                  onClick={() => deleteWallet(wallet.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {!wallet.isActive && (
                        <Button
                          variant="outline"
                          className="w-full mt-2 rounded-lg h-8 text-xs"
                          onClick={() => switchWallet(wallet.id)}
                        >
                          Switch to this wallet
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-xl h-10 text-sm"
                  onClick={() => setShowAddWalletModal(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Wallet
                </Button>
              </div>
            </div>
          )}

          {/* Add Wallet Modal */}
          {showAddWalletModal && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
              <div className="bg-white rounded-t-3xl p-4 w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Add New Wallet</h2>
                  <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={resetWalletCreation}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Step 1: Choose Creation Method */}
                {walletCreationStep === 1 && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">How would you like to add your wallet?</h3>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          className="w-full p-3 h-auto rounded-lg border-2 hover:border-cyan-400 hover:bg-cyan-50"
                          onClick={() => {
                            setWalletCreationData((prev) => ({ ...prev, method: "generate" }))
                            setWalletCreationStep(2)
                          }}
                        >
                          <div className="text-left">
                            <div className="font-medium text-gray-900 text-xs">Generate New Wallet</div>
                            <div className="text-xs text-gray-500">
                              Create a brand new wallet with a new seed phrase
                            </div>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full p-3 h-auto rounded-lg border-2 hover:border-cyan-400 hover:bg-cyan-50"
                          onClick={() => {
                            setWalletCreationData((prev) => ({ ...prev, method: "import-seed" }))
                            setWalletCreationStep(2)
                          }}
                        >
                          <div className="text-left">
                            <div className="font-medium text-gray-900 text-xs">Import from Seed Phrase</div>
                            <div className="text-xs text-gray-500">Restore wallet using 12/24 word seed phrase</div>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full p-3 h-auto rounded-lg border-2 hover:border-cyan-400 hover:bg-cyan-50"
                          onClick={() => {
                            setWalletCreationData((prev) => ({ ...prev, method: "import-key" }))
                            setWalletCreationStep(2)
                          }}
                        >
                          <div className="text-left">
                            <div className="font-medium text-gray-900 text-xs">Import from Private Key</div>
                            <div className="text-xs text-gray-500">Import wallet using WIF private key</div>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full p-3 h-auto rounded-lg border-2 hover:border-cyan-400 hover:bg-cyan-50"
                          onClick={() => {
                            setWalletCreationData((prev) => ({ ...prev, method: "watch-only" }))
                            setWalletCreationStep(2)
                          }}
                        >
                          <div className="text-left">
                            <div className="font-medium text-gray-900 text-xs">Watch-Only Wallet</div>
                            <div className="text-xs text-gray-500">Track wallet balance without spending ability</div>
                          </div>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Wallet Details */}
                {walletCreationStep === 2 && (
                  <div className="space-y-3">
                    <Button
                      variant="ghost"
                      className="flex items-center gap-1 p-0 h-auto text-gray-600 hover:text-gray-900 text-xs"
                      onClick={() => setWalletCreationStep(1)}
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Back
                    </Button>

                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Wallet Name</label>
                      <Input
                        placeholder="Enter wallet name"
                        value={walletCreationData.name}
                        onChange={(e) => setWalletCreationData((prev) => ({ ...prev, name: e.target.value }))}
                        className="rounded-lg h-9 text-sm"
                      />
                    </div>

                    {/* Generate New Wallet */}
                    {walletCreationData.method === "generate" && (
                      <div className="space-y-3">
                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                          <div className="flex items-start gap-2">
                            <div className="w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-white text-xs font-bold">!</span>
                            </div>
                            <div>
                              <div className="font-medium text-yellow-800 mb-1 text-xs">Important Security Notice</div>
                              <div className="text-xs text-yellow-700">
                                Your seed phrase will be generated and displayed. Write it down and store it safely.
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">Derivation Path</label>
                          <select
                            value={walletCreationData.derivationPath}
                            onChange={(e) =>
                              setWalletCreationData((prev) => ({ ...prev, derivationPath: e.target.value }))
                            }
                            className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs"
                          >
                            <option value="m/44'/0'/0'/0/0">m/44'/0'/0'/0/0 (BIP44 - Legacy)</option>
                            <option value="m/49'/0'/0'/0/0">m/49'/0'/0'/0/0 (BIP49 - SegWit)</option>
                            <option value="m/84'/0'/0'/0/0">m/84'/0'/0'/0/0 (BIP84 - Native SegWit)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Import from Seed Phrase */}
                    {walletCreationData.method === "import-seed" && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">Seed Phrase</label>
                          <textarea
                            placeholder="Enter your 12 or 24 word seed phrase"
                            value={walletCreationData.seedPhrase}
                            onChange={(e) => setWalletCreationData((prev) => ({ ...prev, seedPhrase: e.target.value }))}
                            className="w-full p-2 border border-gray-300 rounded-lg resize-none h-16 text-xs"
                            rows={3}
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            Words:{" "}
                            {
                              walletCreationData.seedPhrase
                                .trim()
                                .split(/\s+/)
                                .filter((word) => word.length > 0).length
                            }
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">Derivation Path</label>
                          <select
                            value={walletCreationData.derivationPath}
                            onChange={(e) =>
                              setWalletCreationData((prev) => ({ ...prev, derivationPath: e.target.value }))
                            }
                            className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs"
                          >
                            <option value="m/44'/0'/0'/0/0">m/44'/0'/0'/0/0 (BIP44 - Legacy)</option>
                            <option value="m/49'/0'/0'/0/0">m/49'/0'/0'/0/0 (BIP49 - SegWit)</option>
                            <option value="m/84'/0'/0'/0/0">m/84'/0'/0'/0/0 (BIP84 - Native SegWit)</option>
                          </select>
                        </div>

                        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                          <div className="flex items-start gap-2">
                            <div className="w-4 h-4 bg-red-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-white text-xs font-bold">!</span>
                            </div>
                            <div>
                              <div className="font-medium text-red-800 mb-1 text-xs">Security Warning</div>
                              <div className="text-xs text-red-700">
                                Never share your seed phrase with anyone. Make sure you're in a private location.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Import from Private Key */}
                    {walletCreationData.method === "import-key" && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">
                            Private Key (WIF Format)
                          </label>
                          <textarea
                            placeholder="Enter your private key in WIF format"
                            value={walletCreationData.privateKey}
                            onChange={(e) => setWalletCreationData((prev) => ({ ...prev, privateKey: e.target.value }))}
                            className="w-full p-2 border border-gray-300 rounded-lg resize-none h-16 font-mono text-xs"
                            rows={2}
                          />
                        </div>

                        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                          <div className="flex items-start gap-2">
                            <div className="w-4 h-4 bg-red-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-white text-xs font-bold">!</span>
                            </div>
                            <div>
                              <div className="font-medium text-red-800 mb-1 text-xs">Security Warning</div>
                              <div className="text-xs text-red-700">
                                Private keys give full control over your Bitcoin. Never share them with anyone.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Watch-Only Wallet */}
                    {walletCreationData.method === "watch-only" && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">
                            Bitcoin Address or xpub
                          </label>
                          <textarea
                            placeholder="Enter Bitcoin address or xpub/ypub/zpub key"
                            value={walletCreationData.privateKey}
                            onChange={(e) => setWalletCreationData((prev) => ({ ...prev, privateKey: e.target.value }))}
                            className="w-full p-2 border border-gray-300 rounded-lg resize-none h-16 font-mono text-xs"
                            rows={2}
                          />
                        </div>

                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <div className="flex items-start gap-2">
                            <div className="w-4 h-4 bg-blue-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-white text-xs font-bold">i</span>
                            </div>
                            <div>
                              <div className="font-medium text-blue-800 mb-1 text-xs">Watch-Only Mode</div>
                              <div className="text-xs text-blue-700">
                                You can view balance and transactions but cannot send Bitcoin from this wallet.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      className="w-full bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-9 text-xs"
                      onClick={() => setWalletCreationStep(3)}
                      disabled={
                        !walletCreationData.name.trim() ||
                        (walletCreationData.method === "import-seed" &&
                          walletCreationData.seedPhrase
                            .trim()
                            .split(/\s+/)
                            .filter((word) => word.length > 0).length < 12) ||
                        (walletCreationData.method === "import-key" && !walletCreationData.privateKey.trim()) ||
                        (walletCreationData.method === "watch-only" && !walletCreationData.privateKey.trim())
                      }
                    >
                      {walletCreationData.method === "generate" ? "Generate Wallet" : "Import Wallet"}
                    </Button>
                  </div>
                )}

                {/* Step 3: Confirmation/Seed Display */}
                {walletCreationStep === 3 && (
                  <div className="space-y-3">
                    {walletCreationData.method === "generate" && (
                      <>
                        <div className="text-center mb-3">
                          <h3 className="text-sm font-medium text-gray-900 mb-1">Your Seed Phrase</h3>
                          <p className="text-xs text-gray-600">
                            Write down these 12 words in order and store them safely
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3 border-2 border-dashed border-gray-300">
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {generatedSeedPhrase.map((word, index) => (
                              <div key={index} className="flex items-center gap-1">
                                <span className="text-gray-500 w-4 text-xs">{index + 1}.</span>
                                <span className="font-mono text-xs">{word}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                          <div className="flex items-start gap-2">
                            <div className="w-4 h-4 bg-red-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-white text-xs font-bold">!</span>
                            </div>
                            <div>
                              <div className="font-medium text-red-800 mb-1 text-xs">
                                Critical: Save Your Seed Phrase
                              </div>
                              <div className="text-xs text-red-700">
                                This is the only way to recover your wallet. If you lose it, your Bitcoin will be lost
                                forever.
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <input
                            type="checkbox"
                            id="seedConfirm"
                            checked={seedPhraseConfirmed}
                            onChange={(e) => setSeedPhraseConfirmed(e.target.checked)}
                            className="w-3 h-3 text-cyan-600"
                          />
                          <label htmlFor="seedConfirm" className="text-xs text-gray-700 flex-1">
                            I have written down my seed phrase and stored it in a safe place
                          </label>
                        </div>
                      </>
                    )}

                    {walletCreationData.method !== "generate" && (
                      <div className="text-center py-3">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Check className="w-6 h-6 text-green-600" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 mb-1">Wallet Ready</h3>
                        <p className="text-xs text-gray-600">Your wallet has been validated and is ready to use</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 rounded-lg h-9 text-xs"
                        onClick={() => setWalletCreationStep(2)}
                      >
                        Back
                      </Button>
                      <Button
                        className="flex-1 bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg h-9 text-xs"
                        onClick={createWallet}
                        disabled={walletCreationData.method === "generate" && !seedPhraseConfirmed}
                      >
                        Create Wallet
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* QR Code Modal */}
          {showQRModal && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-4 mx-4 w-full max-w-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Receive Bitcoin</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full w-8 h-8"
                    onClick={() => setShowQRModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="text-center mb-4">
                  <div className="flex justify-center mb-3">{generateQRCode(activeWallet.address)}</div>
                  <p className="text-xs text-gray-600 mb-1">Scan this QR code to send Bitcoin to your wallet</p>
                  <p className="text-xs font-medium text-gray-900">{activeWallet.name}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Your Bitcoin Address</label>
                    <div className="bg-gray-50 rounded-lg p-2 border">
                      <p className="text-xs text-gray-900 break-all font-mono">{activeWallet.address}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 rounded-lg h-9 text-xs" onClick={handleCopyAddress}>
                      <Copy className="w-3 h-3 mr-1" />
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-lg h-9 text-xs"
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: "Bitcoin Address",
                            text: activeWallet.address,
                          })
                        }
                      }}
                    >
                      <Share className="w-3 h-3 mr-1" />
                      Share
                    </Button>
                  </div>

                  <div className="bg-cyan-50 rounded-lg p-3">
                    <p className="text-xs text-cyan-800">
                      <strong>Note:</strong> Only send Bitcoin (BTC) to this address. Sending other cryptocurrencies may
                      result in permanent loss.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Send Modal */}
          {showSendModal && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-4 mx-4 w-full max-w-sm max-h-[85vh] overflow-y-auto">
                {/* Step 1: Enter Details */}
                {sendStep === 1 && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Send Bitcoin</h2>
                      <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={resetSendModal}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <div className="text-xs text-gray-600">Sending from</div>
                      <div className="font-medium text-gray-900 text-sm">{activeWallet.name}</div>
                      <div className="text-xs text-gray-500">{activeWallet.balance.toFixed(4)} BTC available</div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Recipient Address</label>
                        <div className="relative">
                          <Input
                            placeholder="Enter Bitcoin address"
                            value={sendData.address}
                            onChange={(e) => setSendData((prev) => ({ ...prev, address: e.target.value }))}
                            className="rounded-lg pr-10 h-9 text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 w-6 h-6"
                          >
                            <QrCode className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">Amount (BTC)</label>
                          <Input
                            placeholder="0.00000000"
                            value={sendData.amount}
                            onChange={(e) => handleAmountChange(e.target.value, "btc")}
                            className="rounded-lg h-9 text-xs"
                            type="number"
                            step="0.00000001"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">Amount (USD)</label>
                          <Input
                            placeholder="0.00"
                            value={sendData.usdAmount}
                            onChange={(e) => handleAmountChange(e.target.value, "usd")}
                            className="rounded-lg h-9 text-xs"
                            type="number"
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Note (Optional)</label>
                        <Input
                          placeholder="Add a note..."
                          value={sendData.note}
                          onChange={(e) => setSendData((prev) => ({ ...prev, note: e.target.value }))}
                          className="rounded-lg h-9 text-xs"
                        />
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">Network Fee</span>
                          <span className="text-gray-900">~$2.50</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Total</span>
                          <span className="font-medium text-gray-900">
                            {sendData.usdAmount
                              ? `$${(Number.parseFloat(sendData.usdAmount) + 2.5).toFixed(2)}`
                              : "$2.50"}
                          </span>
                        </div>
                      </div>

                      <Button
                        className="w-full bg-slate-700 hover:bg-slate-800 text-white rounded-lg h-9 text-xs"
                        onClick={handleSendNext}
                        disabled={!sendData.address || !sendData.amount}
                      >
                        Continue
                      </Button>
                    </div>
                  </>
                )}

                {/* Step 2: Confirm Transaction */}
                {sendStep === 2 && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Confirm Transaction</h2>
                      <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={resetSendModal}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-center mb-3">
                          <div className="text-xl font-bold text-gray-900">{sendData.amount} BTC</div>
                          <div className="text-sm text-gray-600">${sendData.usdAmount}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">From</label>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-xs text-gray-900">{activeWallet.name}</p>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">To</label>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-xs text-gray-900 break-all font-mono">{sendData.address}</p>
                          </div>
                        </div>

                        {sendData.note && (
                          <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1">Note</label>
                            <div className="bg-gray-50 rounded-lg p-2">
                              <p className="text-xs text-gray-900">{sendData.note}</p>
                            </div>
                          </div>
                        )}

                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">Amount</span>
                            <span className="text-gray-900">${sendData.usdAmount}</span>
                          </div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">Network Fee</span>
                            <span className="text-gray-900">$2.50</span>
                          </div>
                          <div className="border-t border-gray-200 pt-1">
                            <div className="flex justify-between font-medium text-xs">
                              <span className="text-gray-900">Total</span>
                              <span className="text-gray-900">
                                ${(Number.parseFloat(sendData.usdAmount) + 2.5).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-lg h-9 text-xs"
                          onClick={() => setSendStep(1)}
                        >
                          Back
                        </Button>
                        <Button
                          className="flex-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg h-9 text-xs"
                          onClick={handleSendNext}
                        >
                          Send Bitcoin
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* Step 3: Success */}
                {sendStep === 3 && (
                  <>
                    <div className="text-center py-6">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-1">Transaction Sent</h2>
                      <p className="text-xs text-gray-600 mb-4">Your Bitcoin is being processed on the network</p>

                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <div className="text-sm font-bold text-gray-900">{sendData.amount} BTC</div>
                        <div className="text-xs text-gray-600">From: {activeWallet.name}</div>
                        <div className="text-xs text-gray-600">Transaction ID: tx1a2b3c4d5e6f...</div>
                      </div>

                      <p className="text-xs text-gray-500">
                        You'll receive a notification when the transaction is confirmed
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
