'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useIsMobile } from '@/hooks/use-mobile'
import { createWishlistItem, updateWishlistItem } from '@/actions/wishlist'
import { wishlistItemSchema, type WishlistItemValues } from '@/lib/validations/wishlist'
import type { WishlistItem } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: WishlistItem | null
  onSaved?: () => void
}

function WishlistItemForm({ item, onSaved, onOpenChange }: Omit<Props, 'open'>) {
  const isEdit = !!item
  const [isPending, setIsPending] = useState(false)
  const [priority, setPriority] = useState<'high' | 'medium' | 'low' | 'none'>(
    item?.priority ?? 'none'
  )
  const { register, handleSubmit, setValue, formState: { errors } } =
    useForm<WishlistItemValues>({
      resolver: zodResolver(wishlistItemSchema),
      defaultValues: {
        name: item?.name ?? '',
        priority: item?.priority ?? null,
        notes: item?.notes ?? '',
      },
    })

  async function onSubmit(values: WishlistItemValues) {
    setIsPending(true)
    try {
      const res = isEdit
        ? await updateWishlistItem(item.id, values)
        : await createWishlistItem(values)
      if (res.success) {
        toast.success(isEdit ? 'Wishlist item updated' : 'Added to wishlist')
        onSaved?.()
        onOpenChange?.(false)
      } else {
        toast.error(res.error ?? 'Failed to save')
      }
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wishlist-name">Name</Label>
        <Input id="wishlist-name" placeholder="e.g. Magnesium Glycinate" {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Priority (optional)</Label>
        <Select
          value={priority}
          onValueChange={(v) => {
            const next = v as 'high' | 'medium' | 'low' | 'none'
            setPriority(next)
            setValue('priority', next === 'none' ? null : next)
          }}
        >
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="wishlist-notes">Notes (optional)</Label>
        <Textarea id="wishlist-notes" rows={3} placeholder="Why you want it…" {...register('notes')} />
        {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? 'Update' : 'Add to wishlist'}
        </Button>
      </div>
    </form>
  )
}

export function WishlistItemEditor({ open, onOpenChange, item, onSaved }: Props) {
  const isMobile = useIsMobile()
  const title = item ? 'Edit wishlist item' : 'New wishlist item'
  const description = item ? 'Update the item details.' : 'Add a supplement or medication to your wishlist.'
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>{title}</DrawerTitle><DrawerDescription>{description}</DrawerDescription></DrawerHeader>
          <div className="p-4 pb-8"><WishlistItemForm key={item?.id ?? 'new'} item={item} onSaved={onSaved} onOpenChange={onOpenChange} /></div>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <WishlistItemForm key={item?.id ?? 'new'} item={item} onSaved={onSaved} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}
