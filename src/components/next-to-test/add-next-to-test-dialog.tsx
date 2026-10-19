'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Loader2,
  ChevronLeft,
  Beaker,
  Activity,
  Bug,
  FlaskConical,
  Dna,
  CircleHelp,
} from 'lucide-react'

import {
  getBiomarkersForPicker,
  getLabTestsForBiomarker,
} from '@/actions/next-to-test/lookup'
import type { LabTestForBiomarker } from '@/lib/next-to-test/lab-options'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { NextToTestList, NextToTestType } from '@/lib/database.types'
import { AddNextToTestForm } from './add-next-to-test-form'

// Category choice for the first step of the Add dialog. Blood opens the
// existing biomarker→lab picker; the others open a small form keyed off the
// test_type discriminator (and custom_name for 'other').
type Category =
  | 'blood'
  | Exclude<NextToTestType, 'blood_biomarker' | 'blood_lab_test'>

const CATEGORY_TILES: Array<{
  value: Category
  label: string
  hint: string
  icon: typeof Beaker
}> = [
  { value: 'blood', label: 'Blood marker', hint: 'Pick a biomarker, then a lab', icon: Beaker },
  { value: 'dexa', label: 'DEXA scan', hint: 'Body composition', icon: Activity },
  { value: 'microbiome', label: 'Microbiome', hint: 'Gut, oral, skin', icon: Bug },
  { value: 'dutch', label: 'DUTCH hormones', hint: 'Dried urine + saliva', icon: FlaskConical },
  { value: 'genetic', label: 'Genetic', hint: 'DNA / SNP panel', icon: Dna },
  { value: 'other', label: 'Other', hint: 'Free-text test name', icon: CircleHelp },
]

interface Props {
  lists: NextToTestList[]
  defaultListId: string
}

type Biomarker = { id: string; name: string }

export function AddNextToTestDialog({ lists, defaultListId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<Category | null>(null)
  const [picked, setPicked] = useState<Biomarker | null>(null)
  const [q, setQ] = useState('')
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([])
  const [loading, startLoading] = useTransition()

  // Lazy-load biomarkers when the user enters the Blood category and the
  // catalogue hasn't been fetched yet.
  useEffect(() => {
    if (!open || category !== 'blood' || biomarkers.length > 0) return
    startLoading(async () => {
      const data = await getBiomarkersForPicker()
      setBiomarkers(data)
    })
  }, [open, category, biomarkers.length])

  const ql = q.trim().toLowerCase()
  const filtered = ql
    ? biomarkers.filter((b) => b.name.toLowerCase().includes(ql))
    : biomarkers

  function reset() {
    setCategory(null)
    setPicked(null)
    setQ('')
  }

  function backOne() {
    if (picked) setPicked(null)
    else if (category) setCategory(null)
  }

  const title = !category
    ? 'What kind of test?'
    : category === 'blood'
      ? picked
        ? `Add ${picked.name}`
        : 'Pick a biomarker'
      : `Add ${CATEGORY_TILES.find((c) => c.value === category)?.label}`

  const showBack = !!category

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="shrink-0">
          <Plus className="mr-1 size-4" />
          Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {showBack ? (
              <span className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={backOne}
                  aria-label="Back"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {title}
              </span>
            ) : (
              title
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Step 0 — category tiles */}
        {!category && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORY_TILES.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setCategory(t.value)}
                  className="hover:bg-accent hover:border-accent-foreground/20 flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors"
                >
                  <Icon className="text-muted-foreground size-5" />
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.hint}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 1 — Blood: biomarker picker */}
        {category === 'blood' && !picked && (
          <div className="space-y-3">
            <Input
              placeholder="Search biomarkers…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            )}
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {filtered.length === 0 && !loading ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No biomarkers match.
                </p>
              ) : (
                filtered.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setPicked(b)}
                    className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                  >
                    {b.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2 — Blood: chosen biomarker + lab picker */}
        {category === 'blood' && picked && (
          <Step2
            biomarker={picked}
            lists={lists}
            defaultListId={defaultListId}
            onAdded={() => {
              setOpen(false)
              router.refresh()
            }}
            onBack={() => setPicked(null)}
          />
        )}

        {/* Step 1 (non-blood): typed-category form */}
        {category && category !== 'blood' && (
          <CategoryForm
            testType={category}
            lists={lists}
            defaultListId={defaultListId}
            onAdded={() => {
              setOpen(false)
              router.refresh()
            }}
            onBack={() => setCategory(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// -----------------------------------------------------------------------
// Non-blood category form: optional/required custom name + list/note/due
// -----------------------------------------------------------------------

function CategoryForm({
  testType,
  lists,
  defaultListId,
  onAdded,
  onBack,
}: {
  testType: Exclude<NextToTestType, 'blood_biomarker' | 'blood_lab_test'>
  lists: NextToTestList[]
  defaultListId: string
  onAdded: () => void
  onBack: () => void
}) {
  const [customName, setCustomName] = useState('')
  const requiresName = testType === 'other'

  // For 'other' we hard-require the name. For typed categories the
  // placeholder shows the default label so users know what'll be saved.
  const placeholder =
    testType === 'other'
      ? 'Test name (required)'
      : `${CATEGORY_TILES.find((c) => c.value === testType)?.label} — leave blank for default`

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="ntt-custom-name">
          {requiresName ? 'Test name' : 'Custom label (optional)'}
        </Label>
        <Input
          id="ntt-custom-name"
          autoFocus
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder={placeholder}
        />
        {!requiresName && (
          <p className="text-xs text-muted-foreground">
            Helpful when you want to track several entries in the same
            category — e.g. &quot;DEXA at HumanFitness&quot;.
          </p>
        )}
      </div>
      <AddNextToTestForm
        // Re-key on customName so a typed change doesn't strand a stale form
        // (e.g. the user types a name, decides to clear it, the trimmed
        // string flows down on the next submit).
        key={`form-${customName}`}
        target={{
          kind: 'category',
          testType,
          customName: customName.trim() || undefined,
        }}
        lists={lists}
        defaultListId={defaultListId}
        onAdded={onAdded}
        onClose={onBack}
      />
    </div>
  )
}

interface Step2Props {
  biomarker: Biomarker
  lists: NextToTestList[]
  defaultListId: string
  onAdded: () => void
  onBack: () => void
}

const ANY_LAB = '__any_lab__'

function Step2({ biomarker, lists, defaultListId, onAdded, onBack }: Step2Props) {
  const [labOptions, setLabOptions] = useState<LabTestForBiomarker[]>([])
  const [labChoice, setLabChoice] = useState<string>(ANY_LAB)
  const [loading, startLoading] = useTransition()

  useEffect(() => {
    startLoading(async () => {
      const opts = await getLabTestsForBiomarker(biomarker.id)
      setLabOptions(opts)
    })
  }, [biomarker.id])

  const target =
    labChoice === ANY_LAB
      ? ({ kind: 'biomarker', biomarkerId: biomarker.id } as const)
      : ({ kind: 'lab_test', labTestId: labChoice } as const)

  // Re-key the inner form so changing the lab choice resets local state
  // (note + due) cleanly between submits without retaining stale values.
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="ntt-lab-choice">Source</Label>
        <Select value={labChoice} onValueChange={setLabChoice}>
          <SelectTrigger id="ntt-lab-choice">
            <SelectValue placeholder="Any lab (decide later)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_LAB}>Any lab (decide later)</SelectItem>
            {labOptions.map((o) => (
              <SelectItem key={o.labTestId} value={o.labTestId}>
                {o.labName} — {o.testName}
                {o.cost !== null
                  ? ` · ${o.cost}${o.currency ? ' ' + o.currency : ''}`
                  : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loading && (
          <p className="text-xs text-muted-foreground">
            Loading available labs…
          </p>
        )}
        {!loading && labOptions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No specific labs found for this biomarker — it&apos;ll save lab-agnostically.
          </p>
        )}
      </div>
      <AddNextToTestForm
        key={`form-${labChoice}`}
        target={target}
        lists={lists}
        defaultListId={defaultListId}
        onAdded={onAdded}
        onClose={onBack}
      />
    </div>
  )
}
