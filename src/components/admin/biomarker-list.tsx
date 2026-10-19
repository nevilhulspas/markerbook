'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Archive, Loader2, Plus, RotateCcw, Search } from 'lucide-react'
import { toast } from 'sonner'

import {
  archiveBiomarker,
  restoreBiomarker,
  type AdminBiomarker,
} from '@/actions/admin/biomarkers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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

interface BiomarkerListProps {
  biomarkers: AdminBiomarker[]
  error: string | null
}

export function BiomarkerList({ biomarkers, error }: BiomarkerListProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string
    name: string
    action: 'archive' | 'restore'
  } | null>(null)

  const filtered = biomarkers.filter((b) => {
    if (!showArchived && b.archived_at) return false
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false
    if (category !== 'all' && b.category !== category) return false
    return true
  })

  async function handleAction(id: string, action: 'archive' | 'restore') {
    setActionId(id)
    const result =
      action === 'archive'
        ? await archiveBiomarker(id)
        : await restoreBiomarker(id)

    if (result.success) {
      toast.success(action === 'archive' ? 'Biomarker archived' : 'Biomarker restored')
      router.refresh()
    } else {
      toast.error(result.error)
    }
    setActionId(null)
    setConfirmTarget(null)
  }

  if (error) {
    return (
      <p className="text-destructive">Failed to load biomarkers: {error}</p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search biomarkers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-archived"
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked === true)}
          />
          <Label htmlFor="show-archived" className="text-sm cursor-pointer">
            Show archived
          </Label>
        </div>
        <Button asChild>
          <Link href="/admin/biomarkers/new">
            <Plus className="mr-1 size-4" />
            Add Biomarker
          </Link>
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No biomarkers found.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-center">Units</TableHead>
                <TableHead className="text-center">Ranges</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((biomarker) => (
                <TableRow key={biomarker.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/biomarkers/${biomarker.id}`}
                      className="text-primary hover:underline"
                    >
                      {biomarker.name}
                    </Link>
                  </TableCell>
                  <TableCell>{biomarker.category}</TableCell>
                  <TableCell>{biomarker.unit}</TableCell>
                  <TableCell className="text-center">
                    {biomarker.biomarker_units.length}
                  </TableCell>
                  <TableCell className="text-center">
                    {biomarker.reference_ranges.length}
                  </TableCell>
                  <TableCell>
                    {biomarker.archived_at ? (
                      <Badge variant="secondary">Archived</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {biomarker.archived_at ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === biomarker.id}
                        onClick={() =>
                          setConfirmTarget({
                            id: biomarker.id,
                            name: biomarker.name,
                            action: 'restore',
                          })
                        }
                      >
                        {actionId === biomarker.id ? (
                          <Loader2 className="mr-1 size-3 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1 size-3" />
                        )}
                        Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === biomarker.id}
                        onClick={() =>
                          setConfirmTarget({
                            id: biomarker.id,
                            name: biomarker.name,
                            action: 'archive',
                          })
                        }
                      >
                        {actionId === biomarker.id ? (
                          <Loader2 className="mr-1 size-3 animate-spin" />
                        ) : (
                          <Archive className="mr-1 size-3" />
                        )}
                        Archive
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Confirm dialog */}
      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget?.action === 'archive'
                ? 'Archive Biomarker'
                : 'Restore Biomarker'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.action === 'archive'
                ? `Are you sure you want to archive "${confirmTarget?.name}"? It will be hidden from the catalog but can be restored later.`
                : `Restore "${confirmTarget?.name}" to the active catalog?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmTarget) {
                  handleAction(confirmTarget.id, confirmTarget.action)
                }
              }}
            >
              {confirmTarget?.action === 'archive' ? 'Archive' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
