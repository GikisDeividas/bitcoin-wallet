/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Disable CSP for development - only apply in production
  async headers() {
    // Only apply CSP in production
    if (process.env.NODE_ENV !== 'production') {
      return []
    }
    
    return [
      {
        // Apply headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live", // Explicit eval permission for crypto + Vercel
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://blockstream.info https://*.blockstream.info https://mempool.space https://*.mempool.space https://api.blockcypher.com https://api.coingecko.com https://api.coincap.io https://api.binance.com https://cors-anywhere.herokuapp.com https://api.exchangerate-api.com https://open.er-api.com https://api.fxratesapi.com https://api.currencyapi.com https://vercel.live wss://ws.blockchain.info", // Allow blockchain AND exchange rate API calls
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests"
            ].join('; ')
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          }
        ]
      }
    ]
  }
}

export default nextConfig
