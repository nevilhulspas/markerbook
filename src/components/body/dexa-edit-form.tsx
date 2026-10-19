'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { updateScan } from '@/actions/dexa'
import type { DexaScanExtract } from '@/lib/validations/dexa-import'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import type { DexaScan } from '@/lib/database.types'

const NUM_FIELDS: { key: keyof DexaScanExtract; label: string }[] = [
  { key: 'age_years', label: 'Age (years)' },
  { key: 'height_cm', label: 'Height (cm)' },
  { key: 'weight_kg', label: 'Weight (kg)' },
  { key: 'total_mass_kg', label: 'Total mass (kg)' },
  { key: 'fat_mass_g', label: 'Fat mass (g)' },
  { key: 'lean_mass_g', label: 'Lean mass (g)' },
  { key: 'bmc_g', label: 'Bone mineral content (g)' },
  { key: 'body_fat_pct', label: 'Body fat %' },
  { key: 'visceral_fat_g', label: 'Visceral fat (g)' },
  { key: 'android_fat_pct', label: 'Android fat %' },
  { key: 'gynoid_fat_pct', label: 'Gynoid fat %' },
  { key: 'android_gynoid_ratio', label: 'A/G ratio' },
  { key: 'almi', label: 'ALMI (kg/m²)' },
  { key: 'ffmi', label: 'FFMI (kg/m²)' },
  { key: 'bone_t_score', label: 'Bone T-score' },
  { key: 'bone_z_score', label: 'Bone Z-score' },
  { key: 'total_bmd', label: 'Total BMD (g/cm²)' },
]

export function DexaEditForm({ scan }: { scan: DexaScan }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [scanDate, setScanDate] = useState(scan.scan_date)
  const [provider, setProvider] = useState(scan.provider ?? '')
  const [nums, setNums] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of NUM_FIELDS) {
      const v = scan[f.key as keyof DexaScan]
      init[f.key as string] = v == null ? '' : String(v)
    }
    return init
  })

  async function handleSave() {
    setSaving(true)
    const patch: Partial<DexaScanExtract> = { scan_date: scanDate, provider: provider || null }
    for (const f of NUM_FIELDS) {
      const raw = nums[f.key as string]
      const n = raw === '' ? null : Number(raw)
      ;(patch as Record<string, unknown>)[f.key as string] = Number.isFinite(n as number) ? n : null
    }
    const { error } = await updateScan(scan.id, { scan: patch })
    setSaving(false)
    if (error) toast.error(error)
    else {
      toast.success('Scan updated')
      router.push(`/body/${scan.id}`)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="scan_date">Scan date</Label>
            <Input id="scan_date" type="date" value={scanDate} onChange={(e) => setScanDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider">Provider</Label>
            <Input id="provider" value={provider} onChange={(e) => setProvider(e.target.value)} />
          </div>
          {NUM_FIELDS.map((f) => (
            <div key={String(f.key)} className="space-y-1.5">
              <Label htmlFor={String(f.key)}>{f.label}</Label>
              <Input
                id={String(f.key)}
                inputMode="decimal"
                value={nums[f.key as string] ?? ''}
                onChange={(e) => setNums((s) => ({ ...s, [f.key as string]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
          <Button variant="outline" onClick={() => router.push(`/body/${scan.id}`)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
