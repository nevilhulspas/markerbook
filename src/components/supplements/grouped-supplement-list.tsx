'use client'

import { Pencil } from 'lucide-react'

import type { SupplementWithIntakes } from '@/lib/database.types'
import { deriveFrequency, groupByIntakeTime } from '@/lib/supplements/intake'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/** Name, Dose, Amount, Frequency, Starts, actions. */
const COL_COUNT = 6

interface GroupedSupplementListProps {
  supplements: SupplementWithIntakes[]
  mode: 'active' | 'upcoming'
  onEdit: (supplement: SupplementWithIntakes) => void
}

/**
 * The Stack grouped by intake time. Built on the same `<Table>` primitives as
 * the flat list so the columns, type scale and row rhythm are identical — the
 * only difference is a time header row before each group.
 */
export function GroupedSupplementList({
  supplements,
  mode,
  onEdit,
}: GroupedSupplementListProps) {
  const groups = groupByIntakeTime(supplements)

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Dose</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>{mode === 'upcoming' ? 'Starts' : 'Started'}</TableHead>
            <TableHead className="w-1 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={COL_COUNT}
                className="text-center text-sm text-muted-foreground"
              >
                No supplements
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => [
              <TableRow
                key={`head-${group.time ?? 'untimed'}`}
                className="bg-muted/50 hover:bg-muted/50"
              >
                <TableCell colSpan={COL_COUNT} className="py-2">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold tabular-nums">
                      {group.time ?? 'No time set'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {group.rows.length}{' '}
                      {group.rows.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                </TableCell>
              </TableRow>,
              ...group.rows.map((row) => (
                <TableRow key={`${group.time ?? 'untimed'}-${row.supplement.id}`}>
                  <TableCell className="font-medium">
                    {row.supplement.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.supplement.dose ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.amount ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {deriveFrequency(
                      row.supplement.intakes,
                      row.supplement.frequency
                    ) ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.supplement.start_date}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEdit(row.supplement)}
                      aria-label={`Edit ${row.supplement.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              )),
            ])
          )}
        </TableBody>
      </Table>
    </div>
  )
}
