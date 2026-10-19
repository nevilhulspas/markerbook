'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import type { Biomarker } from '@/lib/database.types'
import { createBiomarker } from '@/actions/blood-tests'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { CreateUnitDialog } from '@/components/ui/create-unit-dialog'

const CATEGORIES = [
  'Hematology',
  'Metabolic',
  'Lipid Panel',
  'Liver',
  'Kidney',
  'Thyroid',
  'Vitamins & Minerals',
  'Hormones',
  'Inflammation',
  'Cardiac',
  'Diabetes',
  'Electrolytes',
  'Iron Studies',
  'Immune',
  'Other',
]

/** Keyword-based category suggestion from a biomarker name */
const CATEGORY_KEYWORDS: [string[], string][] = [
  [['leucocyte', 'leukocyte', 'erythrocyte', 'hemoglobin', 'haemoglobin', 'platelet', 'thrombocyte', 'neutrophil', 'lymphocyte', 'monocyte', 'basophil', 'eosinophil', 'hematocrit', 'haematocrit', 'mcv', 'mch', 'mchc', 'reticulocyte', 'granulocyte'], 'Hematology'],
  [['glucose', 'hba1c', 'hemoglobin a1c', 'glycated'], 'Diabetes'],
  [['cholesterol', 'hdl', 'ldl', 'triglyceride', 'apolipoprotein', 'lipo'], 'Lipid Panel'],
  [['sodium', 'potassium', 'chloride', 'calcium', 'magnesium', 'phosphate', 'bicarbonate'], 'Electrolytes'],
  [['creatinine', 'urea', 'bun', 'egfr', 'cystatin'], 'Kidney'],
  [['alt', 'ast', 'bilirubin', 'ggt', 'alkaline phosphatase', 'albumin', 'gamma-gt'], 'Liver'],
  [['tsh', 't3', 't4', 'thyroid', 'thyroxine'], 'Thyroid'],
  [['iron', 'ferritin', 'transferrin', 'tibc'], 'Iron Studies'],
  [['vitamin', 'folate', 'folic', 'b12', 'cobalamin', 'zinc', 'selenium', 'copper'], 'Vitamins & Minerals'],
  [['crp', 'esr', 'sedimentation', 'c-reactive'], 'Inflammation'],
  [['testosterone', 'estrogen', 'estradiol', 'cortisol', 'insulin', 'dhea', 'progesterone', 'prolactin', 'lh', 'fsh'], 'Hormones'],
  [['troponin', 'bnp', 'nt-probnp', 'ck-mb'], 'Cardiac'],
]

export function guessCategory(name: string): string {
  const lower = name.toLowerCase()
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category
    }
  }
  return ''
}

interface CreateBiomarkerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName: string
  defaultUnit: string
  defaultCategory: string
  unitOptions: string[]
  onCreated: (biomarker: Biomarker) => void
}

export function CreateBiomarkerDialog({
  open,
  onOpenChange,
  defaultName,
  defaultUnit,
  defaultCategory,
  unitOptions,
  onCreated,
}: CreateBiomarkerDialogProps) {
  const [name, setName] = useState(defaultName)
  const [category, setCategory] = useState(defaultCategory)
  const [unit, setUnit] = useState(defaultUnit)
  const [isSaving, setIsSaving] = useState(false)
  const [localUnits, setLocalUnits] = useState<string[]>([])
  const [createUnitOpen, setCreateUnitOpen] = useState(false)

  // Reset fields when dialog opens with new defaults
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the fields each time the dialog opens
      setName(defaultName)
      setCategory(defaultCategory)
      setUnit(defaultUnit)
      setLocalUnits([])
    }
  }, [open, defaultName, defaultCategory, defaultUnit])

  const allUnits = [...new Set([...unitOptions, ...localUnits])].sort()

  function handleUnitChange(value: string) {
    if (value === '__create_new_unit__') {
      setCreateUnitOpen(true)
      return
    }
    setUnit(value)
  }

  function handleUnitCreated(newUnit: string) {
    setLocalUnits((prev) => [...prev, newUnit])
    setUnit(newUnit)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !category || !unit.trim()) return

    setIsSaving(true)
    const result = await createBiomarker({
      name: name.trim(),
      category,
      unit: unit.trim(),
    })
    setIsSaving(false)

    if (result.success) {
      toast.success(`Created biomarker "${result.biomarker.name}"`)
      onCreated(result.biomarker)
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Biomarker</DialogTitle>
            <DialogDescription>
              Add a new biomarker to the catalog for future use.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="space-y-1">
              <Label htmlFor="biomarker-name" className="text-xs">
                Name
              </Label>
              <Input
                id="biomarker-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hemoglobin A1c"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="biomarker-category" className="text-xs">
                Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="biomarker-category" className="w-full">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="biomarker-unit" className="text-xs">
                Unit
              </Label>
              <Select value={unit} onValueChange={handleUnitChange}>
                <SelectTrigger id="biomarker-unit" className="w-full">
                  <SelectValue placeholder="Select unit..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__create_new_unit__">
                    <span className="flex items-center gap-2 text-primary">
                      <Plus className="size-3" />
                      Create new unit
                    </span>
                  </SelectItem>
                  {allUnits.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !name.trim() || !category || !unit.trim() || isSaving
                }
              >
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CreateUnitDialog
        open={createUnitOpen}
        onOpenChange={setCreateUnitOpen}
        onCreated={handleUnitCreated}
      />
    </>
  )
}
