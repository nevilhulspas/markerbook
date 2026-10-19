import type { Metadata } from 'next'

import { getSupplements } from '@/actions/supplements'
import { getWishlist } from '@/actions/wishlist'
import { SupplementTable } from '@/components/supplements/supplement-table'
import { matchesSupplementMode } from '@/lib/supplements/mode'
import { WishlistTable } from '@/components/wishlist/wishlist-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const metadata: Metadata = { title: 'Stack | Blood Markers Tracker' }

export default async function SupplementsPage() {
  const [{ data: supplements }, { data: wishlist }] = await Promise.all([
    getSupplements(),
    getWishlist(),
  ])

  const all = supplements ?? []
  const active = all.filter((s) => matchesSupplementMode(s, 'active'))
  const upcoming = all.filter((s) => matchesSupplementMode(s, 'upcoming'))
  const stopped = all.filter((s) => matchesSupplementMode(s, 'stopped'))
  const wishlistItems = wishlist ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stack</h1>
        <p className="text-muted-foreground">
          Track your supplements and medicines, and a wishlist of what to buy or try.
        </p>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active{active.length > 0 ? ` (${active.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming{upcoming.length > 0 ? ` (${upcoming.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="wishlist">
            Wishlist{wishlistItems.length > 0 ? ` (${wishlistItems.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="stopped">
            Stopped{stopped.length > 0 ? ` (${stopped.length})` : ''}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <SupplementTable supplements={active} mode="active" />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-4">
          <SupplementTable supplements={upcoming} mode="upcoming" />
        </TabsContent>
        <TabsContent value="wishlist" className="mt-4">
          <WishlistTable initialItems={wishlistItems} />
        </TabsContent>
        <TabsContent value="stopped" className="mt-4">
          <SupplementTable supplements={stopped} mode="stopped" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
