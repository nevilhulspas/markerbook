'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  navigationItems,
  adminNavigationItems,
  isNavGroup,
  type NavEntry,
  type NavGroup,
  type NavLeaf,
} from '@/data/navigation'
import { NavUser } from '@/components/nav-user'
import { useSidebarExtra } from '@/components/layout/sidebar-extra-context'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'

interface AppSidebarProps {
  user: {
    name?: string | null
    email: string
    isAdmin: boolean
  }
  badgeOverrides?: Record<string, string>
}

export function AppSidebar({ user, badgeOverrides }: AppSidebarProps) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const { extra } = useSidebarExtra()
  // Explicit per-group open/closed overrides; absent groups fall back to
  // "open when a child route is active" (see groupOpen).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  function handleNavClick() {
    if (isMobile) setOpenMobile(false)
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const badgeFor = (item: NavLeaf) => badgeOverrides?.[item.href] ?? item.badge

  const groupOpen = (group: NavGroup) =>
    openGroups[group.title] ?? group.items.some((c) => isActive(c.href))

  function toggleGroup(title: string, current: boolean) {
    setOpenGroups((s) => ({ ...s, [title]: !current }))
  }

  function renderLeaf(item: NavLeaf) {
    const badge = badgeFor(item)
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={isActive(item.href)}>
          <Link href={item.href} onClick={handleNavClick}>
            <item.icon />
            <span>{item.title}</span>
            {badge && (
              <span className="ml-auto text-xs text-muted-foreground">{badge}</span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  function renderGroup(group: NavGroup) {
    const open = groupOpen(group)
    const hasActiveChild = group.items.some((c) => isActive(c.href))
    // Keep a child's badge/count visible on the collapsed parent.
    const collapsedBadge = !open
      ? group.items.map(badgeFor).find(Boolean)
      : undefined

    return (
      <SidebarMenuItem key={group.title}>
        <SidebarMenuButton
          onClick={() => toggleGroup(group.title, open)}
          isActive={!open && hasActiveChild}
          aria-expanded={open}
        >
          <group.icon />
          <span>{group.title}</span>
          <span className="ml-auto flex items-center gap-1">
            {collapsedBadge && (
              <span className="text-xs text-muted-foreground">{collapsedBadge}</span>
            )}
            <ChevronRight
              className={cn('size-4 transition-transform', open && 'rotate-90')}
            />
          </span>
        </SidebarMenuButton>
        {open && (
          <SidebarMenuSub>
            {group.items.map((child) => {
              const badge = badgeFor(child)
              return (
                <SidebarMenuSubItem key={child.href}>
                  <SidebarMenuSubButton asChild isActive={isActive(child.href)}>
                    <Link href={child.href} onClick={handleNavClick}>
                      <child.icon />
                      <span>{child.title}</span>
                      {badge && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {badge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    )
  }

  const renderEntries = (entries: NavEntry[]) =>
    entries.map((entry) =>
      isNavGroup(entry) ? renderGroup(entry) : renderLeaf(entry)
    )

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" onClick={handleNavClick}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Activity className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    Blood Markers Tracker
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Dashboard
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* On the chat page (mobile), conversations sit above the nav — the
            chat sessions are the primary thing there, the global menu secondary. */}
        {isMobile && extra && (
          <SidebarGroup>
            <SidebarGroupLabel>Conversations</SidebarGroupLabel>
            <SidebarGroupContent>{extra}</SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderEntries(navigationItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {user.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderEntries(adminNavigationItems)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <NavUser user={user} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
