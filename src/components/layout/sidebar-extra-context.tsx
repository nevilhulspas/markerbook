'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface SidebarExtraValue {
  /** Content rendered in the mobile drawer below the nav (null = nothing). */
  extra: ReactNode
  setExtra: (node: ReactNode) => void
}

const SidebarExtraContext = createContext<SidebarExtraValue | null>(null)

export function SidebarExtraProvider({ children }: { children: ReactNode }) {
  const [extra, setExtra] = useState<ReactNode>(null)
  const value = useMemo(() => ({ extra, setExtra }), [extra])
  return (
    <SidebarExtraContext.Provider value={value}>
      {children}
    </SidebarExtraContext.Provider>
  )
}

export function useSidebarExtra(): SidebarExtraValue {
  const ctx = useContext(SidebarExtraContext)
  if (!ctx) {
    throw new Error('useSidebarExtra must be used within SidebarExtraProvider')
  }
  return ctx
}
