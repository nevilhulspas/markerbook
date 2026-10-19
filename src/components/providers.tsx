import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ReactNode } from 'react'
import { CapacitorBridge } from '@/components/capacitor-bridge'
import { Toaster } from '@/components/ui/sonner'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      <CapacitorBridge />
      {children}
      <Toaster />
    </NextThemesProvider>
  )
}
