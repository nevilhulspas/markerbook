'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { toast } from 'sonner'

import {
  NTT_PDF_COLUMNS,
  NTT_PDF_COLUMN_LABELS,
  type NextToTestPdfColumn,
  type NttPdfGroup,
} from '@/lib/export/next-to-test-pdf-format'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Props {
  groups: NttPdfGroup[]
  listName: string
}

/**
 * "Generate PDF" control for the next-to-test page. Opens a column-picker dialog
 * and downloads the current view (the grouped rows passed in) as a PDF. Disabled
 * when the view is empty. All generation happens client-side via
 * exportNextToTestAsPdf — the parent passes the already-filtered/sorted rows.
 */
export function GeneratePdfButton({ groups, listName }: Props) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [columns, setColumns] = useState<Set<NextToTestPdfColumn>>(
    () => new Set(NTT_PDF_COLUMNS)
  )
  const hasRows = groups.some((g) => g.rows.length > 0)

  function toggle(col: NextToTestPdfColumn, checked: boolean) {
    setColumns((prev) => {
      const next = new Set(prev)
      if (checked) next.add(col)
      else next.delete(col)
      return next
    })
  }

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      // jsPDF is only needed here, so load it on click instead of with the page.
      const { exportNextToTestAsPdf } = await import('@/lib/export/export-next-to-test')
      exportNextToTestAsPdf(groups, listName, {
        columns: NTT_PDF_COLUMNS.filter((c) => columns.has(c)),
      })
    } catch {
      toast.error('Could not generate the PDF. Please try again.')
    } finally {
      setDownloading(false)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="shrink-0" disabled={!hasRows}>
          <FileDown className="size-4" />
          Generate PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate PDF</DialogTitle>
          <DialogDescription>
            Exports the current view of “{listName}”, grouped by category. Choose
            which columns to include — Name is always shown.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {NTT_PDF_COLUMNS.map((col) => (
            <div key={col} className="flex items-center gap-2">
              <Checkbox
                id={`pdf-col-${col}`}
                checked={columns.has(col)}
                onCheckedChange={(v) => toggle(col, v === true)}
              />
              <Label htmlFor={`pdf-col-${col}`} className="font-normal">
                {NTT_PDF_COLUMN_LABELS[col]}
              </Label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleDownload} disabled={downloading}>
            <FileDown className="size-4" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
