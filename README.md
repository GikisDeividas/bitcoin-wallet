# Bitcoin Wallet App

A modern Bitcoin wallet interface built with Next.js, React, and Tailwind CSS. This project was generated with v0 and configured for local development.

## ✨ **NEW: Live Bitcoin Price Integration**

The app now displays **real-time Bitcoin prices** that automatically update every 30 seconds using the CoinGecko API:

- 🔄 **Auto-refresh**: Price updates every 30 seconds
- 📈 **Live 24h change**: Shows real percentage change with color coding (green/red)
- 💰 **Dynamic balances**: Wallet balances update based on current Bitcoin price
- 📊 **Real profit/loss**: 24h profit calculation based on actual price movements
- 🕒 **Last updated**: Shows when price was last fetched
- ⚡ **No API key required**: Uses CoinGecko's free public API

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** (tested with v22.16.0)
- **npm** (comes with Node.js)
- **Internet connection** (for live Bitcoin price data)

### Installation & Setup

1. **Clone or download the project**
2. **Install dependencies with legacy peer deps** (required for compatibility):
```bash
npm install --legacy-peer-deps
```

3. **Start the development server**:
```bash
npm run dev
```

4. **Open your browser** to [http://localhost:3000](http://localhost:3000)

The app will immediately start fetching live Bitcoin prices and update every 30 seconds automatically.

## 🔧 Important Configuration Notes

### ⚠️ Known Issues & Solutions

**1. Dependency Conflicts**
- Always use `--legacy-peer-deps` when installing dependencies
- There's a version conflict between `date-fns@4.1.0` and `react-day-picker@8.10.1`
- This is normal for v0 projects and doesn't affect functionality

**2. Tailwind Configuration**
- The project uses a **custom Tailwind config** (not shadcn's default)
- ✅ `tailwind.config.js` is properly configured - do NOT modify
- ✅ `components.json` points to correct config file
- If you see shadcn import errors, the config has already been fixed

**3. Next.js Configuration**
- ✅ `next.config.js` has deprecated options removed
- The `appDir` experimental option is not needed in Next.js 15+

**4. Live Price Data**
- Uses CoinGecko API (free, no authentication required)
- If price loading fails, app shows fallback UI
- Price updates happen in background without affecting app performance

## 📁 Project Structure

```
├── app/
│   ├── globals.css          # Tailwind CSS + shadcn/ui variables
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main page (imports BitcoinWallet)
├── components/
│   ├── ui/                  # shadcn/ui components (pre-configured)
│   ├── modals/              # Modal components for wallet features
│   ├── bitcoin-wallet.tsx   # Main wallet component (with live prices)
│   └── theme-provider.tsx   # Theme management
├── hooks/
│   └── useBitcoinPrice.ts   # Custom hook for live Bitcoin price data
├── types/
│   └── wallet.ts            # TypeScript interfaces
├── lib/
│   └── utils.ts             # Utility functions (cn helper)
└── ...config files
```

## 🎯 Features

- **🔴 LIVE:** Real-time Bitcoin price updates every 30 seconds
- **💱 LIVE:** Dynamic wallet balance calculations based on current BTC price
- **📈 LIVE:** Real 24h profit/loss tracking with actual market data
- **Multi-wallet management** with wallet switching
- **Send and receive Bitcoin** with modal interfaces
- **QR code generation** for receiving payments
- **Transaction history** display
- **Settings management**
- **Responsive mobile-first design** (iPhone-optimized)
- **Modern UI** with shadcn/ui components
- **Smart error handling** for network/API issues

## 🛠 Technologies Used

- **Next.js 15.2.4** - React framework with App Router
- **React 19** - Latest React version
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern UI component library
- **Lucide React** - Icon library
- **Radix UI** - Headless UI primitives
- **CoinGecko API** - Live cryptocurrency price data

## 🔧 Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## 🚨 Troubleshooting

### Common Setup Issues

**1. "Package subpath './ui/tailwind.config' is not defined"**
- ✅ **Already Fixed** - This was caused by v0's default Tailwind config
- The current `tailwind.config.js` uses proper shadcn/ui configuration

**2. "Invalid next.config.js options detected: appDir"**
- ✅ **Already Fixed** - Deprecated option removed from Next.js config

**3. Dependency installation fails**
- **Solution**: Always use `npm install --legacy-peer-deps`
- This resolves peer dependency conflicts between packages

**4. 500 Internal Server Error**
- Check that all dependencies are installed with `--legacy-peer-deps`
- Verify that `tailwind.config.js` doesn't import from `shadcn/ui/tailwind.config`

**5. Bitcoin price not loading**
- Check internet connection
- CoinGecko API might be temporarily unavailable
- App will show loading state and fallback gracefully

### Fresh Installation

If you encounter issues, try a fresh installation:

```bash
# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall with legacy peer deps
npm install --legacy-peer-deps

# Start development server
npm run dev
```

## 📱 App Features

The wallet includes the following functional components:

- **🔴 Live Bitcoin Price Display**: Real-time price with 30-second updates
- **📊 Dynamic Balance Calculations**: Balances update with live BTC price
- **📈 Real Profit/Loss Tracking**: Actual 24h gains/losses based on market data
- **Wallet Management**: Switch between multiple wallets
- **Balance Display**: Real-time balance in BTC and USD
- **Transaction History**: Recent send/receive transactions
- **Send Modal**: Send Bitcoin with amount and address validation
- **Receive Modal**: Generate QR codes for receiving payments
- **Settings Modal**: Manage wallet preferences
- **Add Wallet Modal**: Create new wallets

## 🌐 API Integration

### Bitcoin Price Data
- **Source**: CoinGecko API (free tier)
- **Endpoint**: `/api/v3/simple/price`
- **Update Frequency**: Every 30 seconds
- **Data Retrieved**:
  - Current USD price
  - 24-hour percentage change
  - Last update timestamp
- **Error Handling**: Graceful fallbacks for network issues
- **No Rate Limits**: Uses public endpoints (no API key required)

## 🎨 Design

- **Mobile-first responsive design**
- **iPhone-style interface** with rounded corners and proper spacing
- **Dynamic color coding**: Green for gains, red for losses
- **Loading states**: Smooth loading indicators for price updates
- **Real-time animations**: Live chart updates based on price movement
- **Dark/light theme support** (configurable)
- **Smooth animations** with Tailwind CSS
- **Modern gradients** and shadows

## 📝 Development Notes

- **ESLint and TypeScript errors are ignored** in build (`ignoreBuildErrors: true`)
- **All shadcn/ui components** are pre-configured and ready to use
- **CSS variables** are properly set up for theming
- **The app is optimized** for mobile viewport (375px width)
- **Live price updates** run in background without affecting performance
- **Custom React hook** (`useBitcoinPrice`) handles all API logic
- **Automatic cleanup** of intervals when component unmounts

## 🔒 Security Note

This is a **demo/UI project** - it does not handle real Bitcoin transactions or private keys. The live price data is for display purposes only. For production use, proper security measures and Bitcoin integration would be required.

---

**Generated with v0 and configured for local development with live Bitcoin price integration**
