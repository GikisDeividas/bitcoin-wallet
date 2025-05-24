import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rabbit - Bitcoin Wallet',
  description: 'A secure, user-friendly Bitcoin wallet for real transactions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://blockstream.info https://*.blockstream.info https://mempool.space https://*.mempool.space https://api.blockcypher.com https://api.coingecko.com https://api.exchangerate-api.com https://open.er-api.com https://vercel.live wss://ws.blockchain.info; worker-src 'self' blob:; child-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
