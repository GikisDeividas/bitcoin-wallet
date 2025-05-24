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
  // CSP configuration to allow cryptographic libraries to work
  async headers() {
    return [
      {
        // Apply headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Allow eval for crypto libraries
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://blockstream.info https://*.blockstream.info https://mempool.space https://*.mempool.space https://api.blockcypher.com https://api.coingecko.com https://api.exchangerate-api.com https://open.er-api.com", // Allow blockchain AND exchange rate API calls
              "frame-ancestors 'none'",
              "base-uri 'self'"
            ].join('; ')
          }
        ]
      }
    ]
  }
}

export default nextConfig
