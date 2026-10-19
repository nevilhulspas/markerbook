import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Bloodmarkers',
  description:
    'Track your blood test results over time and get personalized AI-powered interpretation and recommendations.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pin scale to 1 so the iOS WebView never zooms (e.g. on input focus), which
  // would render content wider than the screen and push controls off-viewport.
  maximumScale: 1,
  viewportFit: 'cover', // enables env(safe-area-inset-*) under the notch / home bar
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#171717' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
