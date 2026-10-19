import { gramsToKg } from '@/lib/body/metrics'
import { REGION_LABELS } from '@/lib/body/display'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { DexaRegion } from '@/lib/database.types'

const kg = (g: number | null) => (g == null ? '—' : `${gramsToKg(g).toFixed(2)} kg`)
const pct = (n: number | null) => (n == null ? '—' : `${n.toFixed(1)}%`)
const num = (n: number | null, d = 3) => (n == null ? '—' : n.toFixed(d))

// Body-composition regions vs bone-only regions are shown in separate tables.
const COMP_ORDER = ['total', 'arms', 'arm_left', 'arm_right', 'legs', 'leg_left', 'leg_right', 'trunk', 'trunk_left', 'trunk_right', 'android', 'gynoid']
const BONE_ORDER = ['total', 'spine', 'pelvis', 'arms', 'legs', 'trunk', 'ribs', 'head']

export function RegionalTable({ regions }: { regions: DexaRegion[] }) {
  const byRegion = new Map(regions.map((r) => [r.region, r]))
  const comp = COMP_ORDER.map((r) => byRegion.get(r as DexaRegion['region'])).filter(
    (r): r is DexaRegion => Boolean(r) && (r!.fat_pct != null || r!.fat_mass_g != null || r!.lean_mass_g != null)
  )
  const bone = BONE_ORDER.map((r) => byRegion.get(r as DexaRegion['region'])).filter(
    (r): r is DexaRegion => Boolean(r) && r!.bmd != null
  )

  return (
    <div className="space-y-6">
      {comp.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Body composition by region</h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Fat %</TableHead>
                  <TableHead className="text-right">Fat</TableHead>
                  <TableHead className="text-right">Lean</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comp.map((r) => (
                  <TableRow key={r.region}>
                    <TableCell className="font-medium">{REGION_LABELS[r.region]}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(r.fat_pct)}</TableCell>
                    <TableCell className="text-right tabular-nums">{kg(r.fat_mass_g)}</TableCell>
                    <TableCell className="text-right tabular-nums">{kg(r.lean_mass_g)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {bone.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Bone density by region</h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">BMD (g/cm²)</TableHead>
                  <TableHead className="text-right">T-score</TableHead>
                  <TableHead className="text-right">Z-score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bone.map((r) => (
                  <TableRow key={r.region}>
                    <TableCell className="font-medium">{REGION_LABELS[r.region]}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(r.bmd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(r.t_score, 1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(r.z_score, 1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
