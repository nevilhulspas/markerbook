'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { z } from 'zod'

import { useIsMobile } from '@/hooks/use-mobile'
import { addWishlistSource, updateWishlistSource } from '@/actions/wishlist'
import { wishlistSourceSchema, type WishlistSourceValues } from '@/lib/validations/wishlist'

type SourceFormInput = z.input<typeof wishlistSourceSchema>
import type { WishlistSource } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId: string
  source?: WishlistSource | null
  onSaved?: () => void
}

function SourceForm({ itemId, source, onSaved, onOpenChange }: Omit<Props, 'open'>) {
  const isEdit = !!source
  const [isPending, setIsPending] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<
    SourceFormInput,
    unknown,
    WishlistSourceValues
  >({
    resolver: zodResolver(wishlistSourceSchema),
    defaultValues: {
      brand: source?.brand ?? '',
      url: source?.url ?? '',
      price: source?.price ?? undefined,
      currency: source?.currency ?? 'EUR',
    },
  })

  async function onSubmit(values: WishlistSourceValues) {
    setIsPending(true)
    try {
      const res = isEdit
        ? await updateWishlistSource(source.id, values)
        : await addWishlistSource(itemId, values)
      if (res.success) {
        toast.success(isEdit ? 'Source updated' : 'Source added')
        onSaved?.()
        onOpenChange?.(false)
      } else {
        toast.error(res.error ?? 'Failed to save source')
      }
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="src-brand">Brand (optional)</Label>
        <Input id="src-brand" placeholder="e.g. Thorne" {...register('brand')} />
        {errors.brand && <p className="text-sm text-destructive">{errors.brand.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="src-url">URL (optional)</Label>
        <Input id="src-url" type="url" placeholder="https://…" {...register('url')} />
        {errors.url && <p className="text-sm text-destructive">{errors.url.message}</p>}
      </div>
      <div className="flex gap-2">
        <div className="space-y-2">
          <Label htmlFor="src-price">Price (optional)</Label>
          <Input id="src-price" type="number" step="any" min="0" className="w-28"
            {...register('price')} />
          {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="src-currency">Currency</Label>
          <Input id="src-currency" className="w-24" placeholder="EUR" {...register('currency')} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? 'Update source' : 'Add source'}
        </Button>
      </div>
    </form>
  )
}

export function SourceEditor({ open, onOpenChange, itemId, source, onSaved }: Props) {
  const isMobile = useIsMobile()
  const title = source ? 'Edit source' : 'Add source'
  const description = 'A place to buy this — brand, link and price.'
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>{title}</DrawerTitle><DrawerDescription>{description}</DrawerDescription></DrawerHeader>
          <div className="p-4 pb-8"><SourceForm itemId={itemId} source={source} onSaved={onSaved} onOpenChange={onOpenChange} /></div>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <SourceForm itemId={itemId} source={source} onSaved={onSaved} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}
