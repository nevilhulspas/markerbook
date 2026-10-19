'use client'

import { ChevronsUpDown, LogOut, Monitor, Moon, Sun, User } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'

import { signOut } from '@/actions/auth'
import { useMounted } from '@/hooks/use-mounted'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuButton,
} from '@/components/ui/sidebar'

interface NavUserProps {
  user: {
    name?: string | null
    email: string
  }
}

export function NavUser({ user }: NavUserProps) {
  const displayName = user.name?.trim() || user.email
  const initials = displayName.charAt(0).toUpperCase()
  const mounted = useMounted()

  const { theme, setTheme, resolvedTheme, systemTheme } = useTheme()
  function applyTheme(next: 'system' | 'light' | 'dark', e: React.MouseEvent) {
    const nextResolved = next === 'system' ? (systemTheme ?? resolvedTheme) : next
    if (!document.startViewTransition || nextResolved === resolvedTheme) {
      setTheme(next)
      return
    }
    const root = document.documentElement
    root.style.setProperty('--x', `${e.clientX}px`)
    root.style.setProperty('--y', `${e.clientY}px`)
    document.startViewTransition(() => setTheme(next))
  }

  if (!mounted) {
    // Render a static placeholder that matches server output (no Radix IDs)
    return (
      <SidebarMenuButton size="lg">
        <Avatar size="sm">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{displayName}</span>
        </div>
        <ChevronsUpDown className="ml-auto size-4" />
      </SidebarMenuButton>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar size="sm">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{displayName}</span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        side="bottom"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar size="sm">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              {user.name?.trim() && (
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <User />
              Profile
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme}>
          <DropdownMenuRadioItem
            value="system"
            onClick={(e) => applyTheme('system', e)}
          >
            <Monitor />
            Auto
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="light"
            onClick={(e) => applyTheme('light', e)}
          >
            <Sun />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="dark"
            onClick={(e) => applyTheme('dark', e)}
          >
            <Moon />
            Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut()
          }}
        >
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
