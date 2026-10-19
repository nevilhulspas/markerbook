'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { saveLogEntry } from '@/actions/body-log'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { appTodayISO } from '@/lib/dates/today'

function todayISO(): string {
  return appTodayISO()
}

function num(s: string): number | null {
  const n = Number(s)
  return s.trim() !== '' && Number.isFinite(n) ? n : null
}

export function BodyLogForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [weight, setWeight] = useState('')
  const [fat, setFat] = useState('')
  const [waist, setWaist] = useState('')

  async function handleSave() {
    setSaving(true)
    const { error } = await saveLogEntry({
      logged_on: date,
      weight_kg: num(weight),
      body_fat_pct: num(fat),
      waist_cm: num(waist),
    })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Measurement logged')
    setWeight('')
    setFat('')
    setWaist('')
    router.refresh()
  }

  return (
    <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1.5">
        <Label htmlFor="log-date">Date</Label>
        <Input id="log-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="log-weight">Weight (kg)</Label>
        <Input id="log-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="log-fat">Body fat %</Label>
        <Input id="log-fat" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="log-waist">Waist (cm)</Label>
        <Input id="log-waist" inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} />
      </div>
      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        Log
      </Button>
    </div>
  )
}
