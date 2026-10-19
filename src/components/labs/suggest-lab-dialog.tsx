'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { submitLab } from '@/actions/labs'

export function SuggestLabDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await submitLab({ name, website, country, city })
      if (result.error || !result.data) {
        setError(result.error ?? 'Could not submit the lab.')
        return
      }
      setOpen(false)
      router.push(`/labs/${result.data.labId}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shrink-0">
          <Plus className="mr-1 size-4" />
          Suggest a lab
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suggest a lab</DialogTitle>
          <DialogDescription>
            We&apos;ll import its test catalogue automatically. The lab becomes visible
            once the import succeeds.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="suggest-lab-name">Lab name</Label>
            <Input
              id="suggest-lab-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. BODIMED"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="suggest-lab-website">Website</Label>
            <Input
              id="suggest-lab-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              required
              placeholder="https://…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="suggest-lab-country">Country (optional)</Label>
              <Input
                id="suggest-lab-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Bulgaria"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="suggest-lab-city">City (optional)</Label>
              <Input
                id="suggest-lab-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Sofia"
              />
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim() || !website.trim()}>
              {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
              Suggest
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
