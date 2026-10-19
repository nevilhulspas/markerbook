'use client'

import { useState, useCallback } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { exportRangesCsv } from '@/actions/admin/ranges'
import { localDateISO } from '@/lib/dates/today'

interface CsvExportButtonProps {
  biomarkerId?: string
}

export function CsvExportButton({ biomarkerId }: CsvExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const result = await exportRangesCsv(biomarkerId)
      if (result.error) {
        toast.error(result.error)
        return
      }

      const blob = new Blob([result.data], {
        type: 'text/csv;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `reference-ranges-${localDateISO()}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to export ranges')
    } finally {
      setExporting(false)
    }
  }, [biomarkerId])

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
    >
      {exporting ? <Loader2 className="animate-spin" /> : <Download />}
      Export CSV
    </Button>
  )
}
