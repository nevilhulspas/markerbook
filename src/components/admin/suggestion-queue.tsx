'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  approveSuggestion,
  rejectSuggestion,
} from '@/actions/admin/suggestions'
import type { MarkerSuggestion } from '@/lib/database.types'
import { APP_LOCALE } from '@/lib/locale'
import { guessCategory } from '@/components/import/create-biomarker-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

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

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

const statusBadgeVariant: Record<
  MarkerSuggestion['status'],
  'secondary' | 'default' | 'destructive'
> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

const typeBadgeVariant: Record<
  MarkerSuggestion['type'],
  'default' | 'secondary'
> = {
  marker: 'default',
  unit: 'secondary',
}

interface SuggestionQueueProps {
  suggestions: MarkerSuggestion[]
  error: string | null
}

export function SuggestionQueue({ suggestions, error }: SuggestionQueueProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [rejectTarget, setRejectTarget] = useState<MarkerSuggestion | null>(
    null
  )
  const [approveTarget, setApproveTarget] = useState<MarkerSuggestion | null>(
    null
  )
  const [reviewNotes, setReviewNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Approve form state
  const [biomarkerName, setBiomarkerName] = useState('')
  const [biomarkerCategory, setBiomarkerCategory] = useState('')
  const [biomarkerUnit, setBiomarkerUnit] = useState('')
  const [approveNotes, setApproveNotes] = useState('')

  const filtered =
    filter === 'all'
      ? suggestions
      : suggestions.filter((s) => s.status === filter)

  function openRejectDialog(suggestion: MarkerSuggestion) {
    setRejectTarget(suggestion)
    setReviewNotes('')
  }

  function openApproveDialog(suggestion: MarkerSuggestion) {
    setApproveTarget(suggestion)
    setBiomarkerName(suggestion.name)
    setBiomarkerCategory(guessCategory(suggestion.name) || 'Other')
    setBiomarkerUnit('')
    setApproveNotes('')
  }

  async function handleReject() {
    if (!rejectTarget || !reviewNotes.trim()) return
    setIsSubmitting(true)
    const result = await rejectSuggestion({
      suggestionId: rejectTarget.id,
      reviewNotes: reviewNotes.trim(),
    })
    setIsSubmitting(false)
    if (result.success) {
      toast.success('Suggestion rejected')
      setRejectTarget(null)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  async function handleApprove() {
    if (!approveTarget) return

    const isMarker = approveTarget.type === 'marker'

    if (isMarker && (!biomarkerName.trim() || !biomarkerCategory)) return

    setIsSubmitting(true)
    const result = await approveSuggestion({
      suggestionId: approveTarget.id,
      reviewNotes: approveNotes.trim() || undefined,
      biomarkerData: isMarker
        ? {
            name: biomarkerName.trim(),
            category: biomarkerCategory,
            unit: biomarkerUnit.trim(),
          }
        : {
            name: approveTarget.name,
            category: 'Other',
            unit: '',
          },
    })
    setIsSubmitting(false)
    if (result.success) {
      toast.success(
        isMarker
          ? 'Suggestion approved — biomarker created'
          : 'Suggestion approved'
      )
      setApproveTarget(null)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  if (error) {
    return <p className="text-destructive">Failed to load suggestions: {error}</p>
  }

  return (
    <div className="space-y-4">
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as StatusFilter)}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">
          No {filter === 'all' ? '' : filter + ' '}suggestions.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((suggestion) => (
                <TableRow key={suggestion.id}>
                  <TableCell className="font-medium">
                    {suggestion.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={typeBadgeVariant[suggestion.type]}>
                      {suggestion.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {suggestion.user_email ?? '-'}
                  </TableCell>
                  <TableCell
                    className="max-w-[200px] truncate"
                    title={suggestion.details ?? undefined}
                  >
                    {suggestion.details ?? '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[suggestion.status]}>
                      {suggestion.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(suggestion.created_at).toLocaleDateString(APP_LOCALE)}
                  </TableCell>
                  <TableCell className="text-right">
                    {suggestion.status === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => openApproveDialog(suggestion)}
                        >
                          <Check className="mr-1 size-3" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openRejectDialog(suggestion)}
                        >
                          <X className="mr-1 size-3" />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {suggestion.review_notes ?? 'No notes'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Suggestion</DialogTitle>
            <DialogDescription>
              Reject &quot;{rejectTarget?.name}&quot; — provide a reason for the
              rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-notes">Review Notes</Label>
            <Textarea
              id="reject-notes"
              placeholder="Reason for rejection..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reviewNotes.trim() || isSubmitting}
              onClick={handleReject}
            >
              {isSubmitting && <Loader2 className="mr-1 size-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Suggestion</DialogTitle>
            <DialogDescription>
              Approve &quot;{approveTarget?.name}&quot;
              {approveTarget?.type === 'marker'
                ? ' — review and confirm biomarker details.'
                : ' — status change only.'}
            </DialogDescription>
          </DialogHeader>

          {approveTarget?.type === 'marker' ? (
            <div className="grid gap-4">
              <div className="space-y-1">
                <Label htmlFor="approve-name" className="text-xs">
                  Name
                </Label>
                <Input
                  id="approve-name"
                  value={biomarkerName}
                  onChange={(e) => setBiomarkerName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="approve-category" className="text-xs">
                  Category
                </Label>
                <Select
                  value={biomarkerCategory}
                  onValueChange={setBiomarkerCategory}
                >
                  <SelectTrigger id="approve-category" className="w-full">
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
                <Label htmlFor="approve-unit" className="text-xs">
                  Unit
                </Label>
                <Input
                  id="approve-unit"
                  value={biomarkerUnit}
                  onChange={(e) => setBiomarkerUnit(e.target.value)}
                  placeholder="e.g. mg/dL"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="approve-notes" className="text-xs">
                  Review Notes (optional)
                </Label>
                <Textarea
                  id="approve-notes"
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Unit suggestions are approved with status change only. Add the
                unit via Biomarker Catalog CRUD.
              </p>
              <div className="space-y-1">
                <Label htmlFor="approve-unit-notes" className="text-xs">
                  Review Notes (optional)
                </Label>
                <Textarea
                  id="approve-unit-notes"
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                isSubmitting ||
                (approveTarget?.type === 'marker' &&
                  (!biomarkerName.trim() || !biomarkerCategory))
              }
              onClick={handleApprove}
            >
              {isSubmitting && <Loader2 className="mr-1 size-4 animate-spin" />}
              {approveTarget?.type === 'marker'
                ? 'Approve & Create Biomarker'
                : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
