'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { parseCsvRanges, type CsvParseResult } from '@/lib/validations/csv-ranges'
import { bulkImportRanges } from '@/actions/admin/ranges'

interface CsvImportDialogProps {
  biomarkerId?: string
  onSuccess?: () => void
}

export function CsvImportDialog({ onSuccess }: CsvImportDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null)
  const [importing, setImporting] = useState(false)

  const resetState = useCallback(() => {
    setParseResult(null)
    setImporting(false)
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) resetState()
    },
    [resetState]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result
        if (typeof text !== 'string') return

        try {
          const result = parseCsvRanges(text)
          setParseResult(result)
        } catch (err) {
          setParseResult({
            rows: [],
            errors: [
              {
                line: 0,
                message:
                  err instanceof Error ? err.message : 'Failed to parse CSV',
              },
            ],
          })
        }
      }
      reader.readAsText(file)
    },
    []
  )

  const handleImport = useCallback(async () => {
    if (!parseResult || parseResult.rows.length === 0) return

    setImporting(true)
    try {
      const result = await bulkImportRanges(parseResult.rows)
      if (result.success) {
        toast.success(`Imported ${result.imported} ranges`)
        setOpen(false)
        resetState()
        onSuccess?.()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('Failed to import ranges')
    } finally {
      setImporting(false)
    }
  }, [parseResult, onSuccess, router, resetState])

  const hasErrors = (parseResult?.errors.length ?? 0) > 0
  const hasRows = (parseResult?.rows.length ?? 0) > 0
  const canImport = hasRows && !hasErrors && !importing

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Reference Ranges from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: biomarker_name, unit, sex, age_min,
            age_max, range_low, range_high, source, range_type
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={importing}
          />

          {hasErrors && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">
                {parseResult!.errors.length} validation error(s)
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Line</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parseResult!.errors.map((err, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-destructive">
                        {err.line}
                      </TableCell>
                      <TableCell className="text-destructive">
                        {err.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {hasRows && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-emerald-600">
                {parseResult!.rows.length} valid row(s) ready to import
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Biomarker</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Sex</TableHead>
                    <TableHead>Low</TableHead>
                    <TableHead>High</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parseResult!.rows.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.biomarker_name}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell>{row.sex}</TableCell>
                      <TableCell>{row.range_low || '-'}</TableCell>
                      <TableCell>{row.range_high || '-'}</TableCell>
                      <TableCell>{row.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parseResult!.rows.length > 10 && (
                <p className="text-xs text-muted-foreground">
                  ...and {parseResult!.rows.length - 10} more rows
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!canImport}>
            {importing && <Loader2 className="animate-spin" />}
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
