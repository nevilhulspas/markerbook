import Link from 'next/link'
import { MapPin, TestTube2 } from 'lucide-react'

import type { LabWithTestCount } from '@/actions/labs'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LabFavoriteButton } from '@/components/labs/lab-favorite-button'

interface LabCardProps {
  lab: LabWithTestCount
  favorited: boolean
}

export function LabCard({ lab, favorited }: LabCardProps) {
  const location = [lab.city, lab.country].filter(Boolean).join(', ')

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">
            <Link href={`/labs/${lab.id}`} className="hover:underline">
              {lab.name}
            </Link>
          </CardTitle>
          {location && (
            <CardDescription className="flex items-center gap-2">
              <MapPin className="size-3.5" />
              {location}
            </CardDescription>
          )}
        </div>
        <LabFavoriteButton labId={lab.id} initialFavorited={favorited} />
      </CardHeader>
      <CardContent>
        <Badge variant="secondary">
          <TestTube2 className="mr-1 size-3" />
          {lab.testCount} test{lab.testCount === 1 ? '' : 's'}
        </Badge>
      </CardContent>
    </Card>
  )
}
